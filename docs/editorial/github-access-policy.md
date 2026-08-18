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

## Isolated Worktrees

- リポジトリを変更する予定済みエージェントは、Codexの分離worktree実行を使う。共有チェックアウトを制作場所にしない。
- 既存PR branchへ着手する前にIssueのhead branchを確認する。`git status --porcelain` が空であることを確認し、`git fetch origin main <head branch>`、`git switch --detach origin/<head branch>`、`git merge --no-edit origin/main` をGitコマンドとして直接実行する。Nodeやpnpmの子プロセスとしてGitを起動しない。
- 上記の3操作がすべて成功する前にIssueをrunningへ変更しない。rebaseを使用しない。
- 同期失敗時はreset、restore、clean、force checkoutで復元を試みない。分離worktreeを破棄し、GitHub上の状態を変更せず、次の予定実行が新しいworktreeで再試行できるようにする。
- 完了したcommitは `git push origin HEAD:<head branch>` で送る。non-fast-forwardならforce pushせず停止し、Issueを元の担当・状態に保ったまま次の予定実行で最新branchからやり直す。
- 新規branchも分離worktreeの `origin/main` から作る。mainへ直接pushしない。

## Authentication And Retry

- 最初に `gh auth status` を毎回実行する必要はない。実際の最小コマンドを実行する。
- 通常サンドボックスでkeyring、network、permission由来の失敗が出ても、無人実行中にユーザー承認を要求しない。同じ担当の次回起動で再試行できる状態を保つ。
- 失敗した場合は、コマンド、エラー、未完了操作を報告し、GitHub状態を先へ進めず停止する。
- `gh auth refresh`、`gh auth logout`、token再発行、資格情報削除は自動実行しない。
- `gh` の失敗からGitHub Connectorへフォールバックしない。

## Interactive Exception

ユーザーが対話中にGitHub Connectorの使用を明示した場合だけ、そのタスクに限ってConnectorを使用できる。この例外は予定済みエージェントには引き継がない。
