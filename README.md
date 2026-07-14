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
| Day 1 | 09:00 | Managing editor | local | Review labels, milestones, stalled work, and handoffs. On or after the second Monday, open exactly one planning Issue for the next calendar-month volume when it does not already exist. |
| Day 1 | 10:00 | Editor-in-chief | local | Handle assigned decisions and revisions. Every Monday, also hold an editorial meeting covering the current reader experience, seasonal coherence, and the next volume. |
| Day 1 | 12:00 | Managing editor | local | Hold research and shortlist work for the next Monday; only merge a finalized approved plan, then create formal cover and article Issues. |
| Day 1 | 14:00 | STYLE / LIFE / WEEKEND / CULTURE / PEOPLE / SHOPPING writers | worktree | Draft only article GitHub Issues scheduled for publication in the current JST week, using isolated worktrees. |
| Day 1 | 16:00 | Managing editor | local | Review writer PRs, record their head branches, and route article production branches to visual editing without merging drafts to `main`. |
| Day 1 | 18:00 | Visual editor | local | Prepare AI-generated visuals and verify the rendered image matches the publication month, climate, clothing layers, materials, light, and weather before returning the GitHub Issue to `kotatsu:review`. |
| Day 2 | 09:00 | Managing editor | local | Inspect the actual visual, including seasonal plausibility, and route only approved work to copy editing. |
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

- Completed article, formal cover, and publishing GitHub Issues should be closed after the result comment, PR, and public URL are recorded. Closed Issues remain production history; they are not active work.

### Volume Lifecycle

A volume does not progress based only on whether a volume-planning GitHub Issue is open. The source of truth is the combination of `src/content/volumes/vol-XXX.md`, the approved plan in `docs/editorial/plans/vol-XXX.md`, the milestone, and the article Issues for that volume.

The volume-planning GitHub Issue may be marked `kotatsu:done` and closed after the approved plan reaches `main` and the formal cover and article Issues have been created. Closing that planning Issue must not create a new volume by itself.

Planning and publishing use separate gates. Beginning on the second Monday of each month in Japan Standard Time, the managing editor may open exactly one planning Issue for the next calendar-month volume even while the current volume remains active. This gives the editor-in-chief enough lead time to develop the theme, seasonal point of view, lineup, and visual direction without exposing unfinished work to readers.

Before the second Monday, a new volume-planning Issue is created only for the initial repository bootstrap or when the user explicitly asks to start early. The managing editor must check existing open and closed planning Issues, milestones, approved plans, and volume content before creating anything. Closing a planning Issue never creates a replacement, and only one future volume may be in planning at a time.

For the next volume, the managing editor creates or reuses a milestone named `Vol. XXX YYYY年M月号`, then opens `[Vol. XXX][PLAN] YYYY年M月号テーマ検討` with `type:volume-plan`, `agent:editor-in-chief`, `planning:research`, and `kotatsu:ready`. The same Issue and draft planning PR remain open across all three meetings.

### Weekly Editorial Meeting

Every Monday at 10:00 JST, the editor-in-chief reviews the current reader experience and not-yet-started article briefs. Next-volume planning follows the same three-stage cycle every month:

| Monday | Planning label | Editorial outcome |
| --- | --- | --- |
| Second Monday | `planning:research` | Run current web searches, record demand signals and reader hypotheses, and create only the candidate memo on a draft planning PR. |
| Third Monday | `planning:shortlist` | Refresh the web research, compare candidates, and choose a provisional theme and lineup. The approved plan still does not exist. |
| Fourth Monday | `planning:finalize` | Refresh research once more, lock the theme, lineup, seasonal direction, and article briefs, then create the approved plan and make the planning PR ready for review. |

Research is mandatory at each stage. Candidate memos for Vol. 002 and later record at least three search queries and four dated web sources across at least three source types. Search and trend signals are treated as evidence of current demand, while the editor-in-chief separately explains how that demand fits KOTATSU and can become useful beyond a short-lived trend. If current web research is unavailable, planning does not advance on invented evidence.

At 12:00 after the second and third meetings, the managing editor holds the Issue in `kotatsu:planned` until the next Monday. Only after the fourth meeting may the managing editor merge the approved plan and create cover and article Issues. A fifth Monday, when present, is a preflight meeting rather than a new planning cycle.

Before writing starts, the editor-in-chief may refresh not-yet-started article briefs with newer web evidence. Once an article is `kotatsu:running` or has a production PR, trend-driven rewrites stop unless a factual, seasonal, safety, or reader-trust problem is found.

### Formal Volume Covers

Each monthly volume must have a formal AI-generated cover before the first article is published. The cover is not derived from an article hero and must be tracked as its own GitHub Issue.

- The managing editor creates `[Vol. XXX][VISUAL] Formal cover` after the approved volume plan reaches `main`.
- The task uses `type:visual`, `type:volume-cover`, and `agent:visual-editor`.
- The visual editor writes the cover to `public/images/volumes/XXX/cover.png`, adds `cover.json`, and updates `src/content/volumes/vol-XXX.md`.
- The metadata sidecar must include `source: "ai-generated"`, `usage: "volume-cover"`, seasonal context, at least two visible seasonal cues, at least two seasonal-misread risks, and the visual editor review identity.
- The publisher does not publish the first article in a volume until the formal cover is present.

### Weekly Writing Gate

Writer agents run every day at 14:00, but they only draft articles scheduled for publication in the current Japan Standard Time week, from Monday 00:00 through Sunday 23:59. The managing editor keeps future-week article GitHub Issues in `kotatsu:planned` or `kotatsu:revise` and only adds `kotatsu:ready` when that publication week arrives. If a future-week or undated article is accidentally marked ready, the writer removes `kotatsu:ready`, returns it to `kotatsu:planned`, and comments why it was skipped.

At the Monday 10:00 editorial meeting, the editor-in-chief reviews article Issues scheduled to start within the next 14 days and may add dated web evidence or refine the brief. The managing editor applies accepted brief changes before the 14:00 writer gate. Started drafts are not repeatedly redirected by new trends.

### Publishing Cadence

Scheduled agents run every day, but that does not mean articles are published every day. Daily execution is for GitHub Issue cleanup, handoff, unblocking, and pre-publication checks. The publishing cadence remains one to two articles per week and four to eight articles per monthly volume.

A `kotatsu:revise` label is actionable, not a parking state. The currently assigned agent retries it at the next scheduled run on the same PR branch. Completed work must leave Draft status, return to `kotatsu:review`, and be checked by the managing editor. The managing editor reports any revision that remains unchanged across two assigned-agent runs.

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

KOTATSU does not use photographed assets. Photorealistic images, illustrations, collages, and article visuals are all AI-generated and must follow [docs/editorial/ai-visual-policy.md](docs/editorial/ai-visual-policy.md). New visuals must also pass the seasonal-coherence gate: writing a season in metadata is insufficient unless the rendered clothing, materials, light, weather, and props plausibly match the publication date. Public pages must not make unfinished articles look complete or link to unpublished article pages.

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
