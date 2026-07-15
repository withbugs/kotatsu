# GitHub Access Policy For Scheduled Agents

KOTATSUの予定済みエージェントは、GitHub Issue、Pull Request、Actions、label、milestoneの読み書きにローカルの `gh` CLIを使用する。

これはユーザーが選択したKOTATSU固有の無人実行方針であり、一般的なGitHub pluginのconnector-first指針より優先する。

## Scheduled Runs

- GitHub Connector、GitHub MCP、GitHub app toolsを呼び出さない。
- Connectorの利用可否を調べるtool discoveryも行わず、Connector承認をユーザーへ要求しない。
- `gh` コマンドには原則として `--repo withbugs/kotatsu` を明記する。
- Issueの取得には `gh issue list` / `gh issue view`、更新には `gh issue edit` / `gh issue comment` を使う。
- PRの取得には `gh pr view` / `gh pr checks`、更新には `gh pr ready` / `gh pr create` / `gh pr merge` を使う。
- Actionsの確認には `gh run list` / `gh run view` を使う。
- branch、commit、pushは `git` を使う。

## Authentication And Retry

- 最初に `gh auth status` を毎回実行する必要はない。実際の最小コマンドを実行する。
- 通常サンドボックスでkeyring、network、permission由来の失敗が出た場合は、同じ最小 `gh` コマンドを承認付きshell実行で1回だけ再試行する。
- 再試行でも失敗した場合だけ、コマンド、エラー、未完了操作を報告して停止する。
- `gh auth refresh`、`gh auth logout`、token再発行、資格情報削除は自動実行しない。
- `gh` の失敗からGitHub Connectorへフォールバックしない。

## Interactive Exception

ユーザーが対話中にGitHub Connectorの使用を明示した場合だけ、そのタスクに限ってConnectorを使用できる。この例外は予定済みエージェントには引き継がない。