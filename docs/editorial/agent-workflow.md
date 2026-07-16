# Issue駆動の制作ワークフロー

GitHub Issueを編集タスクとして扱い、labelとmilestoneで状態を管理する。

予定済みエージェントのGitHubアクセスは `docs/editorial/github-access-policy.md` に従う。定期実行ではGitHub ConnectorやMCPを使わず、Issue、PR、Actionsの読み書きにローカルの `gh` CLIを使用する。Connector承認をユーザーへ要求しない。

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
- `kotatsu:revise`: 現担当への修正依頼。次回の担当エージェント起動で自動再処理する
- `kotatsu:publish`: 公開準備待ち
- `kotatsu:done`: 完了

計画段階:

- `planning:research`: 第2月曜のウェブ調査と需要把握
- `planning:shortlist`: 第3月曜の候補比較と仮決定
- `planning:finalize`: 第4月曜の最終調査と正式計画

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

候補メモは第2月曜の `planning:research` で作成し、第3月曜の `planning:shortlist` まで同じplanning branchとDraft PRで更新する。第2・第3月曜には正式計画を作成しない。第4月曜の `planning:finalize` で最新のウェブ調査を反映し、編集長がテーマと記事構成を最終判断した場合だけ `docs/editorial/plans/vol-XXX.md` を追加してPRをReadyにする。

Vol. 002以降の候補メモには、調査更新日、検索語3件以上、ウェブ需要シグナル、読者需要の仮説、テーマ候補、季節感、記事構成候補、参照情報を残す。参照情報はURL4件以上、確認日付き、情報種別3種類以上とする。検索・トレンド情報はユーザー需要を示す根拠として扱うが、採用理由はKOTATSUの価値観、長く読める有用性、生活との接続まで編集長が説明する。

正式計画には、調査サマリー、ウェブ需要シグナル、読者需要の判断、発行月と日本の想定気候、服の素材・袖丈・重ね着、光・湿度・雨・植物などの季節要素、別の季節に見せてしまう要素、執筆直前の再確認方針を明記する。ウェブ検索が利用できない場合は、その事実を記録して正式計画を確定せず、次回会議へ持ち越す。

正式計画を制作進行へ渡せるのは、計画PRが作られた時点ではなく、`docs/editorial/plans/vol-XXX.md` が `main` に反映され、通常の作業ディレクトリから読める時点とする。進行編集は、承認済み正式計画PRのCI、mergeability、Draft状態、承認根拠を確認し、問題がなければ `main` へ反映する。`main` で正式計画を確認できる場合だけ、正式Vol.カバー、記事、記事ビジュアル、校正、公開準備のGitHub Issueを展開する。進行上の不足がある場合は、理由をGitHub Issueコメントに明記して `kotatsu:revise` と `agent:editor-in-chief` へ戻す。


## 三段階の編集会議

次Vol.の計画Issueとplanning PRは、次の段階で3週間かけて育てる。

1. 第2月曜 `planning:research`: 進行編集が9:00にIssueをready化し、編集長が10:00に最新ウェブ検索を行う。候補メモとDraft PRを作り、正式計画は作らない。
2. 同日12:00: 進行編集は検索語、URL、確認日、情報種別、需要シグナルと仮説の区別を確認する。十分なら `planning:shortlist` と `kotatsu:planned` にし、第3月曜までreadyにしない。不足なら同じ段階のまま `kotatsu:revise` にする。
3. 第3月曜 `planning:shortlist`: 9:00にready化し、10:00に調査を更新して候補を比較し、テーマと記事構成を仮決定する。同じplanning branchとDraft PRを更新し、正式計画はまだ作らない。
4. 同日12:00: 進行編集が確認し、十分なら `planning:finalize` と `kotatsu:planned` にして第4月曜まで保持する。
5. 第4月曜 `planning:finalize`: 9:00にready化し、10:00に最新ウェブ検索と未着手記事の需要を再確認する。編集長が正式計画を作成して編集承認し、planning PRをReadyにする。
6. 同日12:00: 進行編集が `pnpm content:check`、CI、PR、承認根拠を確認し、問題がなければmainへ反映して制作Issueを展開する。

第5月曜がある場合は、次のVol.を作らず、確定済み計画と未着手記事のpreflightに使う。

## 執筆直前のbrief更新

毎週月曜10:00、編集長は今後14日以内に執筆開始予定で、まだ `kotatsu:running` ではなく記事PRもないIssueを確認する。新しい検索需要、季節、生活イベント、読者の関心を示すウェブ情報があれば、日付とURLを付けてbrief修正を提案する。進行編集は12:00に採否を判断し、14:00のライター起動前にIssue本文を整える。

執筆開始後は、短期トレンドだけを理由に方向転換しない。事実誤認、季節の不一致、安全性、読者の信頼に関わる新情報だけを修正理由とする。

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
- `type:volume-plan`、`agent:editor-in-chief`、`planning:research`、`kotatsu:ready` を付け、`agent:managing-editor` と `kotatsu:running` は付けない。
- Issue本文には、対象発行月、planning branch、Draft PR、候補メモ `docs/editorial/candidates/vol-XXX.md`、正式計画 `docs/editorial/plans/vol-XXX.md`、三段階の日程、ウェブ調査要件、季節感の必須項目、週1〜2本・月4〜8本の公開条件を記す。
- 9:00に作成したIssueは、10:00の編集長がそのまま着手できる状態にする。

## 初期ブートストラップ

リポジトリにVol.コンテンツ、正式計画、milestone、openまたはclosedのVol.設計GitHub Issueが一切存在しない初回だけ、進行編集が `Vol. 001: 創刊Vol.テーマ検討` を新規作成する。初期GitHub Issueには `type:volume-plan`, `agent:editor-in-chief`, `planning:research`, `kotatsu:ready` を付ける。`agent:managing-editor` は付けない。

