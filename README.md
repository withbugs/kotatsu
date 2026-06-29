# KOTATSU

KOTATSU is a Japanese web magazine about adult clothing, weekend time, tools, places, and everyday style.

The magazine is operated as a monthly issue. Each month has one editorial theme, and the issue grows through weekly articles until it is complete at the end of the month.

## Editorial System

This repository starts with an AI editorial room:

- Editorial roles are defined in [docs/editorial/ai-editorial-room.md](docs/editorial/ai-editorial-room.md).
- Candidate memos are created by the editor-in-chief in [docs/editorial/candidates](docs/editorial/candidates) when monthly issue planning starts.
- Approved issue plans live in [docs/editorial/plans](docs/editorial/plans) after editor-in-chief or user approval.
- Issue-driven workflow rules are defined in [docs/editorial/agent-workflow.md](docs/editorial/agent-workflow.md).
- AI-generated visual rules are defined in [docs/editorial/ai-visual-policy.md](docs/editorial/ai-visual-policy.md).
- Reusable agent role cards live in [.agents/kotatsu](.agents/kotatsu).

## Monthly Issue Workflow

The key production mechanism for KOTATSU is Codex scheduled automation. Each AI agent runs at a fixed time, checks GitHub Issues, and only works on tasks that match its role label. GitHub Issues are used as the editorial task board, while labels and milestones carry the handoff state between roles.

The scheduled automation settings themselves live in the local Codex app. This repository stores the durable production rules, role cards, issue labels, scripts, and CI/CD workflows. If the project moves to another machine, recreate the Codex scheduled automations from this README, `.agents/kotatsu`, and `docs/editorial`.

### Two-Day Production Schedule

All times are Japan Standard Time. The automations run every day, but a single article does not move from visual editing to publication in one evening. The fastest normal path is a two-day handoff with managing-editor checks between production roles.

| Production day | Time | Agent | Environment | Main responsibility |
| --- | --- | --- | --- | --- |
| Day 1 | 09:00 | Managing editor | local | Review the day, check labels, milestones, stalled tasks, and create the monthly planning Issue when needed. |
| Day 1 | 10:00 | Editor-in-chief | local | Decide the monthly editorial direction, article lineup, publishing order, tone, candidate memo, and formal plan. |
| Day 1 | 12:00 | Managing editor | local | Check approved plans and split them into article, visual, copy-editing, and publishing Issues. |
| Day 1 | 14:00 | STYLE / LIFE / WEEKEND / CULTURE / PEOPLE / SHOPPING writers | worktree | Draft assigned article Issues in isolated worktrees. |
| Day 1 | 16:00 | Managing editor | local | Review writer output and route article drafts to visual editing when ready. |
| Day 1 | 18:00 | Visual editor | local | Prepare AI-generated visuals, alt text, prompt summaries, metadata, and placement guidance, then return the Issue to `kotatsu:review`. |
| Day 2 | 09:00 | Managing editor | local | Review visual-editor output and route approved work to copy editing. |
| Day 2 | 11:00 | Copy editor | local | Check tone, readability, banned expressions, factual risk, and reader-facing trust issues, then return the Issue to `kotatsu:review`. |
| Day 2 | 12:00 | Managing editor | local | Review copy-editor output and route approved work to publishing preparation. |
| Day 2 | 13:00 | Publisher | local | Run publishing gates, build checks, screenshot checks, and GitHub Pages publishing preparation. |
| Day 2 | 16:00 | Managing editor | local | Review any publishing failures, revisions, or stalled handoffs and schedule the next step. |

The writer group runs at the same time because each writer uses an isolated worktree. Visual editing, copy editing, and publishing do not hand work directly to one another: each role finishes into `kotatsu:review`, and the managing editor decides whether the next role can safely receive `kotatsu:ready` or `kotatsu:publish`. If visual generation, copy editing, or publishing gates need revision, the item moves to the next available day instead of being rushed through.

### Handoff Rules

- A monthly GitHub milestone represents one magazine issue.
- Planning, article writing, AI visual work, copy editing, and publishing tasks are managed as GitHub Issues.
- Each agent only handles open Issues that have a milestone, `kotatsu:ready`, and that agent's own `agent:*` label.
- The managing editor owns the final decision to add or remove `kotatsu:ready`.
- When an agent starts, it removes `kotatsu:ready` and adds `kotatsu:running`.
- When an agent finishes, it comments with the result and moves the Issue to `kotatsu:review`.
- The managing editor reviews `kotatsu:review`, assigns the next `agent:*` label, and returns the Issue to `kotatsu:ready` when the next role can safely continue.
- Visual editing, copy editing, and publishing are separated by managing-editor desk checks; they do not directly pass `kotatsu:ready` to each other.
- Publishing tasks pass through `kotatsu:publish` and move to `kotatsu:done` only after the publishing gate succeeds.

### Publishing Cadence

Scheduled agents run every day, but that does not mean articles are published every day. Daily execution is for Issue cleanup, handoff, unblocking, and pre-publication checks. The publishing cadence remains one to two articles per week and four to eight articles per monthly issue.

The publisher must not manually change an article's `status` to `published`. Publishing must go through the scripted gate:

1. `pnpm publish:check -- --candidate=<slug>`
2. `pnpm article:publish -- --slug=<slug>`
3. `pnpm check`
4. `pnpm build`
5. `pnpm test:visual` when possible

After approved changes reach `main`, the GitHub Pages workflow deploys the site to the project URL.

### Visual Policy

KOTATSU does not use photographed assets. Photorealistic images, illustrations, collages, and article visuals are all AI-generated and must follow [docs/editorial/ai-visual-policy.md](docs/editorial/ai-visual-policy.md). Public pages must not make unfinished articles look complete or link to unpublished article pages.

## First Issue

ISSUE 001: Inaugural issue planning

## Site

The site is built with Astro and published as a GitHub Pages project site.

Local commands:

- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm test:visual`

GitHub Pages project URL:

- [https://withbugs.github.io/kotatsu/](https://withbugs.github.io/kotatsu/)
