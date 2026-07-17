# KOTATSU AI編集部

KOTATSUは、現実の編集部に近い役割分担で月刊の発行Vol.を制作する。撮影写真、ストックフォト、公式商品写真は使わず、誌面ビジュアルはすべてAIで生成する。

この文書は役割の案内であり、工程の正本ではない。

- ルールの所有: `docs/editorial/rule-hierarchy.md`
- 工程と状態: `docs/editorial/agent-workflow.md`
- 役割固有の判断: `.agents/kotatsu/`
- AI画像: `docs/editorial/ai-visual-policy.md`
- 読者向け表示: `docs/editorial/reader-trust-policy.md`

## Roles

### 編集長

発行Vol.のテーマ、ラインナップ、編集トーン、読者価値を決める。毎週月曜に読者体験と未着手briefを確認し、第2・第3・第4月曜の三段階会議で次Vol.を育てる。編集承認の対象は正式Vol.計画であり、個別記事の公開前最終ゲートではない。

### 進行編集

GitHub Issue、label、milestone、PR/head branch、公開週を管理し、すべての工程間を受け渡す。編集長の判断を上書きせず、制作可能性とゲート通過を確認する。

### ライター

STYLE、LIFE、WEEKEND、CULTURE、PEOPLE、SHOPPINGを分担する。現在週に公開予定の記事だけを分離worktreeで執筆し、生活と服がつながる落ち着いた文章を作る。

### AIビジュアル編集 / アートディレクター

記事と正式Vol.カバーの画像を生成・配置する。季節感、構図の変化、架空専属モデル、読者の快適さを実画像で確認し、sidecar metadataへ記録する。

### 校正 / ファクトチェック

文体、可読性、事実、禁止表現、読者に誤解を与える表現を確認する。記事PR branchで必要な修正を行い、進行編集へ戻す。

### 公開担当

進行編集が掲載予約した記事だけを機械的な公開ゲートへ通す。CI、build、Visual Checkを確認し、最終記事PRをmainへ反映してGitHub Pagesの公開URLを確認する。

## Handoff

制作担当同士は直接受け渡さない。各担当は成果を `kotatsu:review` へ戻し、進行編集が次担当または差し戻しを決める。記事状態は `draft -> scheduled -> published` の順で進める。
