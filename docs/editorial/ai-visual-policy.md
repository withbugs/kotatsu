# AIビジュアル生成ポリシー

KOTATSUでは、撮影した写真を使用しない。誌面に使うすべてのビジュアルは、記事内容と編集意図に沿ってAIで生成する。

## 基本ルール

- 実写撮影、ストックフォト、商品公式写真、既存メディア写真は使用しない。
- フォトリアルな画像は使用してよいが、すべてAI生成物として扱う。
- 記事の性質に応じて、フォトリアル画像ではなくイラスト、コラージュ、静物画風のビジュアルを使ってよい。
- 人物、店舗、商品、ブランド、場所を実在のものとして誤認させない。
- 実在ブランドのロゴ、商標、著名人の顔、実在店舗の看板を生成しない。
- 記事ごとに、hero画像、本文画像、キャプション、alt、生成意図を残す。
- Vol.ごとに、正式カバー画像、sidecar metadata、coverAlt、生成意図を残す。

## 表記ルール

誌面内では、読者に撮影写真だと誤解させない。

推奨表現:

- AI-generated visual
- AI生成ビジュアル
- フォトリアル画像
- イラストレーション
- ビジュアル

避ける表現:

- 撮影写真
- 現地撮影
- 取材撮影
- 写真家による撮影
- 実際の店舗写真

## 生成ディレクション

ビジュアル担当は、各記事に対して次を定義する。

- `visualMode`: `photorealistic`, `illustration`, `collage`, `still-life`
- `editorialIntent`: 記事で残したい感覚
- `subject`: 画像の主題
- `setting`: 場所、時間帯、光
- `composition`: 構図、余白、焦点距離の方向
- `colorMood`: 色、明るさ、質感
- `avoid`: 生成してはいけないもの


## 季節感ゲート

読者が画像を見た瞬間に、発行時期と大きく異なる季節を想像しないことを必須とする。メタデータやaltに「夏」「初秋」と書くだけでは合格としない。生成後の実画像を確認し、服装、素材、重ね着、光、天候、植物、路面、小物が発行時期に自然か判断する。

季節感の基準は、Vol.の `month`、記事の `publishAt`、日本の一般的な気候を組み合わせて決める。正式計画と画像metadataには次を残す。

- `seasonalContext`: 発行時期、想定地域、気温・湿度・天候
- `seasonalCues`: 素材、袖丈、重ね着、光、雨、植物、飲み物など、画像に見える具体的な要素を2件以上
- `seasonalAvoid`: 別の季節に見せる危険がある服装、色調、小物、光を2件以上
- `seasonalityReviewedBy`: 実画像を確認した担当。ビジュアル編集では `agent:visual-editor`

生成前には季節要素をプロンプトへ含め、生成後には画像そのものを目視する。たとえば盛夏の記事で「薄い羽織」と書いていても、画像が厚手の濃色ジャケット、長袖の重ね着、暖色の室内光に見える場合は差し戻す。KOTATSUの落ち着いた色調を守ることと、季節を曖昧にすることは同義ではない。

このメタデータゲートは、2026年7月12日以降に公開予定の記事とVol. 002以降の正式カバーへ適用する。既存の公開済み記事を遡って書き換えるのではなく、次に制作する画像から確実に適用する。

## ビジュアルシークエンスと重複防止

KOTATSUらしさは、木のテーブル、コーヒー、白シャツ、茶色い自然光を繰り返すことではない。静けさを保ちながら、記事ごとに見る距離、人物の有無、動き、場所、色温度を変え、Vol.全体に誌面のリズムを作る。

新しい記事heroとVol.カバーは、生成前に直近3本、採用前に少なくとも直近2本の公開画像を実画像で比較する。次を必須とする。

- 隣接する記事heroで同じ `compositionFamily` を繰り返さない。
- 木のテーブル上の静物、真上からのフラットレイ、後ろ姿の街歩きなど、同じ視覚文法を連続させない。
- 4本のheroのうち、静物を主役にする画像は原則2本までとする。
- 人物、環境の広景、生活動作、手元や素材の接写、静物、イラストまたはコラージュを、記事内容に合わせて組み替える。
- 人物を使う場合も、毎回同じモデル、同じ服、同じカメラ距離、同じ立ち姿にしない。
- 「落ち着いた色」を茶、オリーブ、黒だけで表現しない。季節に応じて白、青みのあるグレー、淡い緑、雨の反射、乾いた光なども使う。

2026年7月18日以降に公開予定の記事とVol. 002以降の正式カバーは、sidecar metadataに次を残す。

