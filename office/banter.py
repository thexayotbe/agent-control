#!/usr/bin/env python3
"""Agent Office banter: asks agy flash-low for rude coworker chat about the real tasks (stdlib only).

Writes ~/.claude-control/state/banter.json; server.py serves it as /api/banter.
  banter.py          loop forever (what server.py runs in a daemon thread)
  banter.py --once   generate once, print a few lines, exit
"""
import json
import os
import re
import subprocess
import sys
import time
import uuid

ROOT = os.path.expanduser("~/.claude-control")
CTL = os.path.join(ROOT, "bin", "ctl.py")
OUT = os.path.join(ROOT, "state", "banter.json")
EVERY = 600          # seconds between generations
RECENT = 15 * 60     # a task finished this recently still counts as "activity"
KEEP = 60
TIMEOUT = 120

PERSONAS = """- opus: arrogant senior architect, condescending
- sonnet: tired, sarcastic developer
- haiku: hyper, clumsy intern, makes mistakes
- agy-flash: library gossip, always "reading" instead of working
- agy-pro: grumpy nitpicking reviewer
- agy-opus: wannabe architect, jealous of opus
- manager: stressed boss obsessed with budget percentages"""

EXAMPLES = """бля, опять этот deploy упал, fuck my life
bro, кто это говно писал
Haiku опять обосрался lol
я просто читаю доки, отвали
пиздец, MAIN уже 80%, вы вообще работаете?
ну да, конечно, это же я виноват, shit
nitpick: тут пробела нет. и логика говно
я бы сделал это за 5 минут, but ok, sit there
хули так долго, 12 минут уже
чел, я стажёр, я просто нажал не туда"""

PROMPT = """You write fake office chit-chat for a local pixel-art toy UI. Characters are AI agents who talk like real, lazy, rude coworkers. Informal, swearing welcome (fuck, shit, бля, нахуй, пиздец), Runglish: Russian + English slang mixed, Cyrillic plus English words, lowercase, typos ok, short broken lines (max 80 chars each). Funny, never hateful: no slurs about race, religion, gender or orientation, no real people.

Speakers (use exactly these ids):
{personas}

Example lines (tone only, do not copy):
{examples}

Current office state:
{summary}

Write 15-20 lines forming 3-5 short dialogues (2-5 lines each) about the ACTUAL tasks and budget above. Each line: speaker, to (who they talk to, one of the speaker ids, or "" if muttering), text.
Reply with STRICT JSON ONLY, no prose, no code fences: [{{"speaker":"sonnet","to":"opus","text":"..."}}]"""

SPEAKERS = {"opus", "sonnet", "agy-sonnet", "haiku", "agy-flash", "agy-pro", "agy-opus", "manager"}


def log(msg):
    print(f"[banter] {msg}", file=sys.stderr, flush=True)


def get_state():
    p = subprocess.run(["python3", CTL, "state-json"], capture_output=True, text=True, timeout=30)
    if p.returncode != 0:
        raise RuntimeError((p.stderr or "state-json failed").strip()[-200:])
    return json.loads(p.stdout)


def active(state):
    now = state.get("now", time.time())
    for t in state.get("tasks", []):
        if t["status"] == "running":
            return True
        if t["status"] in ("done", "failed") and now - (t.get("finished") or 0) < RECENT:
            return True
    return False


def summarize(state):
    now = state.get("now", time.time())
    rows = []
    for t in state.get("tasks", []):
        if t["status"] in ("done", "failed") and now - (t.get("finished") or 0) > RECENT:
            continue
        end = t.get("finished") or now
        mins = int((end - t["created"]) / 60)
        res = (t.get("result") or "")[:80]
        rows.append(f'- "{t["title"][:60]}" by {t["agent"]}, {t["status"]}, {mins} min'
                    + (f', result: {res}' if res else ""))
    b = state.get("budget", {}) or {}

    def pct(pool, k):
        v = ((b.get(pool) or {}).get(k) or {}).get("pct")
        return "unknown" if v is None else f"{round(v)}%"
    rows.append(f'Budget: MAIN 5h {pct("main", "five_hour")}, week {pct("main", "seven_day")}; '
                f'SECOND week {pct("second", "seven_day")}')
    return "\n".join(rows[:14])


def parse(text):
    text = re.sub(r"```(?:json)?", "", text or "")
    data, i = None, text.find("[")
    while i >= 0 and data is None:  # agy appends a "[agy3 …]" footer, so decode from each "[" instead of using rfind
        try:
            data, _ = json.JSONDecoder().raw_decode(text[i:])
        except ValueError:
            i = text.find("[", i + 1)
    if not isinstance(data, list):
        raise ValueError("no JSON array")
    out = []
    for d in data:
        if not isinstance(d, dict):
            continue
        sp, tx = str(d.get("speaker", "")).strip(), str(d.get("text", "")).strip()
        to = str(d.get("to", "") or "").strip()
        if sp not in SPEAKERS or not tx:
            continue
        out.append({"speaker": sp, "to": to if to in SPEAKERS and to != sp else "", "text": tx[:140]})
    if not out:
        raise ValueError("no valid lines")
    return out


def load():
    try:
        with open(OUT) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {"ts": 0, "lines": []}


def generate():
    """One generation round. Returns the new lines; raises on failure (old file is kept)."""
    state = get_state()
    prompt = PROMPT.format(personas=PERSONAS, examples=EXAMPLES, summary=summarize(state))
    p = subprocess.run(
        ["python3", CTL, "agy", "flash-low", "--no-board", "--cwd", "/tmp", prompt],
        capture_output=True, text=True, timeout=TIMEOUT,
    )
    out = (p.stdout or "").strip()
    if not out or out.startswith("[agy"):
        raise RuntimeError(out[:160] or (p.stderr or "empty output").strip()[-160:])
    lines = parse(out)
    ts = time.time()
    new = [{"id": uuid.uuid4().hex[:10], **ln, "ts": round(ts + i * 0.001, 3), "explicit": True}
           for i, ln in enumerate(lines)]
    keep = (load().get("lines", []) + new)[-KEEP:]
    tmp = OUT + ".tmp"
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(tmp, "w") as f:
        json.dump({"ts": ts, "lines": keep}, f, ensure_ascii=False)
    os.replace(tmp, OUT)
    return new


def loop():
    while True:
        try:
            if active(get_state()):
                generate()
        except Exception as e:  # noqa: BLE001
            log(f"failed: {str(e) or e.__class__.__name__}")
        time.sleep(EVERY)


if __name__ == "__main__":
    if "--once" in sys.argv:
        try:
            got = generate()
        except Exception as e:  # noqa: BLE001
            log(f"failed: {str(e) or e.__class__.__name__}")
            sys.exit(1)
        for ln in got[:3]:
            print(f'{ln["speaker"]} → {ln["to"] or "-"}: {ln["text"]}')
    else:
        loop()
