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
| `running` | 担当エージェント | `review` | 成果、PR/head branch、検証結果をコメント済み |
| `review` | 進行編集 | `ready` | 次担当へ渡せる |
| `review` | 進行編集 | `revise` | 現担当へ具体的な修正が必要 |
| `review` | 進行編集 | `planned` | 公開週、次会議、公開時刻などを待つ |
| `review` | 進行編集 | `publish` | 校正、掲載予約、公開時刻、正式カバーが揃う |
| `publish` / publisherの`revise` | 公開担当 | `running` | 公開作業開始時 |
| `running` | 公開担当 | `done` | `main`反映と公開URL確認が完了 |

`kotatsu:ready` の最終管理者は進行編集である。制作担当同士は直接次担当labelや `ready` / `publish` を付けず、必ず `review` へ戻す。

`kotatsu:revise` は待機labelではない。付与時は他の状態labelを外し、担当labelを1つにし、修正理由、PR URL、head branch、完了条件をコメントする。次回起動で処理させない修正は `planned` に置く。

## Branch And Handoff

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
| 1 | 12:00 | 進行編集 | 計画成果と校正成果を確認し、次工程または待機へ整理 |
| 1 | 14:00 | ライター群 | 現在週に公開予定の記事だけをworktreeで執筆 |
| 1 | 16:00 | 進行編集 | ライターPRを確認し、ビジュアル編集へ渡す |
| 1 | 18:00 | ビジュアル編集 | AI画像を生成・配置し、実画像とmetadataを確認 |
| 2 | 09:00 | 進行編集 | 実画像を確認し、通過分だけ校正へ渡す |
| 2 | 11:00 | 校正 | 同じ記事branchで校正し、reviewへ戻す |
| 2 | 12:00 | 進行編集 | 校正確認、`draft -> scheduled`、公開時刻判定 |
| 2 | 13:00 | 公開担当 | 到来済みのscheduled記事だけを公開 |
| 2 | 16:00 | 進行編集 | 公開失敗、修正、滞留を整理 |

最短でもビジュアル編集から公開まではDay 1 18:00からDay 2 13:00を使う。

## Monthly Planning

進行編集はJSTの第2月曜以降、翌暦月について未来Vol.1件だけを先行計画できる。第2月曜より前は、初回またはユーザーが前倒しを明示した場合だけ開始する。open/closedの計画Issue、milestone、候補メモ、正式計画、Vol.コンテンツを確認し、重複作成しない。

計画Issueは `[Vol. XXX][PLAN] YYYY年M月号テーマ検討` とし、`type:volume-plan`、`agent:editor-in-chief`、`planning:research`、`kotatsu:ready` を付ける。同じIssue、planning branch、Draft PRを3週間使う。

1. 第2月曜 `research`: 検索語3件以上、確認日付きURL4件以上、情報種別3種類以上で需要を調べ、候補メモだけを作る。
2. 第3月曜 `shortlist`: 調査を更新し、テーマとラインナップを仮決定する。正式計画は作らない。
3. 第4月曜 `finalize`: 調査を再更新し、テーマ、記事順、公開週、季節感、AIビジュアル方針を正式計画にする。編集長がVol.計画を編集承認し、PRをReadyにする。
4. 各月曜12:00に進行編集が成果を確認する。research/shortlistは次月曜までplanned、finalizeだけをmainへ反映する。

検索が利用できない場合は根拠を捏造せずfinalizeしない。第5月曜は新規計画ではなくpreflightに使う。個別記事の公開前に編集長の最終承認は設けず、編集長は週次会議とVol.計画承認で品質を担保する。

正式計画が `main` に入り、正式カバーIssueと記事Issueを展開したら、計画Issueはdoneでcloseできる。closeは次Vol.開始のトリガーではない。

## Brief And Weekly Writing Gate

毎週月曜10:00、編集長は今後14日以内に執筆開始予定で、まだrunningでも記事PR作成済みでもないIssueをウェブ需要、季節、生活イベントに照らして確認する。進行編集は採用した変更だけを14:00前にIssueへ反映する。執筆開始後は、事実、季節、安全、読者信頼の問題以外で短期トレンドによる方向転換をしない。

Article Issueには公開予定日、公開予定週、または `publishAt` を必須とする。ライターへreadyを付けられるのは、JSTの現在週に公開予定の記事だけで、同一週2本までとする。

同一週に2本公開する場合、進行編集はライターへreadyを付ける前に各Issueへ具体的な公開日を割り当てる。同日公開は禁止し、記事間の `publishAt` は48時間以上空ける。公開間隔は `pnpm content:check` と `pnpm article:schedule` でも検証する。

- 未来週または日付不明の記事は `planned` にする。
- 未来週のライター修正も、実施週までは `planned` にする。`revise` を付けたまま待機させない。
- 現在週または過去の既存記事PRに具体的な修正がある場合だけ、担当ライターの `revise` にする。

## Formal Volume Cover

正式計画がmainに入ったら、進行編集は `[Vol. XXX][VISUAL] 正式カバー制作` を1件作る。記事heroやサンプル画像を流用せず、`type:visual`、`type:volume-cover`、`agent:visual-editor`、milestoneを付ける。

ビジュアル編集は `origin/main` から専用branchを作り、正式カバー、sidecar、Vol. frontmatterだけを1つのPRにする。詳細ゲートは `docs/editorial/ai-visual-policy.md` に従う。最初の記事公開前に正式カバーがなければ公開担当へ渡さない。

## Article Production Gates

1. ライターは既存画像を流用せず、`heroImage: __AI_VISUAL_PENDING__` とビジュアルブリーフを残す。
2. ビジュアル編集は同じ記事PR branchでAI画像、alt、caption、sidecarを完成させる。画像生成ツールが使えない場合はブリーフを残し、`agent:visual-editor` + `kotatsu:revise` にする。未生成のままreviewへ進めない。
3. 進行編集は実画像を拡大し、季節、多様性、モデル同一性、床置き防止をポリシーと照合する。通過分だけcopy-editorへreadyで渡す。
4. 校正は同じbranchで文体、事実、禁止表現、読者信頼を確認してreviewへ戻す。
5. 進行編集は残修正がない場合だけ `pnpm article:schedule -- --slug=<slug>` を実行する。未来時刻ならplanned、到来済みならpublisher + publishへ進める。
6. 公開担当は `pnpm publish:check -- --candidate=<slug>`、`pnpm article:publish -- --slug=<slug>`、`pnpm check`、`pnpm build` を順に通し、最終記事PRをmainへmergeする。

記事状態は必ず `draft -> scheduled -> published` とする。公開担当はfrontmatterを手作業でpublishedにしない。

GitHub ActionsのCIとVisual Checkは必須である。ローカルの `pnpm test:visual` は任意の事前確認だが、PR上のVisual Check成功とdesktop/mobile screenshot artifactの確認なしにmergeしない。

公開後も週1〜2本、月4〜8本を守る。公開URL、PR、実行したチェックをIssueへコメントし、doneにしてcloseする。失敗時はcloseせず、進行編集が次に判断できる状態へ戻す。
