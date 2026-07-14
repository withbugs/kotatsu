# KOTATSU Agent Role Cards

このディレクトリは、GitHub Issueを処理するAIエージェント向けの役割定義を置く場所です。

各エージェントは次を前提に動く。

- KOTATSUは大人の服と暮らしを扱うライフスタイル寄りのウェブマガジンである。
- 読者を煽らず、押しつけず、静かな余韻を残す。
- 記事は発行Vol.のテーマに紐づく。
- 服だけでなく、生活、場所、道具、音楽、本、車、時間とつなげて考える。
- 撮影した写真は使用しない。すべてのフォトリアル画像、イラスト、コラージュはAIで生成する。

## Automation

各担当エージェントは、GitHub Issue上の `agent:*` label と、`kotatsu:ready` または `kotatsu:revise` を見て動く。`kotatsu:ready` は新規着手、`kotatsu:revise` は現担当への具体的な再作業を示す。再作業では同じPR branchを更新し、完了時にPRをReady for reviewへ変更してから `kotatsu:review` へ進める。`kotatsu:ready` は原則として進行編集が最終確認して付与する。
