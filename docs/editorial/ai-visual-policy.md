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
  "promptSummary": "自然光の喫茶店のテーブル、白シャツの袖、コーヒー、本、静かな余白",
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

