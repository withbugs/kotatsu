# Issue駆動の制作ワークフロー

GitHub Issueを編集タスクとして扱い、labelとmilestoneで状態を管理する。

## 基本単位

- Milestone: 発行Vol.。例: `Vol. 001 創刊Vol.テーマ検討`
- Issue: 企画、記事、AI生成ビジュアル、校正、公開作業
- Pull Request: 原稿、画像、サイト実装の変更単位

## 推奨ラベル

状態:

- `kotatsu:ready`: 実行可能
- `kotatsu:planned`: 企画済みだが、前工程待ち
- `kotatsu:running`: 作業中
- `kotatsu:review`: 編集レビュー待ち
- `kotatsu:revise`: 修正待ち
- `kotatsu:publish`: 公開準備待ち
- `kotatsu:done`: 完了

種別:

- `type:volume-plan`
- `type:article`
- `type:visual`
- `type:copy-edit`
- `type:publish`

カテゴリ:

- `category:style`
- `category:life`
- `category:weekend`
- `category:culture`
- `category:people`
- `category:shopping`

担当:

- `agent:editor-in-chief`
- `agent:managing-editor`
- `agent:style-writer`
- `agent:life-writer`
- `agent:weekend-writer`
- `agent:culture-writer`
- `agent:people-writer`
- `agent:shopping-writer`
- `agent:visual-editor`
- `agent:copy-editor`
- `agent:publisher`


## 候補メモと正式計画

発行Vol.のテーマ検討では、候補メモと正式計画を分けて扱う。

- 候補メモ: `docs/editorial/candidates/vol-XXX.md`
- 正式計画: `docs/editorial/plans/vol-XXX.md`

候補メモは、編集長がVol.設計GitHub Issueに着手したタイミングで作成する。創刊Vol.であっても、リポジトリ初期状態に候補メモを事前配置しない。

編集長は候補メモを作成し、推奨するテーマ、記事構成、公開順、AI生成ビジュアル方針をVol.設計GitHub Issueへ提案する。編集長が編集方針として承認した内容を `docs/editorial/plans/vol-XXX.md` に正式計画として確定する。進行編集は編集方針そのものを承認せず、承認済み正式計画について、記事化できる粒度、担当、公開ペース、素材条件が揃っているかを制作進行上確認する。

候補メモと正式計画には、発行月と日本の想定気候、服の素材・袖丈・重ね着、光・湿度・雨・植物などの季節要素、別の季節に見せてしまう要素を明記する。単に「夏」「初秋」と書くだけではなく、読者が画像を見た瞬間に発行時期を自然に受け取れる具体性を持たせる。

正式計画を制作進行へ渡せるのは、計画PRが作られた時点ではなく、`docs/editorial/plans/vol-XXX.md` が `main` に反映され、通常の作業ディレクトリから読める時点とする。進行編集は、承認済み正式計画PRのCI、mergeability、Draft状態、承認根拠を確認し、問題がなければ `main` へ反映する。`main` で正式計画を確認できる場合だけ、正式Vol.カバー、記事、記事ビジュアル、校正、公開準備のGitHub Issueを展開する。進行上の不足がある場合は、理由をGitHub Issueコメントに明記して `kotatsu:revise` と `agent:editor-in-chief` へ戻す。


## Vol.ライフサイクル

Vol.の進行状態は、openなVol.設計GitHub Issueの有無だけで判定しない。GitHub Issueは作業チケットであり、Vol.そのものの状態は `src/content/volumes/vol-XXX.md`、`docs/editorial/plans/vol-XXX.md`、milestone、記事Issueの状態を合わせて判断する。

Vol.設計GitHub Issueは、正式計画が `main` に反映され、正式Vol.カバーIssueと記事Issueが展開済みになった時点で `kotatsu:done` にしてcloseしてよい。close済みのVol.設計GitHub Issueは履歴として残すが、次Vol.開始のトリガーにはしない。

