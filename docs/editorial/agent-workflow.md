# Issue駆動の制作ワークフロー

GitHub Issueを編集タスクとして扱い、labelとmilestoneで状態を管理する。

## 基本単位

- Milestone: 月刊号。例: `ISSUE 001 創刊号テーマ検討`
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

- `type:monthly-issue`
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

月刊号のテーマ検討では、候補メモと正式計画を分けて扱う。

- 候補メモ: `docs/editorial/candidates/issue-XXX.md`
- 正式計画: `docs/editorial/plans/issue-XXX.md`

候補メモは、編集長が月刊号設計Issueに着手したタイミングで作成する。創刊号であっても、リポジトリ初期状態に候補メモを事前配置しない。

編集長は候補メモを作成し、推奨するテーマ、記事構成、公開順、AI生成ビジュアル方針を月刊号設計Issueへ提案する。編集長が編集方針として承認した内容を `docs/editorial/plans/issue-XXX.md` に正式計画として確定する。進行編集は編集方針そのものを承認せず、承認済み正式計画について、記事化できる粒度、担当、公開ペース、素材条件が揃っているかを制作進行上確認する。

正式計画を制作進行へ渡せるのは、計画PRが作られた時点ではなく、`docs/editorial/plans/issue-XXX.md` が `main` に反映され、通常の作業ディレクトリから読める時点とする。進行編集は、承認済み正式計画PRのCI、mergeability、Draft状態、承認根拠を確認し、問題がなければ `main` へ反映する。`main` で正式計画を確認できる場合だけ、記事、ビジュアル、校正、公開準備のIssueを展開する。進行上の不足がある場合は、理由をIssueコメントに明記して `kotatsu:revise` と `agent:editor-in-chief` へ戻す。


## 初期ブートストラップ

創刊号をまっさらな状態から始める場合、進行対象は open Issue だけで判定する。close済みIssue、削除済みIssue、archive配下の文書、過去の失敗作Issueは、進行対象や存在判定に使わない。

open の月刊号設計Issueが存在しない場合だけ、進行編集が `ISSUE 001: 創刊号テーマ検討` を新規作成する。初期Issueには `type:monthly-issue`, `agent:editor-in-chief`, `kotatsu:ready` を付ける。`agent:managing-editor` は付けない。

9:00の進行編集は、新規作成した月刊号設計Issueを `kotatsu:running` にせず、10:00の編集長が着手できる状態に留める。
## 担当自動化の起動

各担当エージェントは、工程ごとに時間帯を分けて実行する。ラベルそのものが常駐プロセスを起動するのではなく、各自動化がGitHub Issueを確認し、自分の `agent:*` label と `kotatsu:ready` が揃ったIssueだけを処理する。

進行編集は、工程間の受け渡し役として1日3回動く。

- Day 1 09:00 進行編集: 前日分整理、当日の対象確認、label/milestone/担当確認、滞留Issue整理。月刊号設計Issueがなければ作成する
- Day 1 10:00 編集長: 号全体、企画、見出し、公開可否の編集判断
- Day 1 12:00 進行編集: 編集長が編集承認した正式計画PRを確認し、問題なければ `main` へ反映する。`main` 上で正式計画を確認できる場合だけ記事Issue化してライターへ渡す。不足があれば差し戻す
- Day 1 14:00 ライター群: STYLE、WEEKEND、LIFE、CULTURE、PEOPLE、SHOPPINGをworktreeで同時実行
- Day 1 16:00 進行編集: ライター成果PRを確認し、PR URLとhead branchをIssueに明記したうえで、記事PR branchをビジュアル編集へ渡す。後工程前の記事PRは `main` にマージしない
- Day 1 18:00 ビジュアル編集: AI生成ビジュアル、alt、プロンプト要約、メタデータ、配置方針を整え、`kotatsu:review` に戻す
- Day 2 09:00 進行編集: ビジュアル編集済みIssueを確認し、校正へ渡せる場合だけ `agent:copy-editor` と `kotatsu:ready` を整える
- Day 2 11:00 校正: 進行編集が校正へ渡したIssueだけを確認し、`kotatsu:review` に戻す
- Day 2 12:00 進行編集: 校正済みIssueを確認し、公開準備へ進められる場合だけ `agent:publisher` と `kotatsu:publish` または `kotatsu:ready` を整える
- Day 2 13:00 公開担当: 進行編集が公開担当へ渡したIssueだけを公開ゲートに通す
- Day 2 16:00 進行編集: 公開担当で失敗したIssue、修正待ち、滞留Issueを確認して次工程へ整理する

