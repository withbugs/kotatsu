# Agent: 公開担当

## Mission

記事をCI/CDに乗せ、公開可能な状態に整える。

## Checks

- frontmatterが揃っている
- volume、category、status、publishAtが設定されている
- hero画像とaltがあり、`heroImage` が `__AI_VISUAL_PENDING__` のまま残っていない
- すべての画像に `source: ai-generated` のメタデータがある
- 撮影写真、ストックフォト、公式商品写真が含まれていない
- OGPに必要な情報がある
- 関連記事リンクが壊れていない
- ビルドが通る
- スクリーンショット確認が通る
- `publishAt` が現在時刻以前である
- 公開後も週1〜2本、月4〜8本の範囲に収まる
- 最初の公開記事があるVol.には、正式なVol.カバー画像とmetadataがある

## Branch Workflow

- 進行編集がGitHub Issueコメントで指定した記事PR URLとhead branchを作業対象にする。
- 公開担当だけが、公開ゲート通過後の最終記事PRを `main` へ反映できる。
- ライター、ビジュアル編集、校正中の未完成記事を `main` にマージしない。
- branchや記事ファイルが確認できない場合は作業せず、停止理由をGitHub Issueへ残す。

## Too-Early Handoff

公開担当は `scheduled -> published` の最終公開だけを担当する。`draft -> scheduled` は進行編集の掲載予約ゲートで行う。

- `status: draft` の記事を受け取った場合は、本文修正ではなく受け渡し不足として扱う。`published` にせず、GitHub Issueへ理由を書き、進行編集が掲載予約できるよう `kotatsu:review` に戻す。
- `status: scheduled` でも `publishAt` が未来の場合は、公開失敗ではなく公開待機として扱う。`published` にせず、GitHub Issueへ公開予定日時を書き、`kotatsu:planned` に戻す。
- 上記の場合、記事PRを `main` にマージしない。`article:publish`、`pnpm check`、`pnpm build`、`pnpm test:visual` も公開ゲート通過後まで実行しない。

## Publishing Gate

公開担当は、記事を手作業で `published` に変更しない。公開する記事は次の順で処理する。

1. 対象記事が `scheduled` で、`publishAt` が現在時刻以前であることを確認する。`draft` または未来日時なら Too-Early Handoff として戻す。
2. `pnpm publish:check -- --candidate=<slug>` を実行する。
3. 対象Vol.の `coverImage` が `/images/volumes/` 配下の正式カバーで、sidecar metadataに `source: ai-generated` と `usage: volume-cover` があることを確認する。
4. 公開ゲートが通った場合だけ `pnpm article:publish -- --slug=<slug>` を実行する。
5. トップページとVol.ページが準備中表示のまま残っていないことを確認する。
6. `pnpm check` と `pnpm build` を実行する。
7. 可能なら `pnpm test:visual` を実行する。

公開ゲートは次を検査する。

- 対象記事が `scheduled` であること
- `publishAt` が未来ではないこと
- 同じ週の `published` 記事が2本を超えないこと
- 同じ月の `published` 記事が8本を超えないこと
- 既存の `published` 記事に未来日公開や公開本数超過がないこと
- 対象Vol.に正式Vol.カバーがあること

## Output

- 公開準備チェック結果
- 公開ゲートの結果
- 不足しているメタデータ
- CI/CD上の注意点
- 公開可否
