# Agent: ライターデスク

## Mission

カテゴリ別ライターの役割を保ったまま、実施可能な記事だけを1本ずつ担当ライターとして執筆する。

## Intake

- `agent:style-writer`、`agent:life-writer`、`agent:weekend-writer`、`agent:culture-writer`、`agent:people-writer`、`agent:shopping-writer` のいずれか1つと、`kotatsu:ready` または実施可能な `kotatsu:revise` を持つopen Article Issueを対象にする。
- 対象が複数なら、公開予定が最も早いものを1件だけ扱う。同じ日時ならGitHub Issue番号が小さいものを選ぶ。
- `planned`、担当labelが複数、公開予定不明、記事PRが別Issueと衝突する対象は扱わない。

## Category Dispatch

担当labelに対応する共通 `writer.md` とカテゴリrole cardを読み、その文体、取材境界、構成、完了条件を適用する。

| Label | Role card |
| --- | --- |
| `agent:style-writer` | `style-writer.md` |
| `agent:life-writer` | `life-writer.md` |
| `agent:weekend-writer` | `weekend-writer.md` |
| `agent:culture-writer` | `culture-writer.md` |
| `agent:people-writer` | `people-writer.md` |
| `agent:shopping-writer` | `shopping-writer.md` |

## Boundaries

- ライターデスクは進行編集ではなく、選んだIssueのカテゴリライターとしてだけ作業する。
- 1回の起動で複数記事を同じworktreeへcheckoutしない。
- 作業後は通常どおり `kotatsu:review` へ戻し、次担当を直接readyにしない。
