# Agent control — routing & budget rules

Applies to every Claude Code session on this machine (MAIN `~/.claude`, SECOND `~/.claude-second`).
Tooling lives in `~/.claude-control/`. The user controls everything with the `ai` command.

## Reply style (when the budget block says `STYLE short` — the default)

- Result first. ≤ 6 lines, or one small table. No intro, no recap of the request.
- Don't narrate steps or explain the plan unless asked. Say what changed / what's next.
- Questions to the user: one line, with lettered options.
- Long material (plans, reports) goes into a file; reply with the path + 2-line summary.
- Subagent and agy prompts must ask for short answers too.

## Accounts and providers

| Pool | Plan | Role |
|---|---|---|
| MAIN (`~/.claude`) | Max 5x | Primary — the one account in regular use. All normal work. |
| SECOND (`~/.claude-second`) | Max 5x | **Reserve.** Emergencies / overflow only. Never suggest it for routine work. |
| AGY (Google Antigravity, Gemini) | separate Google quota, **several accounts** (`agy`, `agy2`, `agy3`…) rotated automatically by `ctl.py` | **First stop** for reading, web, summaries, drafts, boilerplate, tests, reviews; Claude models on Google quota when MAIN is out. Its quota is free capacity — use it. |

## Every message: read the `[budget …]` block

A hook puts a `[budget HH:MM]` block in your context with each pool's 5-hour / weekly %,
`BLOCKED → time` when a limit is exhausted, active session counts, and ALERTS.
`?%` means the number is unknown (no data yet) — say "unknown", never guess a %.

Act on it:
- **< 70%** — work normally, still route cheap.
- **70–85%** — prefer Sonnet/Haiku/agy; mention the % once.
- **≥ 85%** — before any Medium+ task, stop and ask the user (format below).
- **≥ 95% or BLOCKED** — no new big work. Finish/hand off. Offer agy, or the reset time.
- **More than one active session in the same pool** — tell the user the sessions share
  one limit and starting big work here eats into the others.
- **On SECOND** — say once that this is the reserve account; when MAIN is no longer
  BLOCKED, recommend switching back.

## Manager mode (T3 Code "Manager" thread)

**Only two providers: agy (all accounts) and Claude (MAIN, SECOND as reserve).** Never Grok, OpenCode, Codex or others.

When the user gives tasks in the Manager thread, **you are a dispatcher, not a worker**:
classify → pick target → `delegate_task` (mode `async`) → when the child finishes, report in ≤3 lines.
Do no repo reading or coding yourself beyond a quick look needed to write a good task prompt.

| Task | T3 target (`providerInstanceId` / `model`, effort) |
|---|---|
| Tiny lookup | Bash: `ctl.py agy flash --cwd <repo> "…"` |
| Draft code: tests, boilerplate, docs, docstrings, commit/PR text, simple refactors, config | Bash: `ctl.py agy flash --write --cwd <repo> "…"` (or `agy sonnet --write` for harder), then review the diff |
| Tiny on company code, run tests/lint, mechanical edit | `claudeAgent` / `claude-haiku-4-5` (thinking off) |
| Simple but needs judgement | `agy sonnet` first (Google quota); if it fails or is out → `claudeAgent` / `claude-sonnet-4-6`, effort low |
| Bulk read / summary / "where is X" / explain code / find usages | Bash: `~/.claude-control/bin/ctl.py agy flash --cwd <repo> "…"` |
| Web research / analyze a site / compare products | Bash: `ctl.py agy flash --web "…"` (deep: `agy pro --web`) |
| Small code change | `agy sonnet --write` (spec with files + the test/lint command to run), review the diff; if it fails twice → `claudeAgent` / `claude-sonnet-5-5`, effort low |
| Medium feature (one repo, clear spec) | `agy opus --write` (or `agy sonnet --write`), review the diff; ambiguous/design-heavy → `claudeAgent` / `claude-sonnet-5-5`, effort high |
| Large / cross-repo / hard bug | `claudeAgent` / `claude-opus-5-5` (plans, then uses its own subagents) |
| Code / plan review, second opinion | Bash: `ctl.py agy pro --cwd <repo> "…"`; important/risky diffs → `claudeAgent` / `claude-sonnet-5-5`, effort low |
| MAIN at ≥70% | prefer `agy sonnet`/`agy opus` for anything agy can do; keep Claude for hard/ambiguous work |
| MAIN BLOCKED | `agy sonnet`/`agy opus` → `claudeAgent_claude2` (SECOND, ask user first) |

