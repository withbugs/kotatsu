# 同一headクラウド画像確認

公開前の画像確認は、最新PR headと同一ソースからクラウド内でdesktop/mobile画像を生成し、すべて開いてreview receiptを作る方式へ移行する。CI artifactダウンロードは調査用に残すが、公開gateの代用にしない。GitHub Actions CIとVisual Check成功を省略しない。

1. 正式brokerで最新記事branchとmainを取得しclean checkoutを準備する。変更をcommit/pushしたheadを固定し、`pnpm check`、`pnpm build` を通す。
2. 新taskも `cloud-bootstrap.sh` で公式ブラウザを復元。PATHとPLAYWRIGHT_BROWSERS_PATH、offline storeをcloud-operationsどおり設定する。
3. `pnpm visual:cloud generate --candidate=<slug> --dir=<fresh-absolute-directory>` を実行する。既存12 layoutテストをproduction buildで実行し、candidate記事をdesktop/mobileで追加検査する。本文100文字以上、実hero画像、HTTP200、画像読み込み、overflowを必須にする。
4. `manifest.json` に列挙された画像を1枚ずつ画像として開く。全画像の `file` / `sha256` を保持して `review.json` のopened=true、result=passed、reviewer、reviewedAt、environmentDifferencesを実確認後に記録する。崩れ、season、caption、本文/hero不整合があればpassedにせず同担当へ修正を戻す。
5. `pnpm recovery:actions` で最新headのCI/Visual Checkをreadyにし、`pnpm visual:cloud verify --dir=<directory> --pr=<number> --ci-run=<id> --visual-run=<id>` を実行する。runのheadと成功状態、実CIログのmerge checkout SHA、その取得objectのtreeとlocal head tree、source/lock/test/画像hash、OS/fonts不変、全画像reviewを検証する。情報が不足すればfail。merge直前にもPR headを再取得し、verified.jsonのheadと一致しなければ全gateをやり直す。
6. manifest/review/verifiedをdurableな検証資料へ保存しIssueにheadと資料を記録する。公開担当だけがmerge/Pages確認へ進む。

画像はhome、volume archive、Vol.001、最新published volume、candidate記事の全desktop/mobile（通常10枚）。candidateがdraft/scheduledなら同じ記事テンプレートをloopback dev専用で描画する。`KOTATSU_VISUAL_CANDIDATE` は `import.meta.env.DEV` のときだけ採用され、production buildはpublished記事だけを生成する。draft previewの成功を公開成功と呼ばない。

manifestはsource tree/full tracked-file hashes、lockfile、テスト、browser version/revision/runtime、OS、font inventory hashesと実描画font、routes、viewports/DPR、candidate本文/hero、全画像hashを固定記録する。OS/fontを勝手に入れ替えない。CIのUbuntuとcloudのDebian、フォント差はreceiptへ明示し、本番同等とは主張しない。不一致を隠して成功扱いにせず、見え方に問題があれば修正/環境再承認まで停止する。head更新、再merge、source/lock/test/画像/OS/fonts変更で証拠は失効する。

取得失敗を避けるため別mirror、proxy迂回、Actions手動成功、画像レビュー省略を使わない。必要な公式/read-only取得のみを行う。
