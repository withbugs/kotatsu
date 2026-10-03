# 夜間クラウド運用（切替レビュー中）

この変更は設定を有効化しない。親コーディネーターがmerge後にモデル利用可否と環境setupを確認し、ローカル6予定を削除せずpauseしてからクラウド6予定を有効化する。昼間/クラウドの同時有効化は禁止。問題時はクラウドをpause、進行中leaseの解放を確認してからローカルをresumeする。PC停止、購入、認証、network変更は含めない。

`cloud-schedules.json` と `prompts/kotatsu/cloud-*.md` が確認用の6設定と完全prompt。時刻はJSTで従来から+12時間。

| 役割 | 時刻 | 元モデル / reasoning |
| --- | --- | --- |
| managing-editor | 21:00、00:00、04:00 | gpt-5.6-terra / high |
| editor-in-chief | 22:00 | gpt-5.6-terra / high |
| visual-editor | 22:00、06:00 | gpt-5.6-sol / high |
| copy-editor | 23:00、03:00 | gpt-5.6-sol / high |
| publisher | 01:00、05:00 | gpt-5.6-sol / high |
| writer-desk | 02:00 | gpt-5.6-sol / high |

モデル名は既存予定の希望値を保存したもの。利用可能と仮定せず親が確認し、不在なら勝手にモデル変更・運用開始しない。00〜06時は開始夜の翌暦日。月曜22時の会議成果を火曜00時にdesk確認する。公開日、公開週、月次計画は実際のJST暦日で判定する。21時のDelivery再予約は翌日0時以降の公開枠、05時台は当日枠、06時以降は翌日枠を使い、月跨ぎ再検証と48時間間隔を維持する。

復旧起動枠は21:00〜翌06:00（06時台の最終起動を含む）、翌07:00で新worker停止。1記事、120分、8worker、外部blocker、予期しないhead変更でもcheckpointとlease解放。予定を増やして障害を迂回しない。

## 分離checkoutとguard

新taskは既存の専用分離checkout `/workspace/kotatsu` を使用し、worktreeを作成しない。clean確認、正式remote broker fetch、対象branchへのdetached switch、origin/main通常mergeの順序を保ち、前の実行の部分変更が残れば停止する。reset/clean/forceで捨てない。

全roleは同じcheckoutを変更し得るので、承認済みrole launcher全体を `node scripts/editorial/cloud-run-guard.mjs <role> -- <approved launcher>` で囲む。local leaseは全role共通、重複起動を拒否し終了時に解放する。lockが残った場合はownerと実行状態を人が確認し、勝手にlockを削除しない。別環境にも適用されるGitHub Issue上の期限内active leaseとrunning更新時刻も確認する。22時に編集長/visualが重なるため、競合した実行はqueueの状態を進めず次回同担当へ残す。guardは別環境間の排他を保証しない。

## 新task bootstrap案

各commandは以下の環境を設定する。秘密をコピーせず既存runtimeの正式brokerを使う。

```bash
export PATH=/workspace/.onboarding/kotatsu/tools/node_modules/.bin:$PATH
export PLAYWRIGHT_BROWSERS_PATH=/workspace/.onboarding/kotatsu/playwright-browsers
pnpm install --offline --frozen-lockfile --ignore-scripts --store-dir /workspace/.onboarding/pnpm-store
bash scripts/editorial/cloud-bootstrap.sh
```

bootstrapは既存offline storeがない場合に停止する。公式Playwright1.61.1が指定するChromium149.0.7827.55 revision1228だけを公式installで復元し、起動確認する。現在taskのcacheが将来残るとは仮定しない。mirror、download-host override、認証変更、OS package追加を自動実行しない。不足OS依存は具体的に報告する。環境setupへの登録と環境公開は別承認作業であり、このPRで変更しない。

## 品質gate

CIとVisual Check成功は従来どおり必須。画像レビューの正本は `cloud-visual-gate.md`。サンプル成功を最新記事PRへ流用しない。candidate本文/heroがない場合はfail。head変更でrender/review/CI証拠が失効する。
