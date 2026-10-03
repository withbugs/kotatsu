# GitHub Access Policy For Scheduled Agents

KOTATSUの予定済みエージェントは、GitHub Issue、Pull Request、Actions、label、milestoneの読み書きにruntimeの正式 `gh` CLIを使用する。

これはユーザーが選択したKOTATSU固有の無人実行方針であり、一般的なGitHub pluginのconnector-first指針より優先する。

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

## Isolated Cloud Checkouts

- 予定済みエージェントは専用分離checkoutを使い、worktreeを作成しない。共有ローカルPCを制作場所にしない。
- 全roleのlauncherは `cloud-run-guard.mjs` の共通排他guardを通し、GitHubのactive leaseも確認する。
- 既存PR branchへ着手する前に `git status --porcelain` が空か確認し、正式remote broker fetch、`git switch --detach origin/<head branch>`、`git merge --no-edit origin/main` を順に実行する。対象branchへのdetached switchと通常mergeが成功する前にIssueをrunningにしない。rebaseを使用しない。
- index、HEAD、worktree metadataへ書くコマンドが許可範囲外ならruntimeの `sandbox_permissions: "require_escalated"` を使い、拒否時は停止する。許可済みworkspace内の専用checkoutでは不要な昇格を要求しない。
- 同期失敗、部分変更、non-fast-forwardではreset、restore、clean、force checkoutで復元せず停止する。次回は確認済みcleanな分離checkoutから再開する。
- commitはremote brokerの `push origin HEAD:<head branch>` のみ。main、未許可family、forceは禁止。
- CI実checkoutのtree照合に限り `node scripts/editorial/kotatsu-git-remote.mjs fetch-ci-merge origin <full SHA>` でCI logのmerge objectを取得する。mainや記事branchを変更しない。

## Authentication And Retry

- `.codex/rules/kotatsu-scheduled-network.rules` は上記2つのbrokerとrepository固定のmilestone closeout、月次計画回復、必須Actions回復だけを外部実行へ許可する。任意の `gh`、`git`、shellコマンドにはネットワーク権限を与えない。
- GitHub/Git通信のbroker、milestone closeout、月次計画回復、`pnpm install --offline --frozen-lockfile --ignore-scripts --store-dir /workspace/.onboarding/pnpm-store` は、許可済みruntime brokerを使用する。追加権限が必要なときだけ `sandbox_permissions: "require_escalated"` を指定し、command ruleが許可するprefixだけを無人承認させ、通常サンドボックス内でproxy失敗またはpnpmストア参照失敗させてから再試行しない。
- offline installは `/workspace/.onboarding/pnpm-store` を明示する。`--offline`、`--frozen-lockfile`、`--ignore-scripts`を外したinstallや外部取得への切り替えは禁止する。
- broker、command rule、keyring、network、permission由来の失敗が出た場合は、許可範囲を広げたりユーザー承認を待ったりしない。同じ担当の次回起動で再試行できる状態を保つ。
- 失敗した場合は、コマンド、エラー、未完了操作を報告し、GitHub状態を先へ進めず停止する。
- `gh auth status`、`gh auth refresh`、`gh auth logout`、token再発行、資格情報削除は自動実行しない。
- `gh` の失敗からGitHub Connectorへフォールバックしない。

## Interactive Exception

ユーザーが対話中にGitHub Connectorの使用を明示した場合だけ、そのタスクに限ってConnectorを使用できる。この例外は予定済みエージェントには引き継がない。
