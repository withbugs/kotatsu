# GitHub Issue Driven Editorial Workflow

この文書は、KOTATSUの状態label、工程、時刻、branch、受け渡し、公開頻度の正本である。ルールの分担は `docs/editorial/rule-hierarchy.md` に従う。

## Terms

- `Vol.` / `volume`: 月ごとの発行単位
- GitHub Issue: 制作タスク。発行単位の意味では使わない
- Milestone: `Vol. XXX YYYY年M月号`
- Pull Request: 計画、記事、正式カバー、サイト変更のレビュー単位

## Labels

状態labelは同時に1つだけ付ける。

- `kotatsu:planned`: 着手時期または前工程待ち
- `kotatsu:ready`: 次担当が新規着手できる
- `kotatsu:running`: 担当が作業中
- `kotatsu:review`: 進行編集の確認待ち
- `kotatsu:revise`: 現担当が次回起動で処理する具体的な修正
- `kotatsu:publish`: 掲載予約済みで、公開担当が処理できる
- `kotatsu:done`: 完了

計画段階は `planning:research`、`planning:shortlist`、`planning:finalize` のうち1つだけを使う。種別、カテゴリ、担当は `.github/labels.yml` を正本とする。

## State Transitions

| From | Actor | To | Condition |
| --- | --- | --- | --- |
| `planned` | 進行編集 | `ready` | 着手時期、担当、milestone、入力成果物が揃う |
| `ready` / `revise` | 担当エージェント | `running` | 作業開始時 |
| `running` | 同じ担当エージェント | `revise` | 技術的失敗の再開地点を記録し、次の同担当起動を待つ |
| `running` | 担当エージェント | `review` | 成果、PR/head branch、検証結果をコメント済み |
| `review` | 進行編集 | `ready` | 次担当へ渡せる |
| `review` | 進行編集 | `revise` | 現担当へ具体的な修正が必要 |
| `review` | 進行編集 | `planned` | 公開週、次会議、公開時刻などを待つ |
| `review` | 進行編集 | `publish` | 校正、掲載予約、公開時刻、正式カバーが揃う |
| `publish` / publisherの`revise` | 公開担当 | `running` | 公開作業開始時 |
| `running` | 公開担当 | `done` | `main`反映と公開URL確認が完了 |

`kotatsu:ready` の最終管理者は進行編集である。制作担当同士は直接次担当labelや `ready` / `publish` を付けず、必ず `review` へ戻す。迅速復旧でも制作workerの後に別の進行編集workerがdesk gateを実施するため、この権限分離は変わらない。

`kotatsu:revise` は待機labelではない。付与時は他の状態labelを外し、担当labelを1つにし、修正理由または技術的な再開地点、PR URL、head branch、完了条件をコメントする。次回の同担当起動で処理させない修正は `planned` に置く。

## Branch And Handoff

- 予定実行の分離worktreeは、remote brokerで`origin/main`を取得した直後に `pnpm install --offline --frozen-lockfile --ignore-scripts` を実行する。lockfileとローカルpnpmストアだけで依存を復元し、不足時は外部取得へ切り替えずその起動を停止する。
- 承認済み正式計画は `origin/main` に存在する場合だけ制作へ使える。
- 記事制作は、ライター、ビジュアル編集、校正、公開担当が同じ記事PR head branchへ変更を積む。
- Draft PRは担当の作業中だけ許可する。担当完了時はReady for reviewにする。
- 記事PR URLまたはhead branchが不明、checkout不可、conflict、重大なCI失敗、記事ファイル不明の場合は次工程へ渡さない。
- 制作中の記事本文と画像は `main` に入れない。最終記事PRをmergeできるのは公開ゲート通過後の公開担当だけである。
- 進行編集は、承認済み正式計画PRと、記事本文を含まない正式Vol.カバーPRをゲート通過後に `main` へ反映できる。

## Daily Schedule

すべてJST。自動化は毎日起動するが、labelが条件を満たすタスクだけを処理する。