9:00の進行編集は、新規作成したVol.設計GitHub Issueを `kotatsu:running` にせず、10:00の編集長が着手できる状態に留める。

## 担当自動化の起動

各担当エージェントは、工程ごとに時間帯を分けて実行する。ラベルそのものが常駐プロセスを起動するのではなく、各自動化がGitHub Issueを確認し、自分の `agent:*` label と、`kotatsu:ready` または `kotatsu:revise` が揃ったIssueを処理する。

進行編集は、工程間の受け渡し役として1日3回動く。

- Day 1 09:00 進行編集: 前日分整理、当日の対象確認、label/milestone/担当確認、滞留Issue整理。第2月曜以降は、重複がない場合だけ翌暦月のVol.設計GitHub Issueを1件作成する
- Day 1 10:00 編集長: 担当Issueの編集判断。第2・第3・第4月曜は計画段階に応じてウェブ調査、仮決定、正式確定を分ける。毎週、未着手記事のbriefも最新需要に照らして確認する
- Day 1 12:00 進行編集: research/shortlist段階は成果を確認して次月曜までplannedで保持する。finalize段階だけ正式計画PRを確認し、問題なければ `main` へ反映して制作Issueを展開する
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
- ビジュアル編集 -> 校正: 同じ記事PR branch上でAI生成ビジュアル、alt、caption、metadata、避けた要素を確認する。実画像の服装、素材、光、天候、小物が発行時期に自然で、直近2本のheroと構図、距離、色温度、密度、登場モデルが十分に異なること。プロンプトやaltに季節名があるだけ、またはsidecarに差異を書いただけでは通過させない。専属AIモデル使用時は登録済み `modelId`、reference sheetとの同一性、実在人物との非類似も確認する。
- 校正 -> 公開担当: 同じ記事PR branch上で校正結果が公開可能で、残修正がないこと。
- 公開担当 -> `main`: 公開ゲート、CI、build、可能な範囲のスクリーンショット確認が通った最終記事PRだけを `main` にマージする。

記事PR branchが不明、checkout不可、CIの重大失敗、記事ファイル不明、または正式計画未参照の場合は次工程へ渡さず、GitHub Issueコメントに停止理由と必要作業を書く。

## `kotatsu:ready` の責任

`kotatsu:ready` は「次担当が迷わず着手できる状態」を示す。原則として進行編集が最終管理者として付与、維持、解除を判断する。ユーザー、編集長、各担当エージェントが `kotatsu:ready` を提案することはできるが、前工程の不足、担当label、milestone、公開週、素材条件、必要成果物の所在（`main` または記事PR branch）を確認して確定するのは進行編集の役割とする。ライターへ渡す場合は、JSTの現在週に公開予定の記事だけを `kotatsu:ready` にする。

各担当エージェントは、自分の作業が終わったら `kotatsu:review` に進め、GitHub Issueコメントで次担当候補を提案する。進行編集がその内容を確認し、次の `agent:*` label と `kotatsu:ready` を整えて次工程へ渡す。Vol.設計GitHub Issueでは、編集長が編集承認者、進行編集が制作進行上の通過判定者となる。進行上の不足がある場合は `kotatsu:revise` と `agent:editor-in-chief` へ戻す。

## `kotatsu:revise` の再処理

`kotatsu:revise` は保留状態ではなく、現在の `agent:*` に対する具体的な修正依頼を示す。差し戻す側は、`kotatsu:ready`、`kotatsu:review`、`kotatsu:running`、`kotatsu:planned`、`kotatsu:publish` を外し、担当labelを1つにし、修正理由、対象PR、head branch、完了条件をIssueコメントへ記録する。

- 各担当自動化は `kotatsu:ready` と `kotatsu:revise` の両方を対象にする。
- 再着手時は `kotatsu:ready` または `kotatsu:revise` を外して `kotatsu:running` にする。
- 差し戻しコメントに記載された不足だけを直し、同じ記事PR branchを使う。新しいPRを重複作成しない。
- 作業中だけDraft PRを使用できる。担当作業の完了時はPRをReady for reviewにし、Issueを `kotatsu:review` へ戻す。
- ライターの未来週記事は `kotatsu:planned` で保持する。ただし、公開予定週が現在週または過去で、既存PRへの具体的な修正依頼がある場合は `kotatsu:revise` を優先して再処理する。
- 進行編集は毎回、前回の担当起動時刻を過ぎても更新されていない `kotatsu:revise` を確認する。担当label、差し戻し理由、PR、branchの不足を修復し、2回の担当起動を越えて動かない場合は停止理由を報告する。

## 自動実行の想定

Issue監視ジョブは、次の条件を満たすGitHub Issueを対象にする。

- openである
- `kotatsu:ready` または `kotatsu:revise` が付いている
- `agent:*` が1つ以上付いている
- milestoneが設定されている

各自動化は、工程ごとに分けた時間帯で、進行確認、Issue整理、担当エージェントへの受け渡し、担当作業のために行う。実行のたびに記事を公開または量産するものではない。公開ペースは週1〜2本、月4〜8本を基本とし、同一週で2本を超える場合は翌週以降または次Vol.候補として整理する。

処理の基本:

1. `kotatsu:ready` または `kotatsu:revise` を `kotatsu:running` に変更する。
2. 該当するagent role cardと `docs/editorial/ai-visual-policy.md` を読み込む。
3. GitHub Issue本文を入力として、必要な成果物を生成する。
4. 変更がある場合はbranchとPull Requestを作る。既存PRへの差し戻しでは同じbranchを更新し、完了時にPRをReady for reviewにする。
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