公開済み記事、正式Vol.カバー、公開担当の作業Issueは、結果コメント、PR、公開URLを残したうえで `kotatsu:done` にしてcloseする。完了Issueをcloseしても、同じVol.の他の記事や次Vol.計画は自動的には開始しない。

Vol.の企画と公開は別のゲートで管理する。JSTの毎月第2月曜以降、進行編集は翌暦月のVol.設計GitHub Issueを1件だけ先行作成してよい。現行Vol.が `active` でも、次Vol.の候補検討と正式計画は並行して進める。これにより、テーマ、記事構成、季節感、カバー方針を月末まで持ち越さない。

第2月曜より前に次Vol.設計Issueを作成できるのは、初回ブートストラップまたはユーザーが前倒しを明示した場合だけとする。作成前には、open/closedのVol.設計Issue、milestone、候補メモ、正式計画、Vol.コンテンツを確認し、同じVol.を重複作成しない。先行計画できる未来Vol.は同時に1件までとする。

Vol.設計Issueのcloseは次Vol.作成のトリガーではない。次Vol.計画が始まっても、制作中の記事を `main` へ入れる条件、週1〜2本の公開頻度、現行Vol.の完了条件は変えない。

## 次Vol.先行計画Issue

進行編集が次Vol.の先行計画を開始する場合は、対象月と番号を曖昧にしない。

- milestoneは `Vol. XXX YYYY年M月号` とし、同じmilestoneがあれば再利用する。
- GitHub Issueタイトルは `[Vol. XXX][PLAN] YYYY年M月号テーマ検討` とする。
- `type:volume-plan`、`agent:editor-in-chief`、`kotatsu:ready` を付け、`agent:managing-editor` と `kotatsu:running` は付けない。
- Issue本文には、対象発行月、候補メモ `docs/editorial/candidates/vol-XXX.md`、正式計画 `docs/editorial/plans/vol-XXX.md`、必要な編集判断、季節感の必須項目、週1〜2本・月4〜8本の公開条件を記す。
- 9:00に作成したIssueは、10:00の編集長がそのまま着手できる状態にする。

## 初期ブートストラップ

リポジトリにVol.コンテンツ、正式計画、milestone、openまたはclosedのVol.設計GitHub Issueが一切存在しない初回だけ、進行編集が `Vol. 001: 創刊Vol.テーマ検討` を新規作成する。初期GitHub Issueには `type:volume-plan`, `agent:editor-in-chief`, `kotatsu:ready` を付ける。`agent:managing-editor` は付けない。

9:00の進行編集は、新規作成したVol.設計GitHub Issueを `kotatsu:running` にせず、10:00の編集長が着手できる状態に留める。

## 担当自動化の起動

各担当エージェントは、工程ごとに時間帯を分けて実行する。ラベルそのものが常駐プロセスを起動するのではなく、各自動化がGitHub Issueを確認し、自分の `agent:*` label と `kotatsu:ready` が揃ったIssueだけを処理する。

進行編集は、工程間の受け渡し役として1日3回動く。