| Day | Time | Role | Work |
| --- | --- | --- | --- |
| 1 | 09:00 | 進行編集 | label、milestone、滞留、当日着手、計画段階を整理 |
| 1 | 10:00 | 編集長 | 編集会議、担当計画、未着手briefを判断 |
| 1 | 10:00 | ビジュアル編集 | 実施可能な新規・再試行対象のAI画像とmetadataを制作 |
| 1 | 12:00 | 進行編集 | 計画成果と校正成果を確認し、次工程または待機へ整理 |
| 1 | 14:00 | ライターデスク | 最も早い実施可能な1記事を、担当カテゴリのrole cardでworktree執筆 |
| 1 | 16:00 | 進行編集 | ライターPRを確認し、ビジュアル編集へ渡す |
| 1 | 18:00 | ビジュアル編集 | AI画像を生成・配置し、実画像とmetadataを確認 |
| 2 | 09:00 | 進行編集 | 実画像を確認し、通過分だけ校正へ渡す |
| 2 | 11:00 | 校正 | 同じ記事branchで校正し、reviewへ戻す |
| 2 | 12:00 | 進行編集 | 校正確認、`draft -> scheduled`、公開時刻判定 |
| 2 | 13:00 | 公開担当 | 到来済みのscheduled記事だけを公開 |
| 2 | 15:00 | 校正 | 実施可能な新規・再試行対象を11:00と同じ条件で校正 |
| 2 | 16:00 | 進行編集 | review、日付、labelの不一致を整理し、次工程へ渡す |
| 2 | 17:00 | 公開担当 | 到来済みのscheduled記事と技術的に中断した公開を処理 |

通常制作では、最短でもビジュアル編集から公開まではDay 1 18:00からDay 2 13:00を使う。遅延記事は迅速復旧コーディネーターが同じ品質ゲートを逐次dispatchでき、担当間の定期時刻だけを待たずに進める。

同じ担当に複数の起動時刻がある場合、すべて同じ成果物、検査、完了条件を使う。前の起動で完了済みなら何もせず、`ready`、実施可能な `revise`、または2時間を超えて有意な進捗がない同担当の `running` だけを処理する。直近2時間以内に更新された作業は重複処理しない。予定実行の欠損、技術障害、期限超過は `docs/editorial/recovery-workflow.md` で分類し、通常工程の品質基準を上書きしない。

通信、Actions、artifact取得、Pages確認など制作内容を変えない技術的失敗は、失敗した担当が再開地点をコメントし、同じ担当の `kotatsu:revise` に残す。次の同担当起動が進行編集を介さず再開する。本文、画像、校正、公開日など編集判断が必要な失敗だけ `kotatsu:review + agent:managing-editor` へ戻す。これは同じ担当内の再試行であり、制作担当間の直接受け渡しではない。

## Recovery

予定実行の欠損、技術的失敗、公開予定日の超過は `docs/editorial/recovery-workflow.md` を正本とする。通常工程は成果物と品質ゲートを定義し、復旧工程は完了済みゲートを保持する条件、未完了の再開地点、protected公開日を動かさない最短空き枠だけを定義する。

09:00から18:00までに起動した予定済みタスクは、状態labelにかかわらずopenな `type:article` の更新時刻、PR、公開予定から遅延候補を確認する。予定担当の起動が1回欠けた、工程から2時間を超えて進捗がない、または公開予定日を過ぎた対象は復旧classを決める。対象があれば迅速復旧コーディネーターとして役割別workerを逐次dispatchする。activeまたはcheckpointの復旧goalは通常担当より先に再開し、実施可能なreviseを理由に固定時刻まで待たない。ただし、進行編集の09:00、12:00、16:00と編集長の10:00は、記事復旧より先に月次計画の期限判定を行う。排他leaseを持つのは最新記録が期限内の `state: active` であるsessionだけで、checkpointは即時再開できる。未来日時まで正常に掲載待機する `waiting-publishAt` は復旧優先対象にせず、ほかの記事を進める。技術的なDelivery recoveryは公開担当workerが `pnpm recovery:slot` と `pnpm article:recover-publication` を同じsession内で実行する。読者向け内容の再確認が必要なEditorial recoveryは進行編集workerが `pnpm article:rebook` を使い、open・未mergeのpublished記事PRでは編集長再確認後に `--resume-unmerged-publication` を付けてdraftへ戻す。ProductionとEditorial recoveryでは制作workerごとに進行編集workerを挟む。

復旧でも記事状態は `draft -> scheduled -> published` とし、公開担当だけが最終記事PRをmainへmergeする。未来記事の日付を連鎖的に変更せず、制作中または期限内のprotected日付を維持する。

## Monthly Planning

進行編集はJSTの第2月曜以降、翌暦月について未来Vol.1件だけを先行計画できる。第2月曜より前は、初回またはユーザーが前倒しを明示した場合だけ開始する。open/closedの計画Issue、milestone、候補メモ、正式計画、Vol.コンテンツを確認し、重複作成しない。

計画Issueは `[Vol. XXX][PLAN] YYYY年M月号テーマ検討` とし、`type:volume-plan`、`agent:editor-in-chief`、`planning:research`、`kotatsu:ready` を付ける。同じIssue、planning branch、Draft PRを3週間使う。