- `compositionFamily`: `human-environmental-medium-wide`、`still-life-oblique`、`street-observation-wide`、`material-macro`、`editorial-illustration` など構図の系統
- `cameraDistance`: `wide`、`medium-wide`、`medium`、`close`、`macro`
- `visualTemperature`: `cool`、`neutral`、`warm`、`mixed`
- `visualDensity`: `airy`、`balanced`、`dense`
- `dominantPalette`: 主要色を3件以上
- `similarityReviewedAgainst`: 比較した直近の公開記事slugを2件以上
- `visualDifference`: 直近画像と何を変えたか

盛夏ではプロンプト上の季節語だけでなく、画像の面積で温度感を判断する。茶色い木面、琥珀色の光、濃色の革、厚い布、深い暖色影が大きな面積を占める場合は、半袖や水筒が写っていても暑苦しく見えるため再生成する。寒色化そのものを目的にはせず、読者が画面を見た瞬間に感じる温度、空気、重さを記事の公開時期へ合わせる。

## 架空の専属AIモデル

実在人物の使用は禁止する。一方、`docs/editorial/models/roster.json` に登録した完全に架空のAI生成モデルは、顔や全身を含めて使用してよい。人物はKOTATSUの生活感と連続性を作る編集資産であり、実在の取材対象や読者の体験談として扱わない。

- 実在人物、著名人、モデル、公開された写真を顔の参照にしない。似て見える場合は採用せず再生成する。
- 再登場時は登録済みreference sheetをidentity referenceに使い、顔、見た目年齢、髪、体格、恒常的な特徴を保つ。
- 記事ごとに服、場所、動作、季節は変えてよい。同じ無彩色の制服へ収束させない。
- 専属モデルが登場するsidecarには `modelId` を記録する。
- 隣接する記事heroで同じ専属モデルを続けて使わない。連載として編集承認された場合だけ例外とする。
- 架空の勤務先、住所、発言、病歴、購入歴、実体験を事実として付与しない。
- reference sheet自体を記事画像として公開しない。

詳細な台帳とidentity workflowは [models/README.md](models/README.md) に従う。

## Vol.カバー

Vol.カバーは、記事heroや初期サンプル画像の流用ではなく、発行Vol.のテーマを代表する正式なAI生成ビジュアルとして制作する。

- 出力先は `public/images/volumes/XXX/cover.png` とする。`XXX` は `001` のような3桁番号。
- metadata sidecarは `public/images/volumes/XXX/cover.json` とする。
- metadataには `source: "ai-generated"` と `usage: "volume-cover"` を必ず含める。
- `src/content/volumes/vol-XXX.md` の `coverImage`、`coverAlt`、`visual` を更新する。
- `coverAlt` には `AI生成ビジュアル` を含め、撮影写真と誤認させない。
- 最初の記事公開前に正式Vol.カバーが存在することを原則とする。
## サンプル画像の扱い

初期表示や検証のために生成した画像を、記事やVol.の正式ビジュアルとして流用しない。ライター初稿では `heroImage: __AI_VISUAL_PENDING__` を使い、ビジュアル編集工程で記事ごとに意図へ沿ったAI生成画像を作成して差し替える。

公開予定または公開済みの記事に `__AI_VISUAL_PENDING__` が残っていてはいけない。
## メタデータ

公開する画像には、対応するメタデータを残す。

例:

```json
{
  "source": "ai-generated",
  "visualMode": "photorealistic",
  "editorialIntent": "週末の朝に、自分のリズムへ戻る感覚",
  "compositionFamily": "human-environmental-medium-wide",
  "cameraDistance": "medium-wide",
  "visualTemperature": "cool",
  "visualDensity": "airy",
  "dominantPalette": ["pale gray", "soft blue", "white"],
  "modelId": "K-02-RUI",
  "promptSummary": "雨上がりの窓辺で、架空の専属AIモデルが週末の天気をノートに記す",
  "seasonalContext": "2026年8月の日本、蒸し暑い週末の朝",
  "seasonalCues": ["風通しのよい薄手の綿", "強い日差しと深い日陰"],
  "seasonalAvoid": ["厚手のジャケット", "秋冬に見える暖色の室内光"],
  "seasonalityReviewedBy": "agent:visual-editor",
  "similarityReviewedAgainst": ["previous-article-a", "previous-article-b"],
  "visualDifference": "直近の静物と街の後ろ姿を避け、顔の見える生活動作と雨上がりの寒色へ切り替えた。",
  "avoid": ["real brand logos", "celebrity faces", "stock photo look"],
  "reviewedBy": "agent:visual-editor"
}
```

## 公開前チェック

公開担当は次を確認する。

- 画像がAI生成物であることが明記されている。
- 実写撮影、ストックフォト、公式商品写真を使っていない。
- altとキャプションが記事の編集意図に合っている。
- 実在人物、実在店舗、実在ブランドの誤認リスクがない。
- スクリーンショット確認で、hero画像、本文画像、キャプションが破綻していない。
- 実画像の服装、素材、重ね着、光、天候、小物が発行時期に自然で、別の季節に見えない。

