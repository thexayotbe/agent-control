#!/usr/bin/env python3
"""Agent control: budget status line, budget hook, usage report, agy wrapper.

  ctl.py statusline <account>      Claude Code statusLine command (reads JSON on stdin)
  ctl.py hook <account>            UserPromptSubmit hook: prints budget context for the model
  ctl.py status                    Full budget picture for a human
  ctl.py report [days]             Token usage by account / model / project (default 7 days)
  ctl.py agy <tier> [--write|--web] [--cwd DIR] [--timeout 600s] <prompt...>
                                   Run a task on Gemini/agy (rotates accounts, falls back on quota) and log usage
  ctl.py quota [--json] [--cached] Live 5h/weekly limits of every Claude + agy account (refreshes state/quota.json)
  ctl.py agy-check | agy-list      Probe all agy accounts / show usage per account
  ctl.py board add|set|list        Task board shown in the office UI (http://localhost:2000)
  ctl.py state-json                Board + budget as JSON (office UI backend)
"""
import glob
import json
import os
import re
import subprocess
import sys
import threading
import time
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

ROOT = os.path.expanduser("~/.claude-control")
STATE = os.path.join(ROOT, "state")
LEDGER = os.path.join(ROOT, "ledger")
CFG = json.load(open(os.path.join(ROOT, "config.json")))
TH = CFG["thresholds"]
NOW = time.time()


def acct_dir(name):
    return os.path.expanduser(CFG["accounts"][name]["dir"])


def read_json(path, default=None):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return default


def write_json(path, data):
    tmp = f"{path}.{os.getpid()}.tmp"  # unique per process: parallel hooks/agy runs raced on one .tmp
    with open(tmp, "w") as f:
        json.dump(data, f)
    os.replace(tmp, path)


def pct(v):
    """Accept 0..1 or 0..100; return 0..100 float or None."""
    if v is None:
        return None
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    return v * 100 if v <= 1.0 else v