1. 第2月曜 `research`: 検索語3件以上、確認日付きURL4件以上、情報種別3種類以上で需要を調べ、候補メモだけを作る。
2. 第3月曜 `shortlist`: 調査を更新し、テーマとラインナップを仮決定する。正式計画は作らない。
3. 第4月曜 `finalize`: 調査を再更新し、テーマ、記事順、公開週、季節感、AIビジュアル方針を正式計画にする。編集長がVol.計画を編集承認し、PRをReadyにする。
4. 各月曜12:00に進行編集が成果を確認する。research/shortlistは次月曜までplanned、finalizeだけをmainへ反映する。

進行編集の09:00、12:00、16:00と編集長の10:00は、記事復旧より先に `pnpm planning:recover -- --apply` を実行する。コマンドはJSTの暦とGitHub上の全計画Issue・milestoneを照合し、期限を過ぎた計画がなければ未来Vol.1件分のmilestoneとresearch Issueだけを重複なく作る。出力が `recovery-required` なら `docs/editorial/recovery-workflow.md` のPlanning Recoveryを開始または再開する。

遅延回復でもresearch、進行編集確認、shortlist、進行編集確認、finalize、進行編集確認の順序と調査基準は省略しない。ただし完了済み段階から再開し、次の月曜を待たず同じ日中sessionで期待段階まで逐次進める。各段階をIssueコメント、planning branchのcommit、stage labelへ記録し、進行編集確認を通さず次段階へ進めない。

検索が利用できない場合は根拠を捏造せずfinalizeしない。第5月曜は通常時はpreflightに使うが、未完了のPlanning Recoveryがあればfinalizeまでの不足段階を優先する。個別記事の公開前に編集長の最終承認は設けず、編集長は週次会議とVol.計画承認で品質を担保する。

正式計画が `main` に入り、正式カバーIssueと記事Issueを展開したら、計画Issueはdoneでcloseできる。closeは次Vol.開始のトリガーではない。

## Volume Closeout

Vol.のmilestoneを閉じる責任者は進行編集である。公開担当は各記事Issueをdoneでcloseするが、milestone自体は操作しない。

進行編集は9:00、12:00、16:00の各起動で、remote brokerによるorigin/main取得の成功後に `node scripts/editorial/close-complete-milestones.mjs --apply` を実行する。このコマンドはopenな `Vol. XXX` milestoneごとに、次をすべて満たす場合だけcloseする。

- `origin/main` に承認済み `docs/editorial/plans/vol-XXX.md` が存在する。
- milestoneに完了済みの `type:volume-plan` が1件、`type:volume-cover` が1件ある。
- 正式計画の記事行と `type:article` Issueが件数、カテゴリ、見出しまで一致する。
- milestone内のIssueがすべてclosedで、すべて `kotatsu:done` を持つ。

月末到来、計画Issueのclose、最新記事の公開、open Issueが一時的に0件になったことだけではcloseしない。条件不足は理由を出力してopenのまま残す。処理対象はopen milestoneだけなので、再実行しても完了済みmilestoneを二重処理しない。

## Brief And Weekly Writing Gate

毎週月曜10:00、編集長は今後14日以内に執筆開始予定で、まだrunningでも記事PR作成済みでもないIssueをウェブ需要、季節、生活イベントに照らして確認する。進行編集は採用した変更だけを14:00前にIssueへ反映する。執筆開始後は、事実、季節、安全、読者信頼の問題以外で短期トレンドによる方向転換をしない。

brief修正提案は記事ごとに対象Vol.、Article Issue、承認済み計画、publishAt、参照したVol.を明記する。次Vol.の調査を現行Vol.へ使う場合は、対象記事に適用できる範囲と、持ち込まない季節・生活イベントを分けて書く。調査Issueの対象月を記事の公開時期として扱わない。

進行編集は、対象Vol.、正式計画、milestone、公開日が一致しない提案をIssue本文へ反映せず、ライターreadyにしない。別Vol.参照に適用範囲と除外範囲がない場合も同様とする。

Article Issueには公開予定日、公開予定週、または `publishAt` を必須とする。ライターへreadyを付けられるのは、JSTの現在週に公開予定の記事、または公開72時間前に入った次週の記事で、公開週ごとに2本までとする。72時間の先行窓は、毎日14:00のライターデスクを48時間前のProduction cutoffより前に最低1回確保するためだけに使い、公開日や公開間隔は変更しない。

同一週に2本公開する場合、進行編集はライターへreadyを付ける前に各Issueへ具体的な公開日を割り当てる。同日公開は禁止し、記事間の `publishAt` は48時間以上空ける。公開間隔は `pnpm content:check` と `pnpm article:schedule` でも検証する。

- 公開72時間前より先の未来週、または日付不明の記事は `planned` にする。
- 未来週のライター修正も、公開72時間前に入るまでは `planned` にする。`revise` を付けたまま待機させない。
- 現在週、過去、または公開72時間前に入った既存記事PRに具体的な修正がある場合だけ、担当ライターの `revise` にする。

