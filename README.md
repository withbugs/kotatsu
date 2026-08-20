# KOTATSU

KOTATSU is a Japanese lifestyle web magazine about adult clothing and everyday life. It is built with Astro and published as a GitHub Pages project site.

## Editorial System

Codex scheduled tasks act as an AI editorial room. GitHub Issues are the production desk, while repository documents provide the durable rules.

- [Rule ownership](docs/editorial/rule-hierarchy.md)
- [Canonical workflow](docs/editorial/agent-workflow.md)
- [Recovery lane](docs/editorial/recovery-workflow.md)
- [Role cards](.agents/kotatsu)
- [AI visual policy](docs/editorial/ai-visual-policy.md)
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

The editor-in-chief approves the volume plan. The managing editor checks production readiness and merges only the finalized plan. Individual articles do not require a separate editor-in-chief approval immediately before publication.

After the approved plan reaches `main`, the managing editor creates one formal cover Issue and the article Issues. Closing a planning Issue records completion; it never starts another volume by itself.

## Two-Day Production Schedule

All times are Japan Standard Time. Automations run every day, but labels gate actual work.

| Day | Time | Role | Main responsibility |
| --- | --- | --- | --- |
| Day 1 | 09:00 | Managing editor | Triage states, milestones, stalled work, publication weeks, and planning stages |
| Day 1 | 10:00 | Editor-in-chief | Hold the Monday editorial meeting or process the assigned planning stage |
| Day 1 | 10:00 | Visual editor | Process eligible new or retry work with the same production gate |
| Day 1 | 12:00 | Managing editor | Review planning or copy results and route only complete work |
| Day 1 | 14:00 | Writer desk | Select one eligible article and write it with the assigned category role card in an isolated worktree |
| Day 1 | 16:00 | Managing editor | Verify writer PRs and route the same article branches to visual editing |
| Day 1 | 18:00 | Visual editor | Generate and inspect AI visuals, metadata, and formal covers |
| Day 2 | 09:00 | Managing editor | Inspect the rendered visual and route accepted work to copy editing |
| Day 2 | 11:00 | Copy editor | Edit the same article branch and return it for desk review |
| Day 2 | 12:00 | Managing editor | Schedule `draft -> scheduled`; hold future work or route due work |
| Day 2 | 13:00 | Publisher | Publish due scheduled articles and verify CI, Visual Check, and Pages |
| Day 2 | 15:00 | Copy editor | Process eligible new or retry work with the same copy gate |
| Day 2 | 16:00 | Managing editor | Resolve review, date, or label mismatches and route the next step |
| Day 2 | 17:00 | Publisher | Process due scheduled articles or resume interrupted technical publication |

Production roles never pass work directly to one another. Each returns `kotatsu:review`; the managing editor assigns the next role. `kotatsu:revise` is actionable at the next assigned run, while future work remains `kotatsu:planned`.

At every managing-editor run, `pnpm milestone:close -- --apply` closes an open volume milestone only after its approved plan, formal cover, and every planned article Issue are closed with `kotatsu:done`. The command is idempotent and leaves incomplete volumes open with a reason.

Recovery has a separate decision path but keeps the normal quality gates. Same-day technical failures resume with the same role. When a gate-complete publication crosses the date boundary, the managing editor uses `pnpm recovery:slot` and `pnpm article:recover-publication` to update only delivery dates and internal date metadata; passed copy and approved visuals remain valid when the move is within seven days, stays in the same month, and no reader-facing old date exists. Content or seasonal changes use the editorial recovery path instead. Protected future publication dates never move as a cascade: the delayed article alone takes the earliest 48-hour, weekly-limit-compliant gap. No agent publishes outside its scheduled run, and recovery adds no late-night schedule.

The six category writer profiles remain independent role cards and GitHub assignees, but one daily Writer desk loads the matching profile for the earliest eligible article. It handles one article per run. This preserves category-specific judgment and isolated article branches while avoiding six empty Codex runs every day.

Scheduled agents that change repository files run in disposable worktrees. They verify a clean worktree, fetch and detach at the existing PR branch, and merge `origin/main` without rebasing before changing GitHub state. A failed preparation is discarded with its worktree, so a later scheduled run restarts from the remote branch instead of repairing a partially changed shared checkout.

Two repository-scoped brokers validate unattended network operations before invoking `gh` or remote Git. `.codex/rules/kotatsu-scheduled-network.rules` permits only those brokers and the repository-locked milestone closeout command, so scheduled worktrees can reach the durable Issue/PR queue without granting arbitrary shell network access, main pushes, or force pushes.

After the broker refreshes `origin/main`, each scheduled worktree runs `pnpm install --offline --frozen-lockfile --ignore-scripts`. This restores dependencies only from the frozen lockfile and the existing local pnpm store, without registry access or package lifecycle scripts.

## Branch And Publishing Rules

- Approved plans and formal covers may reach `main` before an article without exposing unfinished article pages.
- Article text and visuals stay on one article PR head branch through writing, visual editing, copy editing, and publishing.
- Only the publisher merges a completed article PR after the publishing gate.
- Article state is always `draft -> scheduled -> published`.
- When two articles share a week, the managing editor assigns exact dates before writing and keeps their `publishAt` values at least 48 hours apart.
- Recovery does not automatically shift later protected dates. A planned article without a PR releases its slot only when it misses the 48-hour production cutoff.
- A formal, AI-generated volume cover must exist before the first article in that volume is published.
- GitHub Actions CI and Visual Check are mandatory. Local `pnpm test:visual` is optional preflight.

## Visual Policy

KOTATSU does not use photographed assets, stock photography, or official product photography. Photorealistic images, illustrations, collages, and covers are AI-generated for the specific editorial intent. Rendered images, not prompt claims, determine seasonal coherence, visual variety, fictional-model safety, and reader comfort.

## Site

Local commands:

- `pnpm install`
- `pnpm dev`
- `pnpm check`
- `pnpm build`
- `pnpm test:visual`

GitHub Pages project URL:

- [https://withbugs.github.io/kotatsu/](https://withbugs.github.io/kotatsu/)
