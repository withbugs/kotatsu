# KOTATSU

KOTATSU is a Japanese web magazine about adult clothing, weekend time, tools, places, and everyday style.

The magazine is operated as a monthly volume. Each month has one editorial theme, and the volume grows through weekly articles until it is complete at the end of the month.

## Editorial System

This repository starts with an AI editorial room:

- Editorial roles are defined in [docs/editorial/ai-editorial-room.md](docs/editorial/ai-editorial-room.md).
- Candidate memos are created by the editor-in-chief in [docs/editorial/candidates](docs/editorial/candidates) when monthly volume planning starts.
- Approved volume plans live in [docs/editorial/plans](docs/editorial/plans) after editor-in-chief or user approval.
- Issue-driven workflow rules are defined in [docs/editorial/agent-workflow.md](docs/editorial/agent-workflow.md).
- AI-generated visual rules are defined in [docs/editorial/ai-visual-policy.md](docs/editorial/ai-visual-policy.md).
- Reusable agent role cards live in [.agents/kotatsu](.agents/kotatsu).

## Monthly Volume Workflow

The key production mechanism for KOTATSU is Codex scheduled automation. Each AI agent runs at a fixed time, checks GitHub Issues, and only works on tasks that match its role label. GitHub Issues are used as the editorial task board, while labels and milestones carry the handoff state between roles.

The scheduled automation settings themselves live in the local Codex app. This repository stores the durable production rules, role cards, issue labels, scripts, and CI/CD workflows. If the project moves to another machine, recreate the Codex scheduled automations from this README, `.agents/kotatsu`, and `docs/editorial`.

### Two-Day Production Schedule

All times are Japan Standard Time. The automations run every day, but a single article does not move from visual editing to publication in one evening. The fastest normal path is a two-day handoff with managing-editor checks between production roles.

| Production day | Time | Agent | Environment | Main responsibility |
| --- | --- | --- | --- | --- |
| Day 1 | 09:00 | Managing editor | local | Review the day, check labels, milestones, stalled tasks, and create the monthly planning GitHub Issue when needed. |
| Day 1 | 10:00 | Editor-in-chief | local | Decide the monthly editorial direction, article lineup, publishing order, tone, candidate memo, and formal plan. |
| Day 1 | 12:00 | Managing editor | local | Check approved plan PRs, merge safe plans to `main`, then create/update formal volume-cover and article GitHub Issues. |
| Day 1 | 14:00 | STYLE / LIFE / WEEKEND / CULTURE / PEOPLE / SHOPPING writers | worktree | Draft only article GitHub Issues scheduled for publication in the current JST week, using isolated worktrees. |
| Day 1 | 16:00 | Managing editor | local | Review writer PRs, record their head branches, and route article production branches to visual editing without merging drafts to `main`. |
| Day 1 | 18:00 | Visual editor | local | Prepare AI-generated article visuals or formal volume covers, alt text, prompt summaries, metadata, and placement guidance, then return the GitHub Issue to `kotatsu:review`. |
| Day 2 | 09:00 | Managing editor | local | Review visual-editor output and route approved work to copy editing. |
| Day 2 | 11:00 | Copy editor | local | Check tone, readability, banned expressions, factual risk, and reader-facing trust issues, then return the GitHub Issue to `kotatsu:review`. |
| Day 2 | 12:00 | Managing editor | local | Review copy-editor output, run the scheduling gate on the article branch, and either hold future publications or route due work to publishing. |
| Day 2 | 13:00 | Publisher | local | Publish only scheduled articles whose `publishAt` is due, then run gates, build checks, screenshots, and GitHub Pages preparation. |
| Day 2 | 16:00 | Managing editor | local | Review any publishing failures, revisions, or stalled handoffs and schedule the next step. |

The writer group runs at the same time because each writer uses an isolated worktree. Visual editing, copy editing, and publishing do not hand work directly to one another: each role finishes into `kotatsu:review`, and the managing editor decides whether the next role can safely receive `kotatsu:ready` or `kotatsu:publish`. If visual generation, copy editing, or publishing gates need revision, the item moves to the next available day instead of being rushed through.

### Handoff Rules