- Day 1 09:00 進行編集: 前日分整理、当日の対象確認、label/milestone/担当確認、滞留Issue整理。第2月曜以降は、重複がない場合だけ翌暦月のVol.設計GitHub Issueを1件作成する
- Day 1 10:00 編集長: 担当Issueの編集判断。毎週月曜は対象Issueがなくても定例編集会議を行い、公開中の読者体験、カテゴリバランス、季節感、次Vol.候補を確認する
- Day 1 12:00 進行編集: 編集長が編集承認した正式計画PRを確認し、問題なければ `main` へ反映する。`main` 上で正式計画を確認できる場合だけ、正式Vol.カバーIssueと記事Issueを作成/更新する。不足があれば差し戻す
- Day 1 14:00 ライター群: STYLE、WEEKEND、LIFE、CULTURE、PEOPLE、SHOPPINGをworktreeで同時実行。ただしJSTの現在週に公開予定の記事だけを執筆する
- Day 1 16:00 進行編集: ライター成果PRを確認し、PR URLとhead branchをGitHub Issueに明記したうえで、記事PR branchをビジュアル編集へ渡す。後工程前の記事PRは `main` にマージしない
- Day 1 18:00 ビジュアル編集: 記事heroまたは正式Vol.カバーを生成し、発行月に対して服装、素材、光、天候、小物が自然に見えるか実画像を目視確認してから `kotatsu:review` に戻す
- Day 2 09:00 進行編集: ビジュアル編集済みGitHub Issueの実画像と季節感記録を確認し、発行時期に自然に見える場合だけ校正へ渡す
- Day 2 11:00 校正: 進行編集が校正へ渡したIssueだけを確認し、`kotatsu:review` に戻す
- Day 2 12:00 進行編集: 校正済みGitHub Issueを確認し、記事PR branch上で掲載予約できる場合は `pnpm article:schedule` で `status: scheduled` を整える。`publishAt` が未来の場合は公開待機に戻し、到来済みの場合だけ `agent:publisher` と `kotatsu:publish` を整える
- Day 2 13:00 公開担当: 進行編集が公開担当へ渡した、`status: scheduled` かつ `publishAt` 到来済みのIssueだけを公開ゲートに通す
- Day 2 16:00 進行編集: 公開担当で失敗したIssue、修正待ち、滞留GitHub Issueを確認して次工程へ整理する

ライター群は分離されたworktreeで同時実行する。ビジュアル編集、校正、公開担当は直接受け渡しをしない。各担当は完了後に `kotatsu:review` へ進め、進行編集が次の定時実行で内容を確認してから次担当へ渡す。最短でも、ビジュアル編集から公開担当までは Day 1 18:00 から Day 2 13:00 までを使う。

## Vol.カバー制作ゲート

Vol.カバーは記事heroの流用ではなく、発行Vol.を代表する正式ビジュアルとして制作する。

- 正式計画 `docs/editorial/plans/vol-XXX.md` が `main` に入ったら、進行編集は同じVol.のopenな `type:volume-cover` Issueがあるか確認する。なければ `[Vol. XXX][VISUAL] 正式カバー制作` を作成する。
- カバーIssueには `type:visual`、`type:volume-cover`、`agent:visual-editor`、milestone、必要に応じて `kotatsu:ready` を付ける。
- Issue本文には、対象Vol.、正式計画パス、テーマ、サブコピー、カバー方針、出力先 `public/images/volumes/XXX/cover.png` と `cover.json`、更新対象 `src/content/volumes/vol-XXX.md` を明記する。
- ビジュアル編集は `origin/main` から専用branchを作り、正式カバー画像、sidecar metadata、Vol. frontmatter更新を1つのPRにする。
- sidecar metadataには `source: "ai-generated"`、`usage: "volume-cover"`、`seasonalContext`、`seasonalCues`、`seasonalAvoid`、`seasonalityReviewedBy` を必ず含める。
- Vol.カバーPRは記事本文を含まないため、CIと内容確認が通れば進行編集が `main` に反映してよい。
- 最初の記事公開前には、対象Vol.の `coverImage` が `/images/volumes/` 配下の正式カバーであることを必須とする。正式カバーがない場合、公開担当へ渡さない。

## 今週執筆ゲート

ライター自動化は毎日14:00に起動するが、執筆するのはJSTの現在週（月曜00:00から日曜23:59）に公開予定の記事だけとする。