def epoch(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return v / 1000 if v > 1e12 else v
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


def when(ts):
    if not ts:
        return "?"
    d = datetime.fromtimestamp(ts)
    if ts - NOW < 20 * 3600:
        return d.strftime("%H:%M")
    return d.strftime("%a %H:%M")


def ago(ts):
    s = NOW - ts
    if s < 120:
        return "now"
    if s < 7200:
        return f"{int(s // 60)}m ago"
    if s < 172800:
        return f"{int(s // 3600)}h ago"
    return f"{int(s // 86400)}d ago"


def ktok(n):
    if n >= 1e6:
        return f"{n / 1e6:.1f}M"
    if n >= 1e3:
        return f"{n / 1e3:.0f}k"
    return str(int(n))


# ---------------------------------------------------------------- snapshots

def snapshot_from_statusline(raw):
    """Normalise the statusLine stdin JSON into the fields we care about."""
    rl = raw.get("rate_limits") or {}
    cw = raw.get("context_window") or {}
    ctx = pct(cw.get("used_percentage"))
    if ctx is None and cw.get("context_window_size"):
        cu = cw.get("current_usage") or {}
        used = sum(cu.get(k) or 0 for k in ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"))
        ctx = 100 * used / cw["context_window_size"] if used else None

    def window(key):
        w = rl.get(key) or {}
        p = pct(w.get("used_percentage", w.get("utilization")))
        return {"pct": p, "resets": epoch(w.get("resets_at"))} if p is not None else None

    return {
        "ts": NOW,
        "session": raw.get("session_id"),
        "model": (raw.get("model") or {}).get("display_name"),
        "cost": (raw.get("cost") or {}).get("total_cost_usd"),
        "ctx": ctx,
        "five_hour": window("five_hour"),
        "seven_day": window("seven_day"),
    }


def scan_account(name):
    """Rejections and active sessions from transcripts. Cached for 2 minutes."""
    cache_path = os.path.join(STATE, f"scan-{name}.json")
    cache = read_json(cache_path)
    if cache and NOW - cache["ts"] < 120:
        return cache
    base = os.path.join(acct_dir(name), "projects")
    blocked, active = {}, []
    for f in glob.glob(os.path.join(base, "*", "*.jsonl")):
        mtime = os.path.getmtime(f)
        if NOW - mtime < CFG["active_session_minutes"] * 60:
            active.append(os.path.basename(f)[:-6])
        if NOW - mtime > 8 * 86400:
            continue
        try:
            with open(f, errors="ignore") as fh:
                for line in fh:
                    if '"quotaLimits"' not in line:
                        continue
                    q = json.loads(line).get("quotaLimits") or {}
                    kind, reset = q.get("rateLimitType"), epoch(q.get("resetsAt"))
                    if q.get("status") == "rejected" and kind and reset and reset > NOW:
                        blocked[kind] = max(blocked.get(kind, 0), reset)
        except (OSError, ValueError):
            continue
    data = {"ts": NOW, "blocked": blocked, "active": active}
    write_json(cache_path, data)
    return data


def agy_accounts(all_=False):
    accts = CFG["agy"].get("accounts") or [{"name": "agy", "home": "~"}]
    return [a for a in accts if all_ or a.get("enabled", True)]


def agy_home(a):
    return os.path.expanduser(a.get("home", "~"))


def agy_family(model):
    """Quota is per model family: gemini-* vs claude-*."""
    return "claude" if model.startswith("claude") else "gemini"


def agy_state():
    """{'accounts': {name: {last_ok, needs_login, exhausted: {family: ts}, last_error}}}"""
    st = read_json(os.path.join(STATE, "agy.json"), {})
    if "accounts" not in st:  # legacy single-account format
        st = {"accounts": {"agy": {k: v for k, v in st.items() if k == "last_ok"}}}
    return st


def agy_save(st):
    write_json(os.path.join(STATE, "agy.json"), st)


def agy_exhausted(ast, family):
    """Timestamp of an exhaustion that is still within the cooldown, else None."""
    until = (ast.get("exhausted_until") or {}).get(family)
    if until is not None:  # real reset time from /quota beats the blind cooldown
        return until if until > NOW else None
    ts = (ast.get("exhausted") or {}).get(family)
    if ts and NOW - ts < CFG["agy"].get("cooldown_minutes", 300) * 60:
        return ts
    return None


def agy_status_text():
    st = agy_state()["accounts"]
    parts = []
    for a in agy_accounts(all_=True):
        ast = st.get(a["name"], {})
        if not a.get("enabled", True):
            parts.append(f"{a['name']} off")
        elif ast.get("needs_login"):
            parts.append(f"{a['name']} NEEDS LOGIN")
        else:
            out = [f for f in ("gemini", "claude") if agy_exhausted(ast, f)]
            parts.append(f"{a['name']} " + (f"{'/'.join(out)} OUT" if out else "ok") + agy_quota_text(a["name"]))
    return " · ".join(parts)


def agy_ready(family):
    """Enabled accounts that can take a job in this model family right now."""
    st = agy_state()["accounts"]
    return [a for a in agy_accounts()
            if not st.get(a["name"], {}).get("needs_login") and not agy_exhausted(st.get(a["name"], {}), family)
            and not agy_low(a["name"], family)]


def agy_low(name, family):
    """Nearly out per the last /quota: starting a long job there just dies mid-run and the work is lost."""
    r = agy_remaining(name, family)
    lim = CFG["agy"].get("min_remaining_pct", 25)
    return bool(r) and (r[0] < lim / 2 or r[1] < lim)


# ---------------------------------------------------------------- live quota

QUOTA_PATH = os.path.join(STATE, "quota.json")
QUOTA_LOCK = threading.Lock()
USAGE_URL = "https://api.anthropic.com/api/oauth/usage"
AGY_GROUPS = {"gemini models": "gemini", "claude and gpt models": "claude"}


def quota_data():
    return read_json(QUOTA_PATH, {}) or {}


def quota_fresh():
    return NOW - quota_data().get("ts", 0) < CFG.get("quota_fresh_seconds", 300)


def live_window(w):
    """A window whose reset time has passed has reset: treat as 0% used."""
    if w and w.get("resets") and w["resets"] < NOW:
        return {"pct": 0.0, "resets": None}
    return w


def agy_remaining(name, family):
    """(weekly %, five-hour %) remaining from the last /quota, or None."""
    f = ((quota_data().get("agy") or {}).get(name) or {}).get(family)
    if not f or not f.get("week") or not f.get("five"):
        return None
    return f["week"]["remaining"], f["five"]["remaining"]


def agy_quota_text(name):
    parts = []
    for fam, tag in (("gemini", "G"), ("claude", "C")):
        r = agy_remaining(name, fam)
        if r:
            parts.append(f"{tag} wk{r[0]:.0f} 5h{r[1]:.0f}")
    return f" [{' | '.join(parts)}]" if parts else ""


def keychain_token(service):
    r = subprocess.run(["security", "find-generic-password", "-s", service, "-w"], capture_output=True, text=True)
    if r.returncode:
        return None
    try:
        d = json.loads(r.stdout)
    except ValueError:
        return None
    return (d.get("claudeAiOauth") or d).get("accessToken")


def fetch_claude_usage(name):
    svc = CFG["accounts"][name].get("keychain")
    tok = keychain_token(svc) if svc else None
    if not tok:
        return {"error": "no token in keychain (open a session on this account once)"}
    req = urllib.request.Request(USAGE_URL, headers={"Authorization": f"Bearer {tok}",
                                 "anthropic-beta": "oauth-2025-04-20", "User-Agent": "claude-control/1"})
    try:
        data = json.load(urllib.request.urlopen(req, timeout=20))
    except Exception as e:
        return {"error": f"usage API: {e} (token may be expired — open a session on this account)"}

    def win(key):
        d = data.get(key)
        return {"pct": float(d["utilization"]), "resets": epoch(d["resets_at"])} if d and d.get("utilization") is not None else None
    return {"ts": time.time(), "five_hour": win("five_hour"), "seven_day": win("seven_day")}


def fetch_agy_quota(acct):
    try:
        proc = agy_run(acct, [os.path.expanduser(CFG["agy"]["bin"]), "-p", "/quota"], "/tmp", timeout=150)
    except subprocess.TimeoutExpired:
        return {"error": "timeout"}
    out, fams = proc.stdout, {}
    for line in out.splitlines():
        cols = line.split("\t")
        if len(cols) < 4:
            continue
        fam = AGY_GROUPS.get(cols[0].strip().lower())
        rem = cols[2].strip().rstrip("%")
        if not fam or not rem.replace(".", "").isdigit():
            continue
        key = "week" if "weekly" in cols[1].lower() else "five"
        fams.setdefault(fam, {})[key] = {"remaining": float(rem), "resets": epoch(cols[3].strip())}
    if not fams:
        low = (proc.stderr + out).lower()
        return {"error": "needs login" if "authentication" in low else (proc.stderr + out).strip()[-200:] or "no output",
                "needs_login": "authentication" in low}
    fams["ts"] = time.time()
    return fams


def apply_agy_quota(name, q):
    """Make the router's exhausted / needs-login flags agree with the real /quota numbers."""
    st = agy_state()
    ast = st["accounts"].setdefault(name, {})
    if q.get("needs_login"):
        ast["needs_login"] = True
    elif not q.get("error"):
        ast.pop("needs_login", None)
        for fam in ("gemini", "claude"):
            f = q.get(fam)
            if not f:
                continue
            ast.setdefault("exhausted", {}).pop(fam, None)
            ast.setdefault("exhausted_until", {}).pop(fam, None)
            out = [w for w in f.values() if isinstance(w, dict) and w["remaining"] <= 2]
            if out:
                ast["exhausted_until"][fam] = max((w["resets"] or NOW + 3600) for w in out)
    agy_save(st)


def quota_update(section, name, value):
    with QUOTA_LOCK:
        d = quota_data()
        old = (d.get(section) or {}).get(name) or {}
        if value.get("error"):  # keep the last good numbers, mark the error
            value = {**old, "error": value["error"], "needs_login": value.get("needs_login", False)}
        d.setdefault(section, {})[name] = value
        d["ts"] = time.time()
        write_json(QUOTA_PATH, d)


def cmd_quota(args):
    """Refresh live limits for every Claude + agy account (parallel), then print them."""
    if "--cached" not in args:
        jobs = [("claude", n) for n in CFG["accounts"]] + [("agy", a["name"]) for a in agy_accounts()]
        acct_by = {a["name"]: a for a in agy_accounts()}

        def run(job):
            kind, name = job
            if kind == "claude":
                quota_update("claude", name, fetch_claude_usage(name))
            else:
                q = fetch_agy_quota(acct_by[name])
                apply_agy_quota(name, q)
                quota_update("agy", name, q)
        with ThreadPoolExecutor(max_workers=len(jobs)) as ex:
            list(ex.map(run, jobs))
    if "--json" in args:
        print(json.dumps(quota_data(), indent=2))
        return
    d = quota_data()
    for n, c in (d.get("claude") or {}).items():
        f, w = live_window(c.get("five_hour")), live_window(c.get("seven_day"))
        print(f"{n:<7} 5h {window_text('', f, None).strip()} · week {window_text('', w, None).strip()} (used)" + (f"  ! {c['error']}" if c.get("error") else ""))
    for n, a in (d.get("agy") or {}).items():
        print(f"{n:<7} {agy_quota_text(n).strip() or '?'} (remaining)" + (f"  ! {a['error']}" if a.get("error") else ""))


def kick_quota_refresh():
    """Called from the hook: refresh in the background when the numbers are old."""
    if quota_fresh():
        return
    lock = os.path.join(STATE, "quota.lock")
    if os.path.exists(lock) and NOW - os.path.getmtime(lock) < 180:
        return
    open(lock, "w").close()
    subprocess.Popen([sys.executable, os.path.abspath(__file__), "quota"], stdout=subprocess.DEVNULL,
                     stderr=subprocess.DEVNULL, start_new_session=True)


# ---------------------------------------------------------------- budget text

def window_text(label, w, blocked_until):
    if blocked_until:
        return f"{label} BLOCKED → {when(blocked_until)}"
    if not w:
        return f"{label} ?%"
    return f"{label} {w['pct']:.0f}%" + (f" → {when(w['resets'])}" if w.get("resets") else "")


def account_lines(name, snap, scan, current):
    a = CFG["accounts"][name]
    tag = f"{name.upper()} ({a['plan']}, {a['role']})"
    if not snap and not scan["blocked"]:
        return f"{tag}: no data yet"
    snap = snap or {}
    parts = [
        window_text("5h", snap.get("five_hour"), scan["blocked"].get("five_hour")),
        window_text("week", snap.get("seven_day"), scan["blocked"].get("seven_day")),
    ]
    if current and snap.get("ctx") is not None:
        parts.append(f"ctx {snap['ctx']:.0f}%")
    if not current and snap.get("ts"):
        parts.append(f"seen {ago(snap['ts'])}")
    parts.append(f"active sessions {len(scan['active'])}")
    return f"{tag}: " + " · ".join(parts)


def alerts(name, snap, scan):
    out = []
    a = CFG["accounts"][name]
    for kind, until in scan["blocked"].items():
        out.append(f"{name.upper()} {kind} limit is EXHAUSTED until {when(until)}.")
    for key, label in (("five_hour", "5h"), ("seven_day", "weekly")):
        w = (snap or {}).get(key)
        if not w or key in scan["blocked"]:
            continue
        if w["pct"] >= TH["stop_pct"]:
            out.append(f"{name.upper()} {label} at {w['pct']:.0f}%: STOP big work, finish/hand off only.")
        elif w["pct"] >= TH["ask_pct"]:
            out.append(f"{name.upper()} {label} at {w['pct']:.0f}%: ask the user before any Medium+ task.")
        elif w["pct"] >= TH["warn_pct"]:
            out.append(f"{name.upper()} {label} at {w['pct']:.0f}%: prefer Sonnet/Haiku/agy.")
    if len(scan["active"]) > 1:
        out.append(f"{len(scan['active'])} {name.upper()} sessions active — they share one limit.")
    return out


def budget_lines(current):
    lines, warn = [], []
    for name in CFG["accounts"]:
        snap = read_json(os.path.join(STATE, f"{name}.json"))
        q = (quota_data().get("claude") or {}).get(name)
        if q and q.get("ts") and (not snap or q["ts"] > snap.get("ts", 0)):
            snap = {**(snap or {}), "five_hour": q.get("five_hour"), "seven_day": q.get("seven_day"), "ts": q["ts"]}
        if snap:
            snap = {**snap, "five_hour": live_window(snap.get("five_hour")), "seven_day": live_window(snap.get("seven_day"))}
        scan = scan_account(name)
        lines.append(("▶ " if name == current else "  ") + account_lines(name, snap, scan, name == current))
        warn += alerts(name, snap, scan)
    ready = agy_ready("gemini")
    week = agy_tokens(7)
    lines.append(f"  AGY (Gemini): {agy_status_text()} · 7d {ktok(week)} tok")
    if ready:
        lines.append(f"  ROUTE: {len(ready)} agy account(s) have capacity — send reading, web, summaries, drafts AND Small / "
                     "self-contained Medium code changes to agy BEFORE Claude: `ctl.py agy sonnet|opus --write --cwd <repo> \"…\"` "
                     "(full access, no prompts: edits files, runs tests/linters; keep it on the repo via --cwd), then review the diff. Claude only for hard/ambiguous work.")
    return lines, warn


def agy_tokens(days, account=None):
    total = 0
    path = os.path.join(LEDGER, "agy.jsonl")
    if not os.path.exists(path):
        return 0
    for line in open(path):
        try:
            r = json.loads(line)
        except ValueError:
            continue
        if NOW - r["ts"] < days * 86400 and (account is None or r.get("account", "agy") == account):
            total += (r.get("usage") or {}).get("total_tokens", 0)
    return total


# ---------------------------------------------------------------- commands

def cmd_statusline(name):
    raw = json.loads(sys.stdin.read() or "{}")
    write_json(os.path.join(STATE, f"{name}.statusline-raw.json"), raw)
    snap = snapshot_from_statusline(raw)
    write_json(os.path.join(STATE, f"{name}.json"), snap)
    scan = scan_account(name)

    def w(label, key):
        if key in scan["blocked"]:
            return f"{label} BLOCKED→{when(scan['blocked'][key])}"
        v = snap.get(key)
        return f"{label} {v['pct']:.0f}%" if v else f"{label} ?"

    parts = [f"{name.upper()} {snap['model'] or ''}".strip()]
    if snap["ctx"] is not None:
        parts.append(f"ctx {snap['ctx']:.0f}%")
    if snap["cost"] is not None:
        parts.append(f"${snap['cost']:.2f}")
    parts += [w("5h", "five_hour"), w("wk", "seven_day")]
    others = []
    for other in CFG["accounts"]:
        if other == name:
            continue
        o = read_json(os.path.join(STATE, f"{other}.json")) or {}
        ob = scan_account(other)["blocked"]
        if "seven_day" in ob:
            others.append(f"{other} wk BLOCKED")
        elif o.get("seven_day"):
            others.append(f"{other} wk {o['seven_day']['pct']:.0f}%")
    total, ready = len(agy_accounts()), len(agy_ready("gemini"))
    others.append(f"agy {ready}/{total}" if ready < total else f"agy ok×{total}")
    active = len(scan["active"])
    if active > 1:
        others.append(f"{active} sessions")
    print(" · ".join(parts) + "  │  " + " · ".join(others))


def context_tokens(transcript):
    """Tokens the last assistant call carried (= what every next message re-sends)."""
    try:
        with open(transcript, "rb") as f:
            f.seek(0, 2)
            f.seek(max(0, f.tell() - 400_000))
            tail = f.read().decode(errors="ignore").splitlines()
    except OSError:
        return None
    for line in reversed(tail):
        if '"usage"' not in line or '"assistant"' not in line:
            continue
        try:
            d = json.loads(line)
        except ValueError:
            continue
        if d.get("isSidechain"):
            continue
        u = (d.get("message") or {}).get("usage") or {}
        n = sum(u.get(k) or 0 for k in ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"))
        if n:
            return n
    return None


# ---------------------------------------------------------------- task board (office UI + Manager)

BOARD_PATH = os.path.join(ROOT, "board.json")
MANAGER_PATH = os.path.join(STATE, "manager.json")
MANAGER_MARK = "MANAGER-MODE-ON"
BOARD_ID = None  # task the current `ctl.py agy` run reports to


def board_load():
    return read_json(BOARD_PATH, {}) or {"tasks": []}


def board_edit(fn):
    """Read-modify-write board.json under an exclusive lock (parallel agy runs write it too)."""
    import fcntl
    with open(BOARD_PATH + ".lock", "w") as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        b = board_load()
        out = fn(b)
        b["tasks"] = b.get("tasks", [])[-300:]
        write_json(BOARD_PATH, b)
        return out


def board_add(agent, title, **kw):
    tid = "t" + datetime.now().strftime("%m%d-%H%M%S") + f"-{os.getpid() % 1000:03d}"
    now = time.time()
    st = kw.get("status", "running")
    task = {"id": tid, "title": title.strip().splitlines()[0][:120] if title.strip() else "(untitled)",
            "agent": agent, "account": kw.get("account"), "status": st,
            "created": now, "updated": now, "finished": now if st in ("done", "failed") else None,
            "result": kw.get("result", ""), "repo": kw.get("repo"),
            "t3_task": kw.get("t3"), "key": kw.get("key")}
    board_edit(lambda b: b.setdefault("tasks", []).append(task))
    return tid


class _FindResult(tuple):
    def __bool__(self):
        return self[0] is not None

    def __getitem__(self, item):
        if isinstance(item, str) and self[0] is not None:
            return self[0][item]
        return super().__getitem__(item)

    def get(self, k, default=None):
        if self[0] is not None:
            return self[0].get(k, default)
        return default


def board_find(key=None, t3=None):
    """Find a task by key or t3 id. Returns (task_dict, index) or (None, -1)."""
    tasks = board_load().get("tasks", [])
    for i, t in enumerate(reversed(tasks)):
        if key and t.get("key") == key:
            return _FindResult((t, len(tasks) - 1 - i))
        if t3 and t.get("t3_task") == t3:
            return _FindResult((t, len(tasks) - 1 - i))
    return _FindResult((None, -1))


def board_update(tid, **fields):
    def fn(b):
        for t in b.get("tasks", []):
            if t["id"] == tid:
                t.update({k: v for k, v in fields.items() if v is not None})
                t["updated"] = time.time()
                if fields.get("status") in ("done", "failed") and not t.get("finished"):
                    t["finished"] = time.time()
                return True
        return False
    return board_edit(fn)


# ---------------------------------------------------------------- hook-based task tracking

def _agent_from_subagent(tool_input):
    """Map Claude Code subagent_type / model to an agent name for the board."""
    model = (tool_input.get("model") or "").lower()
    for tag in ("opus", "sonnet", "haiku"):
        if tag in model:
            return tag
    st = (tool_input.get("subagent_type") or "").lower()
    if st == "architect":
        return "opus"
    if st in ("scout", "explore"):
        return "haiku"
    return "sonnet"


def _extract_agent_id(resp, text):
    """Search tool_response dict/text for an agentId or agent_id value."""
    if isinstance(resp, dict):
        aid = resp.get("agentId") or resp.get("agent_id")
        if aid:
            return str(aid)
    if not text:
        return None
    for pat in (
        r'"(?:agentId|agent_id)"\s*:\s*"([^"]+)"',
        r'(?:agentId|agent_id)\s*[:=]\s*["\']?([a-zA-Z0-9_\-]+)["\']?',
    ):
        m = re.search(pat, text, re.I)
        if m:
            return m.group(1)
    return None


def _clean_result(val, maxlen=120):
    """First non-empty line stripped of markdown noise, capped at maxlen."""
    if not val:
        return ""
    if isinstance(val, dict):
        val = val.get("result") or val.get("output") or val.get("content") or val.get("summary") or json.dumps(val)
    if isinstance(val, list):
        texts = []
        for item in val:
            if isinstance(item, dict):
                texts.append(item.get("text") or "")
            else:
                texts.append(str(item))
        val = "\n".join(texts)
    for line in str(val).splitlines():
        line = re.sub(r'[*#>`]', '', line).strip()
        if line:
            return line[:maxlen]
    return ""


def _is_background(tool_input, resp_text, aid=None):
    """True if the sub-agent was launched asynchronously."""
    if tool_input.get("run_in_background"):
        return True
    if aid:
        return True
    if resp_text and re.search(r'async|launched', resp_text, re.I):
        return True
    return False


def _t3_map_agent(model):
    """Map T3 model string to board agent name."""
    model = (model or "").lower()
    if "opus" in model:
        return "opus"
    if "sonnet" in model:
        return "sonnet"
    if "haiku" in model:
        return "haiku"
    if "gemini" in model:
        return "agy-pro" if "high" in model else "agy-flash"
    return "sonnet"


def _t3_parse_response(raw):
    """Leniently parse T3 delegate_task response (JSON or text)."""
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, list):  # MCP result: [{"type": "text", "text": "{...json...}"}]
        for item in raw:
            txt = item.get("text") if isinstance(item, dict) else None
            try:
                d = json.loads(txt or "")
                if isinstance(d, dict) and d.get("taskId"):
                    return d
            except ValueError:
                pass
    text = str(raw or "")
    m = re.search(r'\{[^{}]*"taskId"[^{}]*\}', text, re.S)
    if m:
        try:
            return json.loads(m.group(0))
        except ValueError:
            pass
    try:
        d = json.loads(text)
        if isinstance(d, dict):
            return d
    except ValueError:
        pass
    out = {}
    for key in ("taskId", "status", "model", "summary"):
        m = re.search(rf'"{key}"\s*:\s*"([^"]*)"', text)
        if m:
            out[key] = m.group(1)
    return out


def cmd_track():
    """Hook handler: reads Claude Code hook JSON from stdin, dispatches on hook_event_name."""
    try:
        inp = json.loads(sys.stdin.read() or "{}")
        event = inp.get("hook_event_name") or ""
        tool_name = inp.get("tool_name") or ""
        tool_input = inp.get("tool_input") or {}
        tool_use_id = inp.get("tool_use_id") or ""
        tool_response = inp.get("tool_response")
        resp_text = json.dumps(tool_response) if isinstance(tool_response, (dict, list)) else str(tool_response or "")
        cwd = inp.get("cwd") or ""

        if event == "PreToolUse" and tool_name in ("Agent", "Task"):
            _track_pre_agent(tool_input, tool_use_id, cwd)
        elif event == "PostToolUse" and tool_name in ("Agent", "Task"):
            _track_post_agent(tool_input, tool_use_id, tool_response, resp_text)
        elif event == "PostToolUse" and re.match(r'^mcp__t3.code__delegate_task$', tool_name):
            _track_t3_delegate(tool_input, tool_response, resp_text, cwd)
        elif event == "SubagentStop":
            _track_subagent_stop(inp)
    except Exception:
        pass


def _track_pre_agent(tool_input, tool_use_id, cwd):
    desc = tool_input.get("description") or tool_input.get("prompt", "")
    agent = _agent_from_subagent(tool_input)
    repo = os.path.basename(cwd.rstrip("/\\")) if cwd else None
    board_add(agent, desc, key=tool_use_id, repo=repo, status="running")


def _track_post_agent(tool_input, tool_use_id, tool_response, resp_text):
    task, _ = board_find(key=tool_use_id)
    if not task:
        return
    aid = _extract_agent_id(tool_response, resp_text)
    if _is_background(tool_input, resp_text, aid):
        if aid:
            board_update(task["id"], agent_id=aid)
    else:
        result = _clean_result(tool_response or resp_text)
        board_update(task["id"], status="done", result=result)


def _track_subagent_stop(inp):
    agent_id = inp.get("agent_id") or (inp.get("tool_input") or {}).get("agent_id")
    if not agent_id:
        return
    for t in reversed(board_load().get("tasks", [])):
        if t.get("agent_id") == agent_id and t.get("status") == "running":
            board_update(t["id"], status="done")
            return


def _track_t3_delegate(tool_input, tool_response, resp_text, cwd=""):
    parsed = _t3_parse_response(tool_response or resp_text)
    task_id = parsed.get("taskId") or parsed.get("task_id") or ""
    if not task_id:
        return
    existing, _ = board_find(t3=task_id)
    if existing:
        return
    title = tool_input.get("title") or tool_input.get("task") or ""
    model = parsed.get("model") or (tool_input.get("target") or {}).get("model") or ""
    provider_id = (tool_input.get("target") or {}).get("providerInstanceId") or tool_input.get("providerInstanceId")
    agent = _t3_map_agent(model)
    status_raw = (parsed.get("status") or "").lower()
    account = provider_id
    repo = os.path.basename(cwd.rstrip("/\\")) if cwd else None
    if status_raw in ("completed", "failed", "cancelled", "error"):
        st = "done" if status_raw == "completed" else "failed"
        result = _clean_result(parsed.get("summary"))
        board_add(agent, title, t3=task_id, key=task_id, status=st,
                  result=result, account=account, repo=repo)
    else:
        board_add(agent, title, t3=task_id, key=task_id, status="running",
                  account=account, repo=repo)


def _handle_t3_completion(prompt):
    """Process T3 task completion notifications embedded in user prompts."""
    if not prompt or "Delegated task" not in prompt:
        return
    pat = re.compile(r'Delegated task (\S+) \((.*?)\) \[(completed|failed|cancelled|error)\]:\s*(.*)')
    lines = prompt.splitlines()
    for i, line in enumerate(lines):
        m = pat.search(line)
        if m:
            t3_id, _name, status_word, rest = m.groups()
            task, _ = board_find(t3=t3_id)
            if not task:
                continue
            res = rest.strip()
            if not res:
                for j in range(i + 1, min(i + 10, len(lines))):
                    if lines[j].strip():
                        res = lines[j].strip()
                        break
            result = _clean_result(res)
            st = "done" if status_word == "completed" else "failed"
            board_update(task["id"], status=st, result=result)


def cmd_board(args):
    usage = ('usage: ctl.py board add <agent> "<title>" [--repo R] [--account A] [--t3 TASKID] [--queued]\n'
             '       ctl.py board set <id> running|done|failed ["one-line result"]\n'
             '       ctl.py board list [--all]\n'
             "agents: agy-flash agy-pro agy-sonnet agy-opus sonnet opus haiku")
    if not args:
        sys.exit(usage)
    sub = args.pop(0)
    if sub == "add" and len(args) >= 2:
        agent, title, kw = args[0], args[1], {}
        rest = args[2:]
        while rest:
            a = rest.pop(0)
            if a == "--queued":
                kw["status"] = "queued"
            elif a in ("--repo", "--account", "--t3") and rest:
                kw[a[2:]] = rest.pop(0)
        print(board_add(agent, title, **kw))
    elif sub == "set" and len(args) >= 2:
        if args[1] not in ("queued", "running", "done", "failed"):
            sys.exit(usage)
        if not board_update(args[0], status=args[1], result=" ".join(args[2:])[:300] or None):
            sys.exit(f"no task {args[0]}")
    elif sub == "list":
        tasks = board_load().get("tasks", [])
        icon = {"queued": "🕓", "running": "⏳", "done": "✅", "failed": "❌"}
        live = [t for t in tasks if t["status"] in ("queued", "running")]
        old = [t for t in tasks if t["status"] in ("done", "failed")]
        show = live + (old if "--all" in args else old[-10:])
        if not show:
            print("board empty")
        for t in show:
            dur = (t.get("finished") or time.time()) - t["created"]
            print(f"{icon.get(t['status'], '?')} {t['id']}  {t['agent']:<10} {int(dur // 60)}m  {t['title'][:60]}"
                  + (f"  → {t['result'][:80]}" if t.get("result") else ""))
    else:
        sys.exit(usage)


def manager_sessions():
    return read_json(MANAGER_PATH, {}) or {}


def is_manager(session, transcript):
    """A session becomes the Manager once the user runs /manager (its text carries MANAGER_MARK)."""
    m = manager_sessions()
    if session and session in m:
        m[session] = NOW
        write_json(MANAGER_PATH, m)
        return True
    try:
        with open(transcript, errors="ignore") as f:
            # only the user's own messages count (an assistant/tool line may merely mention the mark)
            found = any(MANAGER_MARK in line and '"type":"user"' in line.replace(" ", "") and "tool_result" not in line
                        for line in f)
    except OSError:
        return False
    if found and session:
        m[session] = NOW
        write_json(MANAGER_PATH, m)
    return found


def budget_json():
    out = {}
    for name in CFG["accounts"]:
        snap = read_json(os.path.join(STATE, f"{name}.json")) or {}
        q = (quota_data().get("claude") or {}).get(name)
        if q and q.get("ts") and q["ts"] > snap.get("ts", 0):
            snap = {**snap, "five_hour": q.get("five_hour"), "seven_day": q.get("seven_day")}
        scan = scan_account(name)
        out[name] = {"role": CFG["accounts"][name]["role"], "five_hour": live_window(snap.get("five_hour")),
                     "seven_day": live_window(snap.get("seven_day")), "blocked": bool(scan["blocked"]),
                     "active": len(scan["active"])}
    st = agy_state()["accounts"]
    out["agy"] = []
    for a in agy_accounts(all_=True):
        row = {"name": a["name"], "enabled": a.get("enabled", True),
               "needs_login": bool(st.get(a["name"], {}).get("needs_login"))}
        for fam in ("gemini", "claude"):
            r = agy_remaining(a["name"], fam)
            row[fam] = {"week": 100 - r[0], "five": 100 - r[1]} if r else None
        out["agy"].append(row)
    return out


def _ghost_cleanup(tasks):
    """Mark tasks still 'running' with updated older than 3 hours as failed."""
    now = time.time()
    cutoff = now - 3 * 3600
    changed = False
    for t in tasks:
        if t.get("status") == "running" and (t.get("updated") or t.get("created", now)) < cutoff:
            t["status"] = "failed"
            t["result"] = "lost (no finish event)"
            t["finished"] = now
            t["updated"] = now
            changed = True
    return changed


def _session_title(path, cache):
    """First real user message text from a transcript, cached."""
    stem = os.path.splitext(os.path.basename(path))[0]
    if stem in cache and cache[stem]:
        return cache[stem]
    title = ""
    try:
        with open(path, errors="ignore") as f:
            for i, line in enumerate(f):
                if i >= 200:
                    break
                if '"type":"user"' not in line.replace(" ", "") and '"type": "user"' not in line:
                    continue
                try:
                    d = json.loads(line)
                except ValueError:
                    continue
                if d.get("type") != "user":
                    continue
                content = d.get("message", d).get("content") or d.get("content") or ""
                if isinstance(content, list):
                    content = " ".join(c.get("text", "") for c in content if isinstance(c, dict))
                content = str(content).strip()
                if content.startswith(("<", "Base directory for this skill", "This session is being continued",
                                       "Caveat:", "[Request interrupted")) or "tool_result" in content:
                    continue
                if content:
                    title = content[:60]
                    break
    except OSError:
        pass
    if title:
        cache[stem] = title
    return title


def _build_sessions():
    """Build session list from Claude Code transcripts modified in the last 15 min."""
    title_cache_path = os.path.join(STATE, "session-titles.json")
    title_cache = read_json(title_cache_path, {}) or {}
    mgr = manager_sessions()
    sessions = []
    now = time.time()
    cutoff = now - 15 * 60
    for name in CFG["accounts"]:
        base = os.path.join(acct_dir(name), "projects")
        if not os.path.isdir(base):
            continue
        for proj_dir in glob.glob(os.path.join(base, "*")):
            if not os.path.isdir(proj_dir):
                continue
            proj_name = os.path.basename(proj_dir)
            # strip -Users-<user>- prefix and Desktop-
            display = re.sub(r'^-Users-[^-]+-', '', proj_name)
            display = re.sub(r'^Desktop-', '', display)
            for f in glob.glob(os.path.join(proj_dir, "*.jsonl")):
                # skip subagent transcripts
                if os.sep + "subagents" + os.sep in f:
                    continue
                try:
                    mtime = os.path.getmtime(f)
                except OSError:
                    continue
                if mtime < cutoff:
                    continue
                sid = os.path.splitext(os.path.basename(f))[0]
                title = _session_title(f, title_cache)
                status = "working" if now - mtime < 90 else "idle"
                sessions.append({
                    "id": sid, "account": name, "project": display,
                    "title": title, "status": status,
                    "manager": sid in mgr,
                    "updated": mtime,
                })
    write_json(title_cache_path, title_cache)
    return sessions


def cmd_state_json():
    m = manager_sessions()
    last = max(m.values()) if m else None
    board_edit(lambda b: _ghost_cleanup(b.get("tasks", [])))
    tasks = board_load().get("tasks", [])
    sessions = []
    try:
        sessions = _build_sessions()
    except Exception:
        pass
    print(json.dumps({"now": time.time(), "tasks": tasks,
                      "manager": {"active": bool(last and NOW - last < 15 * 60), "last_seen": last},
                      "budget": budget_json(), "sessions": sessions}))


def cmd_hook(name):
    try:
        inp = json.loads(sys.stdin.read() or "{}")
    except ValueError:
        inp = {}
    kick_quota_refresh()
    # T3 completion in user prompts (fast, never breaks output)
    try:
        _handle_t3_completion(inp.get("prompt") or "")
    except Exception:
        pass
    lines, warn = budget_lines(name)
    ctx = context_tokens(inp.get("transcript_path") or "")
    manager = is_manager(inp.get("session_id"), inp.get("transcript_path") or "")
    if manager:
        lines.append("  MANAGER MODE: dispatch only. Tasks are logged to the board automatically by hooks (don't board add). "
                     "After a compaction run `ctl.py board list` to recover state. Office: http://localhost:2000"
                     + (f" · context {ktok(ctx)} (auto-compaction will handle it — do NOT ask for a new session)" if ctx else ""))
    elif ctx:
        new_at = CFG.get("new_session_tokens", 150_000)
        if ctx >= new_at:
            warn.insert(0, f"CONTEXT {ktok(ctx)} tokens (re-sent every message). At the START of your reply "
                           "tell the user in one line: 'Start a new session — this one costs "
                           f"{ktok(ctx)}/message.' Write a handoff to ~/.claude-control/handoffs/ "
                           "(done / next / key files) and give the path to paste into the new session.")
        elif ctx >= new_at * 0.6:
            lines.append(f"  context {ktok(ctx)} — suggest a new session when the current task ends")
    out = ["[budget " + datetime.now().strftime("%H:%M") + "]"] + lines
    if CFG["accounts"][name]["role"] == "reserve":
        warn.insert(0, "You are on the RESERVE account — only for overflow/emergencies; say so to the user.")
    if warn:
        out.append("ALERTS: " + " | ".join(warn))
    if CFG.get("style", "short") == "short":
        out.append("STYLE short: answer in ≤6 lines or a small table. Result first, no preamble, "
                   "no restating the task, no step-by-step narration. Details only if asked.")
    if CFG.get("tone") == "roast":
        out.append("TONE roast: talk to the user in Russian, like a mate in a chat — street slang, мат is fine "
                   "(блять, нахуй, пиздец, ёб твою…), roast them or their code when it's earned. Facts only: "
                   "no politeness, no 'отличный вопрос', no apologies, no filler. Roast the work, never who they are. "
                   "Only chat replies change: code, comments, commits, PR text, files, UI copy and prompts "
                   "to sub-agents/agy keep their normal language and neutral tone.")
    print("\n".join(out))


def cmd_status():
    lines, warn = budget_lines(None)
    print("\n".join(lines))
    for w in warn:
        print("⚠ " + w)
    for name in CFG["accounts"]:
        raw = read_json(os.path.join(STATE, f"{name}.statusline-raw.json"))
        if raw is not None and "rate_limits" not in raw:
            print(f"note: {name} status line gives no rate_limits — % comes only from rejections.")


def model_family(m):
    m = (m or "").lower()
    for fam in ("opus", "sonnet", "haiku", "fable"):
        if fam in m:
            return fam
    return m or "?"


def cmd_report(days=7):
    days = float(days)
    cutoff = NOW - days * 86400
    print(f"Usage, last {days:g} days\n")
    for name in CFG["accounts"]:
        base = os.path.join(acct_dir(name), "projects")
        seen = set()
        by_model = defaultdict(Counter)
        by_project = Counter()
        sub = Counter()
        for f in glob.glob(os.path.join(base, "**", "*.jsonl"), recursive=True):
            if os.path.getmtime(f) < cutoff:
                continue
            project = os.path.relpath(f, base).split(os.sep)[0].replace(f"-Users-{os.path.basename(os.path.expanduser('~'))}-", "").replace("Desktop-", "")
            is_sub = f"{os.sep}subagents{os.sep}" in f
            with open(f, errors="ignore") as fh:
                for line in fh:
                    if '"usage"' not in line or '"assistant"' not in line:
                        continue
                    try:
                        d = json.loads(line)
                    except ValueError:
                        continue
                    msg = d.get("message") or {}
                    u = msg.get("usage")
                    ts = epoch(d.get("timestamp"))
                    if not u or not ts or ts < cutoff or msg.get("model") == "<synthetic>":
                        continue
                    key = (msg.get("id"), d.get("requestId"))
                    if key in seen:
                        continue
                    seen.add(key)
                    fam = model_family(msg.get("model"))
                    c = by_model[fam]
                    c["in"] += (u.get("input_tokens") or 0) + (u.get("cache_creation_input_tokens") or 0)
                    c["cache"] += u.get("cache_read_input_tokens") or 0
                    c["out"] += u.get("output_tokens") or 0
                    c["calls"] += 1
                    by_project[project] += (u.get("output_tokens") or 0)
                    if is_sub or d.get("isSidechain"):
                        sub[fam] += u.get("output_tokens") or 0
        a = CFG["accounts"][name]
        print(f"== {name.upper()} ({a['plan']}, {a['role']})")
        if not by_model:
            print("   no usage\n")
            continue
        tot_out = sum(c["out"] for c in by_model.values()) or 1
        for fam, c in sorted(by_model.items(), key=lambda kv: -kv[1]["out"]):
            print(f"   {fam:<8} calls {c['calls']:>6}  in {ktok(c['in']):>7}  cache-read {ktok(c['cache']):>7}  "
                  f"out {ktok(c['out']):>7}  ({100 * c['out'] / tot_out:.0f}% of output)  subagents out {ktok(sub[fam])}")
        print("   top projects by output:", ", ".join(f"{p or '~'} {ktok(n)}" for p, n in by_project.most_common(6)))
        scan = scan_account(name)
        if scan["blocked"]:
            print("   BLOCKED NOW:", ", ".join(f"{k} until {when(v)}" for k, v in scan["blocked"].items()))
        print()
    print(f"== AGY (Gemini)\n   {days:g}d tokens {ktok(agy_tokens(days))}")
    path = os.path.join(LEDGER, "agy.jsonl")
    if os.path.exists(path):
        per = Counter()
        for line in open(path):
            r = json.loads(line)
            if r["ts"] >= cutoff:
                per[r["model"]] += (r.get("usage") or {}).get("total_tokens", 0)
        for m, n in per.most_common():
            print(f"   {m:<28} {ktok(n)}")
        for a in agy_accounts(all_=True):
            print(f"   account {a['name']:<8} {ktok(agy_tokens(days, a['name']))}")


def agy_sbpath(path):
    return os.path.realpath(path).replace("\\", "\\\\").replace('"', '\\"')


def agy_profile(acct, writable):
    """macOS seatbelt profile: everything allowed except file writes outside `writable` dirs, temp dirs
    and agy's own state. agy's built-in --sandbox is unusable headless (its writable set comes from
    permissions.allow globs it then rejects, and the model retries unsandboxed), so we wrap the process."""
    home = os.path.realpath(agy_home(acct))
    state = [".gemini", ".antigravity", ".config", ".cache", ".npm", ".local", "Library/Keychains",
             "Library/Caches", "Library/Logs", "Library/Application Support"]
    paths = ["/dev", "/private/tmp", "/private/var/folders"] + [os.path.join(home, x) for x in state] + list(writable)
    allow = " ".join(f'(subpath "{agy_sbpath(x)}")' for x in paths)
    return f"(version 1)(allow default)(deny file-write*)(allow file-write* {allow})"


def agy_run(acct, cmd, cwd, timeout=None, writable=None):
    env = dict(os.environ)
    if acct.get("home", "~") != "~":
        env["HOME"] = agy_home(acct)
        kc = os.path.join(agy_home(acct), "Library/Keychains/login.keychain-db")
        if os.path.exists(kc):  # per-account keychain has an empty password: unlock silently
            subprocess.run(["security", "unlock-keychain", "-p", "", kc], env=env, capture_output=True)
    if writable is not None:
        cmd = ["/usr/bin/sandbox-exec", "-p", agy_profile(acct, writable)] + cmd
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, env=env, timeout=timeout)


def agy_parse(proc):
    result = None
    for line in reversed(proc.stdout.strip().splitlines()):
        try:
            result = json.loads(line)
            break
        except ValueError:
            continue
    ok = proc.returncode == 0 and result and result.get("status") == "SUCCESS" \
        and bool((result.get("response") or "").strip())  # empty "success" counts as failure
    return result, bool(ok), (proc.stderr + proc.stdout)[-2000:]


def agy_classify(proc, result, ok):
    """ok | auth | quota | denied | hung | timeout | empty | error.
    Quota words are matched on stderr/error text only: stdout JSON holds uuids that can contain '429'."""
    low = (proc.stderr + " " + str((result or {}).get("error") or "")).lower()
    if ok:
        return "ok"
    if any(x in (low + proc.stdout.lower()) for x in ("authentication required", "authentication failed")):
        return "auth"
    if re.search(r"resource_exhausted|quota|rate limit|\b429\b", low):
        return "quota"
    if (result or {}).get("denied_actions"):
        return "denied"
    if "print timeout" in low:
        tokens = ((result or {}).get("usage") or {}).get("total_tokens") or 0
        return "timeout" if tokens else "hung"  # hung = backend never answered (0 tokens): the account/session is stuck
    if result and result.get("status") == "SUCCESS" and proc.returncode == 0:
        return "empty"
    return "error"


def agy_git_snapshot(cwd):
    try:
        p = subprocess.run(["git", "-C", cwd, "status", "--porcelain"], capture_output=True, text=True, timeout=20)
        return p.stdout if p.returncode == 0 else None
    except Exception:
        return None


AGY_RULES = {
    "read": "[Read-only task: do not create, modify or delete any file. Shell commands for inspection/tests are fine. "
            "Always end with a written answer, never an empty turn.] ",
    "write": "[Work only inside the current directory. Edit files, run tests/linters via shell as needed. "
             "Always end with a short written summary of what changed and what you ran, never an empty turn.] ",
    "web": "[Budget: at most ~15 tool calls and ~8 minutes. Then stop and write the answer from what you have, "
           "even if incomplete.] ",
}
AGY_NUDGES = {
    "empty": "Your last turn ended with no text. Reply now with your final answer in plain text.",
    "denied": "A shell command was denied. Do not run more commands; use file read/search tools only and answer now in plain text.",
    "timeout": "Time is up. Stop working and answer now in plain text with what you have so far.",
}


def cmd_agy(args):
    # full_access (config, default on): auto-approve everything with no seatbelt, so agy never stops to ask.
    # --sandbox opts back into the seatbelt (writes only in --cwd). --web runs always stay sandboxed.
    full = CFG["agy"].get("full_access", True)
    write, web, sandbox, cwd, timeout, forced = False, False, not full, os.getcwd(), CFG["agy"]["default_timeout"], None
    title = None
    no_board = False
    if not args:
        sys.exit("usage: ctl.py agy <tier> [--write] [--web] [--sandbox|--no-sandbox] [--account NAME] [--cwd DIR] [--timeout 600s] [--no-board] <prompt>")
    tier = args.pop(0)
    model = CFG["agy"]["models"].get(tier, tier)
    rest = []
    while args:
        a = args.pop(0)
        if a == "--write":
            write = True
        elif a == "--web":
            web = True
        elif a == "--no-sandbox":
            sandbox = False
        elif a == "--sandbox":
            sandbox, full = True, False
        elif a == "--account":
            forced = args.pop(0)
        elif a == "--cwd":
            cwd = os.path.expanduser(args.pop(0))
        elif a == "--timeout":
            timeout = args.pop(0)
        elif a == "--title":
            title = args.pop(0)
        elif a == "--no-board":
            no_board = True
        else:
            rest.append(a)
    prompt = " ".join(rest)
    if prompt == "-":
        prompt = sys.stdin.read()
    global BOARD_ID
    if no_board:
        BOARD_ID = None
    elif os.environ.get("CTL_BOARD_ID"):
        BOARD_ID = os.environ["CTL_BOARD_ID"]
        board_update(BOARD_ID, status="running", agent=f"agy-{tier}")
    else:
        BOARD_ID = board_add(f"agy-{tier}", title or re.sub(r"\s+", " ", prompt)[:90],
                             repo=os.path.basename(cwd.rstrip("/")) if not web else "web")
    if web:
        # Web tools need approval that headless mode can't ask for. Run them in an empty scratch
        # folder so auto-approval can't touch any repo.
        cwd = "/tmp/agy-web"
        os.makedirs(cwd, exist_ok=True)
        sandbox = True
    prompt = AGY_RULES["web" if web else "write" if write else "read"] + prompt
    # Headless mode can't ask for approval, so any non-allowlisted shell command is auto-denied and the turn ends
    # EMPTY (the root cause of most "empty answer" failures). So: auto-approve, but run agy under a seatbelt
    # profile where file writes are only possible in --cwd (write runs) or nowhere (read-only/web runs) + temp dirs.
    sandbox = sandbox and os.path.exists("/usr/bin/sandbox-exec")
    flags = (["--mode", "accept-edits"] if write else []) + (["--dangerously-skip-permissions"] if (sandbox or full) else [])
    writable = ([cwd] if (write or web) else []) if sandbox else None

    def build(m, text, tmo, conv=None):
        c = [os.path.expanduser(CFG["agy"]["bin"]), "-p", text, "--model", m, "--output-format", "json",
             "--print-timeout", tmo] + flags
        return c + (["--conversation", conv] if conv else [])

    def candidates_for(m):
        fam = agy_family(m)
        if forced:
            cs = [a for a in agy_accounts(all_=True) if a["name"] == forced]
            if not cs:
                sys.exit(f"unknown agy account {forced!r}; have: {', '.join(a['name'] for a in agy_accounts(all_=True))}")
            return cs
        ast_all = agy_state()["accounts"]

        def room(a):
            r = agy_remaining(a["name"], fam)
            return -min(r) if r else -50  # most real quota left first; unknown = middle
        # accounts that recently hung go last; then most quota left; then least-used (last 24h)
        return sorted(agy_ready(fam), key=lambda a: (NOW - (ast_all.get(a["name"]) or {}).get("hung", 0) < 900,
                                                     room(a), agy_tokens(1, a["name"])))

    plans = [(tier, model)]
    fb_tier = "sonnet" if agy_family(model) == "gemini" else "flash"
    fb_model = CFG["agy"]["models"].get(fb_tier)
    if fb_model and fb_model != model:
        plans.append((fb_tier, fb_model))

    # a model family that hung (0 tokens until timeout) in the last 10 min is probably down for every account:
    # try the other family first instead of burning another full timeout
    if not forced and len(plans) > 1 and NOW - (agy_state().get("hung_family") or {}).get(agy_family(model), 0) < 600:
        plans.reverse()
        print(f"[agy: {agy_family(model)} models hung recently, trying {plans[0][1]} first]", file=sys.stderr)

    before = None if (write or web) else agy_git_snapshot(cwd)
    notes, last, attempts = [], None, 0

    def record(name, m, t, proc, result, ok, kind, nudge):
        rec = {"ts": NOW, "account": name, "model": m, "tier": t, "cwd": cwd, "write": write, "ok": ok, "kind": kind,
               "nudge": nudge, "usage": (result or {}).get("usage"), "seconds": (result or {}).get("duration_seconds"),
               "conversation": (result or {}).get("conversation_id")}
        if (result or {}).get("denied_actions"):
            rec["denied"] = [d.get("display_name") for d in result["denied_actions"]]
        with open(os.path.join(LEDGER, "agy.jsonl"), "a") as f:
            f.write(json.dumps(rec) + "\n")
        if BOARD_ID:
            board_update(BOARD_ID, account=name)

    for ptier, pmodel in plans:
        family = agy_family(pmodel)
        cands = candidates_for(pmodel)
        if not cands:
            notes.append(f"no {family} account available")
            continue
        for acct in cands:
            if attempts >= 5:
                break
            name = acct["name"]
            tmo, text, conv = timeout, prompt, None
            for nudge in (False, True):
                attempts += 1
                proc = agy_run(acct, build(pmodel, text, tmo, conv), cwd, writable=writable)
                result, ok, err_text = agy_parse(proc)
                kind = agy_classify(proc, result, ok)
                record(name, pmodel, ptier, proc, result, ok, kind, nudge)
                st = agy_state()
                ast = st["accounts"].setdefault(name, {})
                if kind == "ok":
                    for k in ("needs_login", "last_error", "hung"):
                        ast.pop(k, None)
                    (ast.get("exhausted") or {}).pop(family, None)
                    ast["last_ok"] = NOW
                    agy_save(st)
                    u = result.get("usage") or {}
                    print(result.get("response", "").rstrip())
                    if BOARD_ID:
                        resp = result.get("response", "").strip().splitlines()
                        board_update(BOARD_ID, status="done", result=(resp[-1] if resp else "done")[:200])
                    if before is not None:
                        after = agy_git_snapshot(cwd)
                        if after is not None and after != before:
                            print("\n[WARNING: read-only run changed the working tree — check `git status`]")
                    extra = []
                    if nudge:
                        extra.append("answered after a nudge")
                    if notes:
                        extra.append("fell back: " + "; ".join(notes))
                    print(f"\n[{name} {ptier}={pmodel} · {ktok(u.get('total_tokens', 0))} tok · "
                          f"{(result.get('duration_seconds') or 0):.0f}s · conversation {result.get('conversation_id')}"
                          + (" · " + " · ".join(extra) if extra else "") + "]")
                    return
                denied = [d.get("display_name") for d in (result or {}).get("denied_actions") or []]
                hint = ""
                if kind == "denied":
                    hint = f" (denied: {', '.join(denied)}; headless can't approve — retry without --no-sandbox)"
                last = {"name": name, "kind": kind, "rc": proc.returncode, "denied": denied,
                        "why": ((result or {}).get("error") or proc.stderr.strip()[-500:]
                                or ("empty response (no error given)" if kind == "empty" else err_text.strip()[-500:]))}
                if kind == "auth":
                    ast["needs_login"] = True
                    notes.append(f"{name} needs login")
                elif kind == "quota":
                    ast.setdefault("exhausted", {})[family] = NOW
                    (ast.get("exhausted_until") or {}).pop(family, None)
                    ast["last_error"] = err_text.strip().splitlines()[-1] if err_text.strip() else "quota"
                    notes.append(f"{name} {family} quota out")
                elif kind == "hung":
                    ast["hung"] = NOW
                    st.setdefault("hung_family", {})[family] = NOW
                    notes.append(f"{name} hung (no reply in {tmo})")
                else:
                    ast["last_error"] = err_text.strip()[-600:]
                    notes.append(f"{name} {pmodel}: {kind}{hint}{' after nudge' if nudge else ''}")
                agy_save(st)
                # empty / denied / timed-out-with-progress: one cheap nudge in the same conversation
                cid = (result or {}).get("conversation_id")
                if nudge or kind not in AGY_NUDGES or not cid or proc.returncode not in (0, None):
                    break
                text, conv, tmo = AGY_NUDGES[kind], cid, "180s"
            if last and last["kind"] == "hung" and not forced:
                break  # same model family will most likely hang on the other accounts too: go to the fallback model
    msg = f"[agy: all attempts failed] {'; '.join(notes) or 'no account available'} · {agy_status_text()}"
    if last:
        msg += f"\n  last: {last['name']} {last['kind']} rc={last['rc']}"
        if last["denied"]:
            msg += f" denied_actions={last['denied']}"
        msg += f" — {last['why'][:500]}"
    print(msg)
    if BOARD_ID:
        board_update(BOARD_ID, status="failed", result="; ".join(notes)[:200] or "no account available")
    sys.exit(1)


def cmd_agy_check(args):
    """Probe every account with a tiny prompt; refreshes login/quota state."""
    cmd = [os.path.expanduser(CFG["agy"]["bin"]), "-p", "reply: ok", "--model", CFG["agy"]["models"]["flash-low"],
           "--output-format", "json", "--print-timeout", "90s"]
    st = agy_state()
    for acct in agy_accounts(all_=True):
        name = acct["name"]
        if not acct.get("enabled", True) and name not in args:
            print(f"{name:<6} disabled")
            continue
        if not os.path.isdir(agy_home(acct)):
            print(f"{name:<6} home missing: {agy_home(acct)}")
            continue
        proc = agy_run(acct, cmd, "/tmp")
        _, ok, err = agy_parse(proc)
        ast = st["accounts"].setdefault(name, {})
        if ok:
            ast.pop("needs_login", None)
            ast["last_ok"] = NOW
            print(f"{name:<6} ok")
        elif "authentication" in err.lower():
            ast["needs_login"] = True
            print(f"{name:<6} NEEDS LOGIN → ai agy login {name}")
        else:
            print(f"{name:<6} failed: {err.strip()[-200:]}")
    agy_save(st)


def cmd_agy_list(_args):
    st = agy_state()["accounts"]
    for a in agy_accounts(all_=True):
        ast = st.get(a["name"], {})
        print(f"{a['name']:<6} {'on ' if a.get('enabled', True) else 'off'}  24h {ktok(agy_tokens(1, a['name'])):>7}  "
              f"7d {ktok(agy_tokens(7, a['name'])):>7}  {agy_home(a)}  "
              + ("NEEDS LOGIN" if ast.get("needs_login") else ""))


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    cmd, args = sys.argv[1], sys.argv[2:]
    try:
        if cmd == "statusline":
            cmd_statusline(args[0])
        elif cmd == "hook":
            cmd_hook(args[0])
        elif cmd == "status":
            cmd_status()
        elif cmd == "report":
            cmd_report(*args[:1])
        elif cmd == "agy":
            try:
                cmd_agy(args)
            finally:  # crash / Ctrl-C: don't leave a ghost "running" task on the board
                if BOARD_ID and any(t["id"] == BOARD_ID and t["status"] == "running" for t in board_load().get("tasks", [])):
                    board_update(BOARD_ID, status="failed", result="agy run aborted")
        elif cmd == "quota":
            cmd_quota(args)
        elif cmd == "agy-check":
            cmd_agy_check(args)
        elif cmd == "agy-list":
            cmd_agy_list(args)
        elif cmd == "board":
            cmd_board(args)
        elif cmd == "track":
            cmd_track()
        elif cmd == "state-json":
            cmd_state_json()
        else:
            sys.exit(__doc__)
    except Exception as e:  # never break the status line or the prompt
        if cmd == "track":
            sys.exit(0)
        elif cmd in ("statusline", "hook"):
            print(f"[ctl error: {e}]")
        else:
            raise


if __name__ == "__main__":
    main()
