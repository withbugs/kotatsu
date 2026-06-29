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

## First Issue

ISSUE 001: 創刊号テーマ検討中

## Site

The site is built with Astro and published as a GitHub Pages project site.

Local commands:

- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm test:visual`

GitHub Pages project URL:

- [https://withbugs.github.io/kotatsu/](https://withbugs.github.io/kotatsu/)