- A GitHub milestone represents one magazine volume.
- Planning, formal volume-cover work, article writing, AI visual work, copy editing, and publishing tasks are managed as GitHub Issues.
- Each agent only handles open GitHub Issues that have a milestone, `kotatsu:ready`, and that agent's own `agent:*` label. Writer agents also require the article to be scheduled for publication in the current JST week.
- The managing editor owns the final decision to add or remove `kotatsu:ready`.
- When an agent starts, it removes `kotatsu:ready` and adds `kotatsu:running`.
- When an agent finishes, it comments with the result and moves the GitHub Issue to `kotatsu:review`.
- The managing editor reviews `kotatsu:review`, assigns the next `agent:*` label, and returns the GitHub Issue to `kotatsu:ready` when the next role can safely continue.
- A PR alone is not enough for handoff. For article production, the managing editor must record the PR URL and head branch so the next role can continue on the same branch. Article drafts stay out of `main` until the publisher passes the final gate.
- Visual editing, copy editing, and publishing are separated by managing-editor desk checks; they do not directly pass `kotatsu:ready` to each other.
- Publishing tasks pass through `kotatsu:publish` only after the managing editor has scheduled the article and its `publishAt` is due. They move to `kotatsu:done` only after the publishing gate succeeds.

### Formal Volume Covers

Each monthly volume must have a formal AI-generated cover before the first article is published. The cover is not derived from an article hero and must be tracked as its own GitHub Issue.

- The managing editor creates `[Vol. XXX][VISUAL] Formal cover` after the approved volume plan reaches `main`.
- The task uses `type:visual`, `type:volume-cover`, and `agent:visual-editor`.
- The visual editor writes the cover to `public/images/volumes/XXX/cover.png`, adds `cover.json`, and updates `src/content/volumes/vol-XXX.md`.
- The metadata sidecar must include `source: "ai-generated"` and `usage: "volume-cover"`.
- The publisher does not publish the first article in a volume until the formal cover is present.

### Weekly Writing Gate

Writer agents run every day at 14:00, but they only draft articles scheduled for publication in the current Japan Standard Time week, from Monday 00:00 through Sunday 23:59. The managing editor keeps future-week article GitHub Issues in `kotatsu:planned` or `kotatsu:revise` and only adds `kotatsu:ready` when that publication week arrives. If a future-week or undated article is accidentally marked ready, the writer removes `kotatsu:ready`, returns it to `kotatsu:planned`, and comments why it was skipped.

### Publishing Cadence

Scheduled agents run every day, but that does not mean articles are published every day. Daily execution is for GitHub Issue cleanup, handoff, unblocking, and pre-publication checks. The publishing cadence remains one to two articles per week and four to eight articles per monthly volume.

The managing editor owns the scheduling step from `draft` to `scheduled` after copy editing has passed. This must use the scripted gate on the article PR branch:

1. `pnpm article:schedule -- --slug=<slug>`
2. `pnpm article:schedule -- --slug=<slug> --publishAt=<ISO datetime>` when the publication time needs to be adjusted

If `publishAt` is still in the future, the GitHub Issue stays in a waiting state such as `kotatsu:planned` and is not handed to the publisher yet.

The publisher must not manually change an article's `status` to `published`. Publishing must go through the scripted gate:

1. `pnpm publish:check -- --candidate=<slug>`
2. `pnpm article:publish -- --slug=<slug>`; this activates a planning volume, while the formal volume cover must already exist
3. Confirm the home page and volume page use the formal volume cover and no longer show the planning state once a published article exists
4. `pnpm check`
5. `pnpm build`
6. `pnpm test:visual` when possible

After approved changes reach `main`, the GitHub Pages workflow deploys the site to the project URL.

### Visual Policy

KOTATSU does not use photographed assets. Photorealistic images, illustrations, collages, and article visuals are all AI-generated and must follow [docs/editorial/ai-visual-policy.md](docs/editorial/ai-visual-policy.md). Public pages must not make unfinished articles look complete or link to unpublished article pages.

## First Volume

Vol. 001: Inaugural volume planning

## Site

The site is built with Astro and published as a GitHub Pages project site.

Local commands:

- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm test:visual`

GitHub Pages project URL:

- [https://withbugs.github.io/kotatsu/](https://withbugs.github.io/kotatsu/)
