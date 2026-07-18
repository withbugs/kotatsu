# KOTATSU

KOTATSU is a Japanese lifestyle web magazine about adult clothing and everyday life. It is built with Astro and published as a GitHub Pages project site.

## Editorial System

Codex scheduled tasks act as an AI editorial room. GitHub Issues are the production desk, while repository documents provide the durable rules.

- [Rule ownership](docs/editorial/rule-hierarchy.md)
- [Canonical workflow](docs/editorial/agent-workflow.md)
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
| Day 1 | 12:00 | Managing editor | Review planning or copy results and route only complete work |
| Day 1 | 14:00 | Six writers | Draft only articles scheduled for the current JST week in isolated worktrees |
| Day 1 | 16:00 | Managing editor | Verify writer PRs and route the same article branches to visual editing |
| Day 1 | 18:00 | Visual editor | Generate and inspect AI visuals, metadata, and formal covers |
| Day 2 | 09:00 | Managing editor | Inspect the rendered visual and route accepted work to copy editing |
| Day 2 | 11:00 | Copy editor | Edit the same article branch and return it for desk review |
| Day 2 | 12:00 | Managing editor | Schedule `draft -> scheduled`; hold future work or route due work |
| Day 2 | 13:00 | Publisher | Publish due scheduled articles and verify CI, Visual Check, and Pages |
| Day 2 | 16:00 | Managing editor | Repair failed, revised, or stalled handoffs |

Production roles never pass work directly to one another. Each returns `kotatsu:review`; the managing editor assigns the next role. `kotatsu:revise` is actionable at the next assigned run, while future work remains `kotatsu:planned`.

## Branch And Publishing Rules

- Approved plans and formal covers may reach `main` before an article without exposing unfinished article pages.
- Article text and visuals stay on one article PR head branch through writing, visual editing, copy editing, and publishing.
- Only the publisher merges a completed article PR after the publishing gate.
- Article state is always `draft -> scheduled -> published`.
- When two articles share a week, the managing editor assigns exact dates before writing and keeps their `publishAt` values at least 48 hours apart.
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