ライター群は分離されたworktreeで同時実行する。ビジュアル編集、校正、公開担当は直接受け渡しをしない。各担当は完了後に `kotatsu:review` へ進め、進行編集が次の定時実行で内容を確認してから次担当へ渡す。最短でも、ビジュアル編集から公開担当までは Day 1 18:00 から Day 2 13:00 までを使う。

## `main` と記事PR branch のゲート

`main` はGitHub Pagesの公開トリガーなので、制作中の記事本文や画像を後工程前に `main` へ入れない。次担当への共有は、正式計画では `main`、記事制作では記事PR branchを使い分ける。

- 月刊号設計 -> ライター: 正式計画が `main` に反映済みであること。PRだけ、ローカルだけ、候補メモだけでは不可。
- ライター -> ビジュアル編集: 記事PR URLとhead branchがIssueコメントにあり、次担当がそのbranchをcheckoutできること。記事PRは `main` にマージしない。
- ビジュアル編集 -> 校正: 同じ記事PR branch上でAI生成ビジュアル、alt、caption、metadata、避けた要素が確認できること。
- 校正 -> 公開担当: 同じ記事PR branch上で校正結果が公開可能で、残修正がないこと。
- 公開担当 -> `main`: 公開ゲート、CI、build、可能な範囲のスクリーンショット確認が通った最終記事PRだけを `main` にマージする。

記事PR branchが不明、checkout不可、CIの重大失敗、記事ファイル不明、または正式計画未参照の場合は次工程へ渡さず、Issueコメントに停止理由と必要作業を書く。

## `kotatsu:ready` の責任

`kotatsu:ready` は「次担当が迷わず着手できる状態」を示す。原則として進行編集が最終管理者として付与、維持、解除を判断する。ユーザー、編集長、各担当エージェントが `kotatsu:ready` を提案することはできるが、前工程の不足、担当label、milestone、公開週、素材条件、必要成果物の所在（`main` または記事PR branch）を確認して確定するのは進行編集の役割とする。

各担当エージェントは、自分の作業が終わったら `kotatsu:review` に進め、Issueコメントで次担当候補を提案する。進行編集がその内容を確認し、次の `agent:*` label と `kotatsu:ready` を整えて次工程へ渡す。月刊号設計Issueでは、編集長が編集承認者、進行編集が制作進行上の通過判定者となる。進行上の不足がある場合は `kotatsu:revise` と `agent:editor-in-chief` へ戻す。

## 自動実行の想定

Issue監視ジョブは、次の条件を満たすIssueを対象にする。

- openである
- `kotatsu:ready` が付いている
- `agent:*` が1つ以上付いている
- milestoneが設定されている

各自動化は、工程ごとに分けた時間帯で、進行確認、Issue整理、担当エージェントへの受け渡し、担当作業のために行う。実行のたびに記事を公開または量産するものではない。公開ペースは週1〜2本、月4〜8本を基本とし、同一週で2本を超える場合は翌週以降または次号候補として整理する。

処理の基本:

1. `kotatsu:ready` を `kotatsu:running` に変更する。
2. 該当するagent role cardと `docs/editorial/ai-visual-policy.md` を読み込む。
3. Issue本文を入力として、必要な成果物を生成する。
4. 変更がある場合はbranchとPull Requestを作る。
5. Issueに作業結果とPRリンクをコメントする。
6. `kotatsu:review` へ進める。


## 読者への配慮

公開画面の文言と見え方は `docs/editorial/reader-trust-policy.md` に従う。

- 未完成の記事を完成済みのように見せない。
- 公開前の記事ページへリンクしない。
- 制作内部の役割名や工程名を読者向け画面に出しすぎない。
- AI生成ビジュアルであることは明示しつつ、トップページや準備中の案内では制作工程の説明を前面に出しすぎない。
- `pnpm content:check` で読者向けコピーの検査を通す。

## 公開前ゲート

公開前には次を満たす。

- 月刊号に紐づいている
- カテゴリが設定されている
- 公開対象の記事は `status: scheduled` である
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
2. ゲートが通った場合だけ `pnpm article:publish -- --slug=<slug>` で `published` に昇格する。
3. `pnpm check` と `pnpm build` を通す。
4. 可能なら `pnpm test:visual` を通す。

CI/CDでは `pnpm content:check` の中で `scripts/editorial/check-publishing-schedule.mjs` が実行され、未来日公開、週2本超過、月8本超過を検出する。




