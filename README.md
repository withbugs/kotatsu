# KOTATSU

KOTATSU is a Japanese lifestyle web magazine about adult clothing and everyday life. It is built with Astro and published as a GitHub Pages project site.

## Editorial System

Codex scheduled tasks act as an AI editorial room. GitHub Issues are the production desk, while repository documents provide the durable rules.

- [Rule ownership](docs/editorial/rule-hierarchy.md)
- [Canonical workflow](docs/editorial/agent-workflow.md)
- [Recovery lane](docs/editorial/recovery-workflow.md)
- [Role cards](.agents/kotatsu)
- [AI visual policy](docs/editorial/ai-visual-policy.md)
- [August 2026 visual-system audit](docs/editorial/visual-system-audit-2026-08.md)
- [Reader trust policy](docs/editorial/reader-trust-policy.md)

This README is an operational overview. If it differs from a canonical document, the topic owner listed in Rule ownership wins.

## Monthly Volume Workflow

Each calendar month grows one `Vol.` through one or two published articles per week, normally four to eight articles in total. `Issue` means a GitHub task, never the publication number.

Planning for the next calendar-month volume begins on or after the second Monday:

| Meeting | Stage | Outcome |
| --- | --- | --- |
| Second Monday | `planning:research` | Current web research and a candidate memo on a Draft PR; no approved plan |
| Third Monday | `planning:shortlist` | Refreshed evidence, a provisional theme, and a provisional lineup on the same Draft PR |
| Fourth Monday | `planning:finalize` | Final research, seasonal and visual direction, the approved plan, and a Ready PR |

At every 21:00, 22:00, 00:00, and 04:00 managing-editor or editor-in-chief run, `pnpm planning:recover -- --apply` checks this calendar before article recovery. A missed or unfinished stage resumes immediately from its durable Issue and planning PR; research, shortlist, finalize, and the separate managing-editor gates remain ordered, but recovery does not wait for another Monday. Missing milestone and planning Issue records are created once by the repository-locked command. Reaching `planning:finalize` is not completion: recovery remains active until the approved PR is merged, cover and article Issues are created, and the planning Issue is closed with `kotatsu:done`.

The editor-in-chief approves the volume plan. The managing editor checks production readiness and merges only the finalized plan. Individual articles do not require a separate editor-in-chief approval immediately before publication.

After the approved plan reaches `main`, the managing editor creates one formal cover Issue and the article Issues. Closing a planning Issue records completion; it never starts another volume by itself.

## Two-Night Cloud Production Schedule

All times are Japan Standard Time. Each production night starts at 21:00; 00:00–06:00 belong to the following calendar day. Automations run every day, but labels gate actual work. Publication dates and weekly/monthly limits use the actual JST calendar date. The single parent dispatcher and its six role task specifications remain disabled until this change is reviewed and merged and the operator completes the cutover; local schedules must be paused, never deleted, for rollback. The parent registers scheduled JST datetime + role in a durable ledger, creates fresh native role tasks sequentially, and at 22:00 runs editor-in-chief then visual without changing their scheduled time. An uncertain create response holds the queue; no exactly-once guarantee is claimed.

| Day | Time | Role | Main responsibility |
| --- | --- | --- | --- |
| Day 1 | 21:00 | Managing editor | Triage states, milestones, stalled work, publication weeks, and planning stages |
| Day 1 | 22:00 | Editor-in-chief | Hold the Monday editorial meeting or process the assigned planning stage |
| Day 1 | 22:00 | Visual editor | Process eligible new or retry work with the same production gate |
| Day 1 +1 | 00:00 | Managing editor | Review planning or copy results and route only complete work |
| Day 1 +1 | 02:00 | Writer desk | Select one eligible article and write it with the assigned category role card in an isolated checkout |
| Day 1 +1 | 04:00 | Managing editor | Verify writer PRs and route the same article branches to visual editing |
| Day 1 +1 | 06:00 | Visual editor | Generate and inspect AI visuals, metadata, and formal covers |
| Day 2 | 21:00 | Managing editor | Inspect the rendered visual and route accepted work to copy editing |
| Day 2 | 23:00 | Copy editor | Edit the same article branch and return it for desk review |
| Day 2 +1 | 00:00 | Managing editor | Schedule `draft -> scheduled`; hold future work or route due work |
| Day 2 +1 | 01:00 | Publisher | Publish due scheduled articles and verify CI, Visual Check, and Pages |
| Day 2 +1 | 03:00 | Copy editor | Process eligible new or retry work with the same copy gate |
| Day 2 +1 | 04:00 | Managing editor | Resolve review, date, or label mismatches and route the next step |
| Day 2 +1 | 05:00 | Publisher | Process due scheduled articles or resume interrupted technical publication |

Production roles never pass work directly to one another. Each returns `kotatsu:review`; the managing editor assigns the next role. `kotatsu:revise` is actionable at the next assigned run, while future work remains `kotatsu:planned`.