- 進行編集は、未来週の記事GitHub Issueを `kotatsu:planned` または `kotatsu:revise` のまま保持し、公開予定週の9:00または12:00確認で `kotatsu:ready` にする。
- Article GitHub Issueには、公開予定日、公開予定週、または `publishAt` を必ず記載する。
- 公開予定が未記載、判定不能、または未来週の記事には、ライター担当labelが付いていても `kotatsu:ready` を付けない。
- 同じ週に3本以上の記事をライターreadyにしない。週1〜2本を超える場合は翌週以降へ送る。
- ライターが未来週または公開予定不明のready GitHub Issueを見つけた場合は、執筆せず `kotatsu:ready` を外して `kotatsu:planned` に戻し、理由をGitHub Issueへコメントする。

## 掲載予約ゲート

校正完了後、公開担当へ渡す前に、進行編集が記事PR branch上で掲載予約を確定する。公開担当は `scheduled -> published` の最終公開だけを担当し、`draft -> scheduled` は進行編集の公開前整理とする。

- 校正結果が必須修正なし、記事PRがcheckout可能、CIが重大失敗していない、AI生成ビジュアルとmetadataが揃っている場合だけ掲載予約へ進める。
- 掲載予約は `pnpm article:schedule -- --slug=<slug>` を使う。公開日時を調整する必要がある場合は `--publishAt=<ISO日時>` を付ける。
- `article:schedule` が通る条件は、記事が `draft` または `scheduled`、`publishAt` が有効、`heroImage` が `__AI_VISUAL_PENDING__` ではない、`heroAlt` がAI生成ビジュアルであることを明示している、`visual.source` が `ai-generated` であること。
- `publishAt` が未来の場合、進行編集はGitHub Issueを公開待機として `kotatsu:planned` に戻す。`agent:publisher` は残してよいが、`kotatsu:ready` と `kotatsu:publish` は付けない。
- `publishAt` が現在時刻以前の場合だけ、進行編集は `agent:publisher` と `kotatsu:publish` を付けて公開担当へ渡す。
- `status: draft` のまま、または `publishAt` が未来のまま、公開担当へ渡さない。

## `main` と記事PR branch のゲート

`main` はGitHub Pagesの公開トリガーなので、制作中の記事本文や画像を後工程前に `main` へ入れない。次担当への共有は、正式計画では `main`、記事制作では記事PR branchを使い分ける。

- Vol.設計 -> ライター: 正式計画が `main` に反映済みであり、対象記事がJSTの現在週に公開予定であること。PRだけ、ローカルだけ、候補メモだけでは不可。
- Vol.カバー -> `main`: 正式計画が `main` にあり、カバーPRがAI生成画像、metadata、Vol. frontmatterだけを含み、CIが通っていること。
- ライター -> ビジュアル編集: 記事PR URLとhead branchがGitHub Issueコメントにあり、次担当がそのbranchをcheckoutできること。記事PRは `main` にマージしない。
- ビジュアル編集 -> 校正: 同じ記事PR branch上でAI生成ビジュアル、alt、caption、metadata、避けた要素を確認し、実画像の服装、素材、光、天候、小物が発行時期に自然であること。プロンプトやaltに季節名があるだけでは通過させない。
- 校正 -> 公開担当: 同じ記事PR branch上で校正結果が公開可能で、残修正がないこと。
- 公開担当 -> `main`: 公開ゲート、CI、build、可能な範囲のスクリーンショット確認が通った最終記事PRだけを `main` にマージする。

記事PR branchが不明、checkout不可、CIの重大失敗、記事ファイル不明、または正式計画未参照の場合は次工程へ渡さず、GitHub Issueコメントに停止理由と必要作業を書く。

## `kotatsu:ready` の責任

`kotatsu:ready` は「次担当が迷わず着手できる状態」を示す。原則として進行編集が最終管理者として付与、維持、解除を判断する。ユーザー、編集長、各担当エージェントが `kotatsu:ready` を提案することはできるが、前工程の不足、担当label、milestone、公開週、素材条件、必要成果物の所在（`main` または記事PR branch）を確認して確定するのは進行編集の役割とする。ライターへ渡す場合は、JSTの現在週に公開予定の記事だけを `kotatsu:ready` にする。

