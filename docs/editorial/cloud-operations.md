# 夜間クラウド運用（切替レビュー中）

この変更は設定を有効化しない。ローカル6件停止の親確認までmergeしない。親コーディネーターがmerge後にモデル利用可否と環境setupを確認し、ローカル6予定を削除せずpauseしてから単一親dispatcherを有効化する。昼間/クラウドの同時有効化は禁止。問題時は下記のコード・正本rollbackを完了してからローカルをresumeする。PC停止、購入、認証、network変更は含めない。

`cloud-schedules.json` と `prompts/kotatsu/cloud-*.md` が確認用の6設定と完全prompt。時刻はJSTで従来から+12時間。

| 役割 | 時刻 | 元モデル / reasoning |
| --- | --- | --- |
| managing-editor | 21:00、00:00、04:00 | gpt-5.6-terra / high |
| editor-in-chief | 22:00 | gpt-5.6-sol / high |
| visual-editor | 22:00、06:00 | gpt-5.6-sol / high |
| copy-editor | 23:00、03:00 | gpt-5.6-sol / high |
| publisher | 01:00、05:00 | gpt-5.6-terra / high |
| writer-desk | 02:00 | gpt-5.6-sol / high |

モデル名は既存予定の希望値を保存したもの。利用可能と仮定せず親が確認し、不在なら勝手にモデル変更・運用開始しない。00〜06時は開始夜の翌暦日。月曜22時の会議成果を火曜00時にdesk確認する。公開日、公開週、月次計画は実際のJST暦日で判定する。21時のDelivery再予約は翌日0時以降の公開枠、05時台は当日枠、06時以降は翌日枠を使い、月跨ぎ再検証と48時間間隔を維持する。

復旧起動枠は21:00〜翌06:00（06時台の最終起動を含む）、翌07:00で新worker停止。1記事、120分、8worker、外部blocker、予期しないhead変更でもcheckpointとlease解放。予定を増やして障害を迂回しない。

## 分離checkoutとguard

新taskは既存の専用分離checkout `/workspace/kotatsu` を使用し、worktreeを作成しない。clean確認、正式remote broker fetch、対象branchへのdetached switch、origin/main通常mergeの順序を保ち、前の実行の部分変更が残れば停止する。reset/clean/forceで捨てない。

親が単一dispatcherをJST21、22、23、00、01、02、03、04、05、06時に起動する。各slotの正確なscheduled JST datetime+roleをdurable ledgerへ重複なく登録し、承認済み保存環境からfresh native cloud taskを役ごとに作成する。22時は編集長→visualを直列化しvisualのscheduled_atは22時のまま保持する。実行中の次枠はpendingで残す。各役のモデル/highと完全promptはcloud-schedules.jsonとcloud-task-spec.mjsから機械的に生成する。

rootの最初のツール操作はidentity bootstrap、続いて `cloud-run-guard.mjs begin <role> --apply=true`。beginが返ってもGit CAS leaseとlocal owner記録は保持され、モデルtaskの全後続作業・復旧workerを保護する。rootはtokenを子へ渡し、子はverifyして逐次実行し再claimしない。CLIの一部shellを包む方式には依存しない。モデルが中断・消失したときもleaseは残り、人がnative taskと全worker停止を確認するまで次を起動しない。

最後の外部操作として `cloud-run-guard.mjs finish <token> --apply=true --workers-stopped=true` を実行する。local owner一致、remote owner一致、CAS解除の成功後だけlocal lockを消す。親もnative task terminal、全worker停止、共有ref不在を再照合する。期限経過だけの削除・盗取は禁止。

共有refは固定 refs/heads/kotatsu/cloud-editorial-lease。空expectedのcreateとowner SHA一致deleteのみでmain/article refは選べない。全resolved fetch/push URLは単一canonicalに限定し、環境/include/globalを含むeffective URL rewriteを拒否。実送信先も固定HTTPS URL。公開lease commitのauthor/committerもwithbugs/noreplyに固定する。

`cloud-dispatch.mjs` はslot登録・順序・starting/running/unknown/completedのfail-closed遷移を検査する。これはqueueの永続化やnative task作成APIそのものではない。親はdurable ledgerをoptimistic version付きで保存し、starting intentの保存成功前にtaskを作らない。作成応答不明はstarting/unknownのままholdし、native task照合なしに再作成しない。後続slotと再起動時もledgerを読み直す。exactly-onceとは主張しない。07時以降はpendingをcheckpointし新roleを開始しない。

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

## コードと正本のrollback

クラウド親dispatcherをpauseし、全root/worker停止と共有lease owner-only releaseを確認する。ローカル6予定は引き続きpauseする。切替時に記録した本PRのmerge/squash SHAを対象に、最新mainから専用rollback branchを作り `git revert`（merge commitなら `-m 1`）する。mainを過去SHAへresetせず、その後の他記事変更を保持し競合をレビューする。README、role cards、recovery-workflow、schedule-recoveryの昼間時刻が移行前正本へ戻ることを差分確認する。pnpm check/build、09/17/18/19時と日/週/月/年跨ぎの昼間回復境界を検証し、rollback PRのCI/Visual Checkを通して承認mergeする。元6担当の完全promptはLibrary libfile_d9d8547beed08191bacdb97634846bc5 の01-originalsから復元し、元モデル/時刻/責務を照合する。main正本とスクリプトと6promptが昼間枠で一致した確認後だけローカルをresumeする。pause/resumeだけでrollback完了にしない。

既存monthly-planning-recoveryには、当月Vol.記録が存在すると未完了当月計画でも月初にnot-dueへ落ち得るリスクがある。本PRは計画判定を全面改修しない。起動前に当月以前の未完了計画を別途確認し、存在すれば通常処理を止め正本所有者へ回送する。月初・年跨ぎと完了済み対象除外のnegative testsを保持する。

## Identity再発防止

各fresh taskの最初に kotatsu-identity.mjs bootstrap でrepo-local user.name/emailとtracked hooksを設定し、globalや他repoを変更しない。環境identity override、異なる既存hooks、不一致なら値を出さず停止。kotatsu-commit.mjsはGit実行前にlocal/effective両identityを検査。Gitがhookへ渡す正当なauthor envはpseudonym一致だけ許容する。pre-commit/pre-mergeでcommitを拒否し、pre-pushとremote brokerはorigin/main以外の全outgoing commitをauthor/committerとも照合する。--no-verifyやhooksPath overrideは禁止。native task envelopeは完全role promptのhashを保持して組み込み、identity/leaseの開始・終了手順を追加する。
