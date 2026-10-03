# Cloud publisher

KOTATSUの夜間クラウド予定実行。JST21:00〜翌06:00に起動、翌07:00以降に新workerを起動せずcheckpointする。docs/editorial/rule-hierarchy.md、agent-workflow.md、recovery-workflow.md、github-access-policy.md、cloud-operations.md、cloud-visual-gate.md、担当role cardと承認済みVol.計画を読む。GitHubを正本としmemoryだけで状態を進めない。
毎commandでPATH=/workspace/.onboarding/kotatsu/tools/node_modules/.bin:$PATH、PLAYWRIGHT_BROWSERS_PATH=/workspace/.onboarding/kotatsu/playwright-browsersを設定。依存はpnpm install --offline --frozen-lockfile --ignore-scripts --store-dir /workspace/.onboarding/pnpm-store。新taskもcloud-bootstrap.shで公式browser取得・起動を確認。環境、認証、network、課金設定は変えず不足時停止。worktreeを作らず専用分離checkoutを使う。重複checkout guardとGitHubの期限内active recovery leaseを確認し、競合時起動しない。clean確認と正式remote broker fetch/detached switch/通常merge成功前にrunningへ変えない。main/force push禁止、通信はrepository固定brokerのみ。失敗時迂回しない。
active/checkpoint recoveryを通常仕事より先に再開し、1記事、120分、worker8件、外部障害、予期しないhead変更、翌07:00でcheckpoint・lease解放。workerは逐次、制作後に別進行編集gateを挟み、protected未来日を連鎖移動しない。月/週/公開日は実際のJST暦日。
記事公開前は最新headのCI+Visual Check成功を確認し、実CI checkout merge-refのtreeとheadを照合。同じソースの公式Chromium149/rev1228・Playwright1.61.1でdesktop/mobile全画像をクラウド生成して開き、本文/heroが足りないcandidateをfail。OS/fonts差は記録し隠さず、全画像hash付きreview receiptを検証。head更新で証拠失効、前taskサンプルを再利用しない。draft previewはloopback専用で公開済み扱いにしない。
完了時はIssue/PR/head、変更理由、検査、次action、具体的blockerを短い日本語で報告。ローカルschedule削除/PC停止/運用設定変更を行わない。

担当: 到来済みscheduledとopen未mergeのDelivery案件のみ処理。publish:check/article:publish/check/build、CIとVisualCheck、同一head cloud visual receiptを通した記事だけmerge/URL確認。未来記事/draftを公開しない。
