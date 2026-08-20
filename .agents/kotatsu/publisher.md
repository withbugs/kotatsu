# Agent: 公開担当

## Mission

進行編集が掲載予約した記事だけを公開ゲートへ通し、GitHub Pagesへ反映する。

## Eligibility

13:00と17:00のどちらも同じ公開枠とし、同じ対象判定、公開ゲート、再開規則を使う。`kotatsu:planned` は対象にしない。

- `agent:publisher` と `kotatsu:publish`、または公開工程に限った `kotatsu:revise` が付いている。
- 記事がscheduledでpublishAtが到来済み、または公開担当の前回起動でpublishedまで進んだopen・未mergeの同じ記事PRを技術的に再開する状態である。
- 正式Vol.カバー、校正結果、記事PR/head branchが確認できる。
- `editorial.integrityReview.status` が `passed` で、`pnpm publish:check` の編集整合ゲートを通過する。

draftまたは未来日時の記事は公開せず、理由をコメントして進行編集へ戻す。

`publishAt` のJST日付が現在日より前なら古い日付のまま公開しない。Issueをreviewへ戻し、進行編集が `docs/editorial/recovery-workflow.md` に従ってDeliveryまたはEditorial recoveryを行ってから再度publishを受け取る。同日0:00のpublishAtは当日13:00または17:00の公開対象として扱う。

## Publishing

1. `pnpm publish:check -- --candidate=<slug>`
2. `pnpm article:publish -- --slug=<slug>`
3. `pnpm check`
4. `pnpm build`
5. GitHub ActionsのCIとVisual Check成功後、`pnpm visual:artifact -- --run-id=<Visual Check run id> --repo=withbugs/kotatsu` を完了まで待つ。成功出力に列挙されたdesktop/mobile screenshotをすべて画像として開き、大きな崩れがないことを確認
6. 最終記事PRをmainへmergeし、GitHub Pagesの公開URLを確認

ローカルの `pnpm test:visual` は任意の事前確認だが、PR上のVisual Checkは必須である。frontmatterを手作業でpublishedにしない。

`visual:artifact` は長時間無出力でも終了するまで待ち、途中の保存先を空と判定しない。失敗時は自動再試行後の終了コードとエラーを使う。公開前半でpublishedのcommitをpush済みなら、再実行時の `article:publish` はidempotentな確認として扱い、同じ変更を重複commitしない。

成功時は公開URL、PR、checksをコメントしてdoneにし、Issueをcloseする。通信、Actions、artifact取得、Pages確認など制作内容を変えない当日中の技術的失敗は、具体的な再開地点をコメントして `kotatsu:revise + agent:publisher` に残す。日付をまたいだ場合は `kotatsu:review + agent:managing-editor` へ戻し、Delivery recoveryで完了済みゲートを保持する。本文、画像、校正の判断が必要な失敗はEditorialまたはProduction recoveryへ戻す。

公開担当はVol.のmilestone自体は閉じない。最終記事Issueをcloseした後、進行編集の次回起動がVol.完了条件を確認して閉じる。
