# Editorial Rule Ownership

KOTATSUの編集ルールは、内容ごとに次のファイルを正本とする。同じ規則をautomation prompt、README、Issue templateへ複製しない。

| Topic | Source of truth |
| --- | --- |
| 状態label、工程、時刻、branch、受け渡し、公開頻度 | `docs/editorial/agent-workflow.md` |
| 予定済みタスクからのGitHubアクセス | `docs/editorial/github-access-policy.md` |
| AI生成ビジュアル、季節感、人物、metadata | `docs/editorial/ai-visual-policy.md` |
| 読者向け表示、未完成記事、表現 | `docs/editorial/reader-trust-policy.md` |
| 各担当に固有の編集判断 | `.agents/kotatsu/<role>.md` |
| 発行Vol.固有のテーマ、記事構成、公開週 | `docs/editorial/plans/vol-XXX.md` |
| 機械的に検査できる条件 | `src/content/config.ts` と `scripts/editorial/` |

## Precedence

- automation promptは、担当名、起動時刻、対象label、読む正本だけを指定する。編集ルールを再定義しない。
- README、`docs/editorial/ai-editorial-room.md`、Issue templateは案内または入力補助であり、正本を上書きしない。
- Vol.固有計画は記事の方向を具体化できるが、共通の安全、読者信頼、公開ゲートを緩和できない。
- 文書とスクリプトが食い違う場合は、都合のよい方を選ばない。作業を次工程へ渡さず、GitHub Issueへ不一致を記録して修正対象にする。

## Branch Freshness

予定済みタスクは、実作業branch上の古いコピーを正本とみなさない。

1. 作業前に `git fetch origin main` を試みる。
2. `main` 以外のbranchにいる場合、共通ルールと承認済み計画は `git show origin/main:<path>` で確認する。
3. 記事本文と画像だけを、進行編集が指定した記事PR head branchから読む。
4. `origin/main` を更新できない場合は、利用できるrevisionと失敗理由を報告し、古いルールを推測で補わない。

ルールを読む目的だけで、制作branchを `main` へmergeまたはrebaseしない。

## Automation Memory

automationの `memory.md` は直近作業の補助であり、正本ではない。GitHub、PR、`origin/main` の現在状態が常に優先する。

- 保持するのは、未解決の担当Issue、PR/head branch、次回も有効なblocker、直近の実行結果だけとする。
- 「対象なし」、同じ認証再試行、同じ公開週判定など、次回判断に不要な実行ログを蓄積しない。
- 解決済み情報と古い日付依存情報を残さず、原則20行以内の最新要約に置き換える。
- memoryにだけ存在する指示、承認、公開予定を根拠にlabelや成果物を変更しない。