At every managing-editor run, `pnpm milestone:close -- --apply` closes an open volume milestone only after its approved plan, formal cover, and every planned article Issue are closed with `kotatsu:done`. The command is idempotent and leaves incomplete volumes open with a reason.

Recovery has a separate decision path but keeps the normal quality gates. Any nightly scheduled run can become a bounded recovery coordinator for the oldest delayed article and dispatch one role-specific subagent at a time. The active goal is publication and URL verification, so an executable revision continues to the responsible worker instead of ending the session. Production workers still return through a separate managing-editor worker before the next role, while a gate-complete Delivery failure can go directly to a publisher worker. Required Actions runs use a repository-locked recovery command: a queued run becomes stale after 30 minutes, an active run after 60 minutes, and only the affected run is cancelled and rerun, with a three-attempt cap and exact PR head-SHA verification. A session checkpoints after one article, 120 minutes, eight workers, an unresolved source-of-truth conflict, an external blocker, or the following 07:00 JST; checkpointing releases its Issue recovery lease; the shared Git lease remains held until all workers stop and the next nightly run resumes that GitHub goal before normal work. A recovered article scheduled for a future slot waits normally without blocking other production. Passed copy and approved visuals remain valid only when the delivery move stays within seven days and the same month and no reader-facing old date exists. Protected future dates never move as a cascade, and no extra high-frequency automation is added.

The deployment manifest and complete role prompts are in [cloud operations](docs/editorial/cloud-operations.md). Browser provisioning and duplicate-run guards are prepared there; this repository change does not enable a schedule.

The six category writer profiles remain independent role cards and GitHub assignees, but one daily Writer desk loads the matching profile for the earliest eligible article. It handles one article per run. This preserves category-specific judgment and isolated article branches while avoiding six empty Codex runs every day.

Scheduled agents that change repository files run in isolated checkouts, without creating worktrees. They verify a clean checkout, fetch and detach at the existing PR branch, and merge `origin/main` without rebasing before changing GitHub state. A failed preparation is discarded with its checkout, so a later scheduled run restarts from the remote branch instead of repairing a partially changed shared checkout.

Two repository-scoped brokers validate unattended network operations before invoking `gh` or remote Git. `.codex/rules/kotatsu-scheduled-network.rules` permits only those brokers and the repository-locked milestone closeout command, so scheduled checkouts can reach the durable Issue/PR queue without granting arbitrary shell network access or main pushes. The proposed fixed cloud lease ref uses atomic compare-and-swap as a narrow force-with-lease exception, pending runtime permission review before activation.

After the broker refreshes `origin/main`, each scheduled checkout runs `pnpm install --offline --frozen-lockfile --ignore-scripts --store-dir /workspace/.onboarding/pnpm-store`. This restores dependencies only from the frozen lockfile and the existing local pnpm store, without registry access or package lifecycle scripts.

## Branch And Publishing Rules

- Approved plans and formal covers may reach `main` before an article without exposing unfinished article pages.
- Article text and visuals stay on one article PR head branch through writing, visual editing, copy editing, and publishing.
- Only the publisher merges a completed article PR after the publishing gate.
- Article state is always `draft -> scheduled -> published`.
- When two articles share a week, the managing editor assigns exact dates before writing and keeps their `publishAt` values at least 48 hours apart.
- A next-week article enters the Writer desk up to 72 hours before `publishAt`, ensuring one daily writing run before the 48-hour production cutoff without moving its publication date.
- Recovery does not automatically shift later protected dates. A planned article without a PR releases its slot only when it misses the 48-hour production cutoff.
- A formal, AI-generated volume cover must exist before the first article in that volume is published.
- GitHub Actions CI and Visual Check are mandatory. Same-head cloud desktop/mobile rendering and a complete review receipt are mandatory; see [cloud visual gate](docs/editorial/cloud-visual-gate.md).

## Visual Policy

KOTATSU does not use photographed assets, stock photography, or official product photography. Photorealistic images, illustrations, collages, and covers are AI-generated for the specific editorial intent. From Vol. 003 onward, every volume reserves one non-photorealistic article and one separate roster-model article, while the visual editor retains control of the exact style, composition, location, perspective, and model. Rendered images, not prompt claims, determine seasonal coherence, visual variety, fictional-model safety, and reader comfort.

## Site

Local commands:

- `pnpm install`
- `pnpm dev`
- `pnpm check`
- `pnpm build`
- `pnpm test:visual`

GitHub Pages project URL:

- [https://withbugs.github.io/kotatsu/](https://withbugs.github.io/kotatsu/)

Cloud rollback requires the reviewed code/rule revert and original six daytime prompts described in [cloud operations](docs/editorial/cloud-operations.md), followed by checks before local schedules resume. Pausing cloud and resuming local alone is insufficient.