各担当エージェントは、自分の作業が終わったら `kotatsu:review` に進め、GitHub Issueコメントで次担当候補を提案する。進行編集がその内容を確認し、次の `agent:*` label と `kotatsu:ready` を整えて次工程へ渡す。Vol.設計GitHub Issueでは、編集長が編集承認者、進行編集が制作進行上の通過判定者となる。進行上の不足がある場合は `kotatsu:revise` と `agent:editor-in-chief` へ戻す。

## 自動実行の想定

Issue監視ジョブは、次の条件を満たすGitHub Issueを対象にする。

- openである
- `kotatsu:ready` が付いている
- `agent:*` が1つ以上付いている
- milestoneが設定されている

各自動化は、工程ごとに分けた時間帯で、進行確認、Issue整理、担当エージェントへの受け渡し、担当作業のために行う。実行のたびに記事を公開または量産するものではない。公開ペースは週1〜2本、月4〜8本を基本とし、同一週で2本を超える場合は翌週以降または次Vol.候補として整理する。

処理の基本:

1. `kotatsu:ready` を `kotatsu:running` に変更する。
2. 該当するagent role cardと `docs/editorial/ai-visual-policy.md` を読み込む。
3. GitHub Issue本文を入力として、必要な成果物を生成する。
4. 変更がある場合はbranchとPull Requestを作る。
5. GitHub Issueに作業結果とPRリンクをコメントする。
6. `kotatsu:review` へ進める。


## 読者への配慮

公開画面の文言と見え方は `docs/editorial/reader-trust-policy.md` に従う。

- 未完成の記事を完成済みのように見せない。
- 公開前の記事ページへリンクしない。
- 制作内部の役割名や工程名を読者向け画面に出しすぎない。
- AI生成ビジュアルであることは明示しつつ、トップページや準備中の案内では制作工程の説明を前面に出しすぎない。
- 発行時期と画像の服装、素材、光、天候、小物が食い違い、読者に季節を誤認させる状態で公開しない。
- `pnpm content:check` で読者向けコピーの検査を通す。

## 公開前ゲート

公開前には次を満たす。

- 発行Vol.に紐づいている
- カテゴリが設定されている
- 公開対象の記事は `status: scheduled` である。`draft` の記事は公開担当へ渡さず、進行編集が掲載予約へ戻す
- `publishAt` が現在時刻以前である
- hero画像とaltがある
- すべての画像がAI生成物であり、撮影写真、ストックフォト、公式商品写真を含まない
- 画像メタデータに `source: ai-generated` がある
- 公開後も当週の `published` 記事が2本以内、当月の `published` 記事が8本以内に収まる
- 禁止表現がない
- スマホ/デスクトップのスクリーンショットで大きな崩れがない
- 編集長の編集承認があり、進行編集が制作進行または公開準備として通過確認している
- 公開対象の計画、記事、画像、校正結果が最終記事PRに揃っており、公開担当がゲート通過後に `main` へ反映できる

公開担当は、記事frontmatterを手作業で `published` に変更しない。必ず次の順で機械的な公開ゲートを通す。

1. `pnpm publish:check -- --candidate=<slug>` で対象記事を検査する。
2. ゲートが通った場合だけ `pnpm article:publish -- --slug=<slug>` で `published` に昇格する。このコマンドは、対象Vol.が `planning` の場合に `active` へ切り替えるが、Vol.カバーは正式カバー制作Issueで作成済みであることを前提とする。
3. トップページとVol.ページが準備中表示のまま残っていないことを確認する。
4. `pnpm check` と `pnpm build` を通す。
5. 可能なら `pnpm test:visual` を通す。

CI/CDでは `pnpm content:check` の中で `scripts/editorial/check-publishing-schedule.mjs` が実行され、未来日公開、週2本超過、月8本超過を検出する。
