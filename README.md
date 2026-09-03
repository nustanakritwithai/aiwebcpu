# AI CPU Web

AI CPU Web V0 is a browser-based prototype of a **CPU-first skill runtime**.

The first version intentionally contains **no embedded LLM or autonomous agent**. A user or external agent prepares a structured Thai command, then the web runtime:

1. parses State / Observation / Goal,
2. matches a CPU Skill,
3. simulates the workflow,
4. verifies the result,
5. stores Skill-oriented Memory / History in the browser,
6. escalates unknown states as `AGENT NEEDED`.

## Live site

GitHub Pages target:

`https://nustanakritwithai.github.io/aiwebcpu/`

## Master plan

See [`AI_CPU_WEB_V0_PLAN.md`](./AI_CPU_WEB_V0_PLAN.md).

## V0 principle

> Agent solves unknown problems. AI CPU remembers and executes known skills.

## Run locally

Open `index.html` directly in a modern browser, or serve the folder with any static web server.
