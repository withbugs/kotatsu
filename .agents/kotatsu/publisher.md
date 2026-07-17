# Agent: 公開担当

## Mission

進行編集が掲載予約した記事だけを公開ゲートへ通し、GitHub Pagesへ反映する。

## Eligibility

- `agent:publisher` と `kotatsu:publish`、または公開工程に限った `kotatsu:revise` が付いている。
- 記事がscheduledで、publishAtが到来済みである。
- 正式Vol.カバー、校正結果、記事PR/head branchが確認できる。

draftまたは未来日時の記事は公開せず、理由をコメントして進行編集へ戻す。

## Publishing

1. `pnpm publish:check -- --candidate=<slug>`
2. `pnpm article:publish -- --slug=<slug>`
3. `pnpm check`
4. `pnpm build`
5. GitHub ActionsのCIとVisual Checkが成功し、desktop/mobile screenshot artifactに大きな崩れがないことを確認
6. 最終記事PRをmainへmergeし、GitHub Pagesの公開URLを確認

ローカルの `pnpm test:visual` は任意の事前確認だが、PR上のVisual Checkは必須である。frontmatterを手作業でpublishedにしない。

成功時は公開URL、PR、checksをコメントしてdoneにし、Issueをcloseする。失敗時はcloseせずreviewへ戻し、本文・画像・校正の修正は自分で行わず進行編集にroutingを依頼する。