## Editorial Integrity Gate

未公開記事はfrontmatterの `editorial` に、GitHub Issue番号、対象Vol.、承認済み計画、計画上の見出し、公開日、brief確認日、参照Vol.を保持する。`pnpm content:check` は対象Vol.と計画path、計画上の見出し、publishAtと公開日の一致を検査する。別Vol.を参照する場合は `crossVolumeRationale` に加え、`crossVolumeReview` へ参照先の計画見出し、使用可能な話題、持ち込まない話題、進行編集承認を構造化して記録する。

ライター完了後、進行編集は本文と `editorial` metadataを照合し、不一致ならビジュアル編集へ渡さない。別Vol.参照では、参照先の記事見出しと本文の中心表現が重なる場合や、除外話題が本文にある場合も差し戻す。見逃した場合も、校正が正式計画、公開時期、別Vol.参照を独立確認し、軽微な不一致を同じ記事branchで補正する。記事の核がずれている場合は進行編集経由でライターへ差し戻す。

校正は問題解消後だけ `editorial.integrityReview.status: passed` と `reviewedBy: agent:copy-editor` を記録する。別Vol.参照をacceptedで残す場合は、その後に進行編集が参照先記事の独立性を再確認し、`crossVolumeReview.managingEditorApproval` をapprovedにする。`pnpm article:schedule`、`pnpm publish:check`、`pnpm article:publish` は校正または必要な進行編集承認が未完了なら失敗する。

## Formal Volume Cover

正式計画がmainに入ったら、進行編集は `[Vol. XXX][VISUAL] 正式カバー制作` を1件作る。記事heroやサンプル画像を流用せず、`type:visual`、`type:volume-cover`、`agent:visual-editor`、milestoneを付ける。

ビジュアル編集は `origin/main` から専用branchを作り、正式カバー、sidecar、Vol. frontmatterだけを1つのPRにする。詳細ゲートは `docs/editorial/ai-visual-policy.md` に従う。最初の記事公開前に正式カバーがなければ公開担当へ渡さない。

## Article Production Gates

1. ライターは `editorial` metadataを作り、既存画像を流用せず、`heroImage: __AI_VISUAL_PENDING__` とビジュアルブリーフを残す。
2. ビジュアル編集は同じ記事PR branchでAI画像、alt、caption、sidecarを完成させる。画像生成ツールが使えない場合はブリーフを残し、`agent:visual-editor` + `kotatsu:revise` にする。未生成のままreviewへ進めない。
3. 進行編集は本文と `editorial` metadataを正式計画・公開日に照合し、実画像を拡大して季節、多様性、モデル同一性、床置き防止をポリシーと照合する。通過分だけcopy-editorへreadyで渡す。
4. 校正は同じbranchで文体、事実、禁止表現、読者信頼に加えて計画・公開時期・別Vol.参照を独立確認し、`integrityReview` を記録してreviewへ戻す。別Vol.参照を残す場合はacceptedとしても進行編集承認待ちにする。
5. 進行編集は残修正がなく `integrityReview` がpassedで、別Vol.参照がある場合は `managingEditorApproval` もapprovedの場合だけ `pnpm article:schedule -- --slug=<slug>` を実行する。続けて `pnpm article:handoff -- --slug=<slug>` を実行し、出力されたstate labelとagent labelをそのままIssueへ反映する。未来時刻ならplanned、到来済みならpublisher + publishへ進め、更新後のIssueを再取得して一致を確認する。
6. 公開担当は `pnpm publish:check -- --candidate=<slug>`、`pnpm article:publish -- --slug=<slug>`、`pnpm check`、`pnpm build` を順に通す。PRのVisual Check成功後に `pnpm visual:artifact -- --run-id=<run id> --repo=withbugs/kotatsu` を終了まで待ち、列挙されたdesktop/mobile画像をすべて開いてから最終記事PRをmainへmergeする。

記事状態は必ず `draft -> scheduled -> published` とする。公開担当はfrontmatterを手作業でpublishedにしない。

GitHub ActionsのCIとVisual Checkは必須である。ローカルの `pnpm test:visual` は任意の事前確認だが、PR上のVisual Check成功とdesktop/mobile screenshot artifactの確認なしにmergeしない。artifact取得は数分無出力でもコマンド終了まで待ち、途中のdirectoryを空と判定しない。

公開後も週1〜2本、月4〜8本を守る。公開URL、PR、実行したチェックをIssueへコメントし、doneにしてcloseする。失敗時はcloseせず、進行編集が次に判断できる状態へ戻す。