`claudeAgent` = MAIN, `claudeAgent_claude2` = SECOND (reserve).
Every task prompt must be self-contained (repo path, goal, constraints from AGENTS.md that matter,
"reply in ≤10 lines: what changed, files, verified?"). Code changes: `runtimeMode` `auto-accept-edits`;
read-only work: `approval-required`. Several independent tasks → several async delegates at once.
Report format per finished task: `✅ <title> — <1-line result> (<model>)` or `❌ … — <why>`.

**Board + office.** Start a Manager with `/manager` in any T3 thread (the hook then stops the "new session" nag
there; auto-compaction handles size). Tasks are logged **automatically** from every chat (hooks on sub-agents,
T3 `delegate_task` and their completions; `ctl.py agy …` runs log themselves) — don't `board add` by hand.
After compaction run `ctl.py board list` first. The user watches it live at http://localhost:2000 (`ai office`, `ai board`).

## Classify the task first (one line, before work)

| Size | Examples | Route |
|---|---|---|
| **Tiny** | lookup, grep, one-line fix, explain a function | Do it yourself, or `scout` (Haiku). No subagent for <3 tool calls. |
| **Small** | one-file change, a test, a config edit | `agy sonnet --write`, review the diff (fallback `worker`) |
| **Medium** | feature inside one repo | clear spec → `agy opus/sonnet --write`, review diff, `scout` re-runs checks; unclear spec → plan yourself → `worker` builds |
| **Large** | cross-repo work, migrations, architecture | `architect` (Opus) plans + reviews; one or more `worker`s implement |
| **Bulk read** | "read these 10 files / this 70 KB plan and summarize" | `agy flash` — not Claude |
| **Draft / code** | tests, boilerplate, docs, mechanical refactors, Small + self-contained Medium changes | `agy flash/sonnet/opus --write`; Claude reviews the diff |
| **Web** | search, analyze a website, competitors, docs, prices | `agy flash --web` — never Claude WebSearch/WebFetch |
| **Review** | review a plan or diff, second opinion | `agy pro`; important diffs → Claude Sonnet |

**Hard rule:** reading, summaries, web work and first drafts go to agy; reviews go to agy pro. Claude quota is for
writing code and decisions. Use Claude for these only if agy fails — and say so.

Rules that save the most:
0. **Agy-first test:** before reading >2 files, running a web search, or writing >30 lines of boilerplate yourself, ask: "can agy do this and give me a short answer?" If yes, do that. Batch several questions into one agy call.
1. **Opus never reads or searches broadly.** Exploration → `agy flash` (preferred) or `scout`; you get the conclusion.
2. **Opus plans and reviews; Sonnet writes code.**
3. Big docs (`AGENTS.md`, `*-PLAN.md` 40–70 KB) only when the task needs them — and prefer
   `agy flash` to extract the part you need.
4. **Long sessions are the #1 cost.** Every call re-sends the whole context. When context
   passes ~50%, or a task is finished and a new unrelated one starts, tell the user:
   "start a fresh session" and write a short handoff (what's done, what's next, files).
5. Don't fan out subagents for Tiny work; each subagent costs a fresh context.
6. Effort: low for Tiny/Small, default for Medium, high only for Large/hard bugs.

## Using agy (Gemini) — multiple accounts

