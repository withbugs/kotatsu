# GitHub Access Policy For Scheduled Agents

KOTATSUの予定済みエージェントは、GitHub Issue、Pull Request、Actions、label、milestoneの読み書きにローカルの `gh` CLIを使用する。

これはユーザーが選択したKOTATSU固有の無人実行方針であり、一般的なGitHub pluginのconnector-first指針より優先する。

## Startup Gate

全予定実行は、最初の通信で `node scripts/editorial/kotatsu-git-remote.mjs fetch origin main` を実行する。取得成功後、この文書を `git show origin/main:docs/editorial/github-access-policy.md` で読み、次の順序で準備する。

1. `git status --porcelain` が空なら `git switch --detach origin/main` を実行する。dirtyなら変更を削除・復元せず準備を中断する。
2. `pnpm install --offline --frozen-lockfile --ignore-scripts` を実行する。不足時は外部取得へ切り替えない。
3. 最新mainのrule-hierarchy、agent-workflow、recovery-workflowと担当role cardを読み、Execution Priorityから着手対象を決める。古いHEADの正本スクリプトは実行しない。

fetch、switch、offline installには、初回呼び出しから `sandbox_permissions: "require_escalated"` を指定する。準備未完了ならIssueをrunningへ変更しない。

## Scheduled Runs

- GitHub Connector、GitHub MCP、GitHub app toolsを呼び出さない。
- Connectorの利用可否を調べるtool discoveryも行わず、Connector承認をユーザーへ要求しない。
- GitHub操作は `node scripts/editorial/kotatsu-github.mjs <gh引数>` を使い、必ず `--repo withbugs/kotatsu` を明記する。予定実行から `gh` を直接呼ばない。
- Issueの取得・更新、PRの取得・本文更新・Ready化・merge、Actions確認はbrokerが許可する `issue` / `pr` / `run` の範囲に限る。汎用brokerは`run cancel` / `run rerun`を拒否し、repository固定の `actions-recovery.mjs`だけが同一head SHAを検証した必須runに使用する。PR更新にはrepository固定の `pr edit --repo withbugs/kotatsu` を使う。`api` はVol. milestoneの一覧取得とcloseだけに限る。
- remote fetch/pushは `node scripts/editorial/kotatsu-git-remote.mjs fetch origin main [head branch]` と `node scripts/editorial/kotatsu-git-remote.mjs push origin HEAD:<head branch>` を使う。予定実行からremote `git fetch` / `git push` を直接呼ばない。
- milestone closeoutはrepository固定の `node scripts/editorial/close-complete-milestones.mjs --apply` を使う。
- 月次計画の期限判定と欠落queue作成はrepository固定の `node scripts/editorial/monthly-planning-recovery.mjs --apply` を使う。このスクリプトだけが `withbugs/kotatsu` の全Vol. milestoneと計画Issueを照合し、未来Vol.1件の範囲で欠けたmilestoneとresearch Issueを作成できる。
- 必須Actionsのstale判定と再実行はrepository固定の `pnpm recovery:actions -- --ci-run=<id> --visual-run=<id> --head-sha=<sha> --apply`（`actions-recovery.mjs`の固定alias）を使う。予定実行がrunを直接cancel/rerunしない。
- local branch、commit、switch、mergeは通常の `git` を使う。

## Isolated Worktrees

- リポジトリを変更する予定済みエージェントは、Codexの分離worktree実行を使う。共有チェックアウトを制作場所にしない。
- 既存PR branchへ着手する前にIssueのhead branchを確認する。`git status --porcelain` が空であることを確認し、remote brokerによるfetch、`git switch --detach origin/<head branch>`、`git merge --no-edit origin/main` を順に実行する。
- 分離worktreeの `.git` は共有repositoryの管理領域を参照する。`git switch --detach`、`git merge --no-edit`、`git add -- <paths>`、`git commit -m <message>` のようにindex、HEAD、worktree metadataへ書くコマンドは、最初の `exec_command` から `sandbox_permissions: "require_escalated"` を指定する。通常サンドボックスでpermission failureを起こしてから再試行しない。`git status`、`git diff`、`git show`など読取りだけの操作は通常権限でよい。
- 上記の3操作がすべて成功する前にIssueをrunningへ変更しない。rebaseを使用しない。
- 同期失敗時はreset、restore、clean、force checkoutで復元を試みない。分離worktreeを破棄し、GitHub上の状態を変更せず、次の予定実行が新しいworktreeで再試行できるようにする。
- 完了したcommitはremote brokerの `push origin HEAD:<head branch>` で送る。brokerはmain、未許可のbranch family、force形式を拒否する。non-fast-forwardなら停止し、Issueを元の担当・状態に保ったまま次の予定実行で最新branchからやり直す。
- 新規branchも分離worktreeの `origin/main` から作る。mainへ直接pushしない。

## Authentication And Retry

- `.codex/rules/kotatsu-scheduled-network.rules` は上記2つのbrokerとrepository固定のmilestone closeout、月次計画回復、必須Actions回復だけを外部実行へ許可する。任意の `gh`、`git`、shellコマンドにはネットワーク権限を与えない。
- GitHub/Git通信のbroker、milestone closeout、月次計画回復、`pnpm install --offline --frozen-lockfile --ignore-scripts` は、最初の `exec_command` から `sandbox_permissions: "require_escalated"` を指定する。command ruleが許可するprefixだけを無人承認させ、通常サンドボックス内でproxy失敗またはpnpmストア参照失敗させてから再試行しない。
- offline installはグローバルpnpmストアの参照だけに昇格を使う。`--offline`、`--frozen-lockfile`、`--ignore-scripts`を外したinstallや外部取得への切り替えは禁止する。
- broker、command rule、keyring、network、permission由来の失敗が出た場合は、許可範囲を広げたりユーザー承認を待ったりしない。同じ担当の次回起動で再試行できる状態を保つ。
- 認証、権限、同期、依存準備が回復できない場合はその操作を中断し、コマンド、エラー、未完了操作を残す。GitHubへ到達できる復旧sessionはcheckpointを記録してleaseを解放する。制作中の修正・CI・artifact失敗は一律停止せず、recovery-workflowの同じ再開地点と限定再試行に従う。
- `gh auth status`、`gh auth refresh`、`gh auth logout`、token再発行、資格情報削除は自動実行しない。
- `gh` の失敗からGitHub Connectorへフォールバックしない。

## Interactive Exception

ユーザーが対話中にGitHub Connectorの使用を明示した場合だけ、そのタスクに限ってConnectorを使用できる。この例外は予定済みエージェントには引き継がない。