```bash
~/.claude-control/bin/ctl.py agy flash  --cwd <repo> "<prompt>"     # bulk read / summarize (cheap)
~/.claude-control/bin/ctl.py agy pro    --cwd <repo> "<prompt>"     # = Gemini 3.8 Flash High (3.1 Pro was removed from agy)
~/.claude-control/bin/ctl.py agy sonnet --cwd <repo> "<prompt>"     # Claude Sonnet on Google quota
~/.claude-control/bin/ctl.py agy opus   --cwd <repo> "<prompt>"     # Claude Opus on Google quota
# add --write to allow edits (accept-edits mode). Prompt "-" reads from stdin.
# add --account agy2 to force one account (default: least-used enabled account; auto-falls back on quota/login errors)
```
- Accounts live in `config.json` → `agy.accounts`. `ai agy list|check|add <name>|login <name>|on|off <name>`.
- Quota is tracked per account **and per model family** (gemini vs claude): an account out of Gemini can still serve `agy sonnet`.
- The `[budget]` block shows each agy account's state and a `ROUTE:` line when capacity is available — treat it as an instruction to offload.
- A `NEEDS LOGIN` account is skipped; tell the user to run `ai agy login <name>`.
- agy is read-only by default (can run shell commands, can't write files). `--write` lets it edit files **and run tests/linters**, with writes allowed only in `--cwd` + temp dirs (macOS seatbelt wrapper in ctl.py; network is open). Give it files + the exact check command; always review the diff (`git diff`) after.
- Empty answers: ctl.py now auto-approves shell commands (headless can't ask — a denied command used to end the turn empty), nudges once, then falls back to the next account and then the other model family. It prints `[agy: all attempts failed] …` with `denied_actions` if all fail.
- Each agy call costs ~12k input tokens of overhead on Google's quota, not Claude's — still batch questions into one call.
- Ask agy for **short** answers (bullets, file:line) so its output doesn't bloat your context.
- When MAIN is BLOCKED and the user wants to continue, offer `agy opus` / `agy sonnet` before SECOND.
- `--web` enables web search/read: runs sandboxed in an empty `/tmp/agy-web` (no repo access).
  Paste any repo content it needs into the prompt.
- agy runs with **full access** (auto-approve, no sandbox) so it never stops to ask; `--sandbox` restricts writes to `--cwd`. Config: `agy.full_access`.
- If it prints `[agy QUOTA EXHAUSTED …]`, tell the user and fall back to Claude.
- Output starting with `[agy: all attempts failed]` or `[agy: no account …]` = no answer. Never treat it as a result: report it, then fall back to `scout`/Claude once — don't retry agy in a loop.
- Valid agy models: flash, flash-low, flash-high, pro(=flash-high), sonnet, opus. Check with `agy models`.

## New session alert

The budget block shows `context Nk` and, past the limit (`new_session_tokens`, default 150k),
an ALERT. When it fires: first line of the reply = "Start a new session — this one costs Nk/message",
write `~/.claude-control/handoffs/<YYYY-MM-DD>-<topic>.md` (done / next / key files / decisions,
≤30 lines), and give the user the one line to paste: `Continue from ~/.claude-control/handoffs/<file>`.
Also suggest a new session whenever a task is finished and the next one is unrelated.

## Ask format (≥ 85%, or task looks bigger than what's left)

> 📊 **Large task** — rough estimate ~X% of MAIN's week (estimates are ±2×).
> MAIN week 86% → resets Thu 13:00 · 5h 40% · 2 MAIN sessions active.
> Options: **a)** plan only now · **b)** Sonnet-only (~Y%) · **c)** agy opus · **d)** wait for reset.

Rough estimates on Max 5x (MAIN, calibrate against `ctl.py report`): Tiny ≈ 0%, Small ≈ 1–2%,
Medium ≈ 4–12%, Large ≈ 20–60% of a week. (Max 20x would be a quarter of these.)

## End every substantive answer with one short line

`⛽ Sonnet+agy · MAIN wk 61%`

## User commands (`ai help`)

`ai` dashboard · `ai main|second [model]` start Claude · `ai gem` start agy · `ai ask flash [--web] "…"`
· `ai report` · `ai style short|normal` · `ai model …` · `ai warn 70 85 95` · `ai rules` / `ai config`
