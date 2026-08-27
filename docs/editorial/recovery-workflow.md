# Editorial Recovery Lane

この文書は、予定済みタスクの欠損、通信障害、Actionsやartifactの失敗、公開予定日の超過から復旧する場合の正本である。通常制作の役割、品質基準、状態labelは `docs/editorial/agent-workflow.md` を使い、復旧の分類、再開地点、公開枠だけをこの文書で定める。

## Principles

- 復旧は、完了済み工程を繰り返さず、未完了地点から再開する。
- 本文、画像、校正の品質ゲートは省略しない。ただし、既に通過したゲートを技術障害だけで無効にしない。
- 復旧作業も予定済み担当エージェントの起動内で行い、この文書を根拠に人手で直接公開しない。
- GitHub Issue、記事PR、Actionsを永続キューとする。予定時刻を過去時刻として再現しない。
- 復旧の速さと公開カレンダーを分離する。制作上の未完了工程は速やかに完了させ、公開は読者向けの間隔を守る最短空き枠で行う。
- Delivery recoveryの7日判定は、記事の現在の `publishAt`、つまり最後に承認された掲載予約日から数える。`scheduleRecovery.originalPublishAt` は監査履歴であり、この判定には使わない。

## Planning Recovery

月次計画は記事制作とは別の期限付きレーンである。進行編集の09:00、12:00、16:00と編集長の10:00は、記事のRapid Recoveryより先に `pnpm planning:recover -- --apply` を実行する。コマンドはJSTの第2・第3・第4月曜から期待段階を機械判定し、現在月のVol.または翌月Vol.の計画欠落、stage遅延、重複をGitHub Issueとmilestoneから検出する。

計画Issueまたはmilestoneが欠けている場合、コマンドは未来Vol.1件の制限を確認し、次番号のmilestoneと `planning:research` の計画Issueだけを冪等に作る。別月のopen計画Issue、複数stage labelなどの矛盾があれば自動作成せず `blocked` を返す。予定実行は番号や対象月を推測で補わない。

`recovery-required` では、計画Issueに `<!-- kotatsu:planning-recovery -->`、session id、期待段階、現在段階、planning PR/head SHA、開始時刻、120分後の期限、`state: active` を記録する。Planning Recoveryのleaseは記事Rapid Recoveryのleaseと独立し、記事のactive/checkpointを理由に開始を遅らせない。同じ計画Issueの最新sessionが期限内のactiveである場合だけ二重開始を避け、checkpointは即時再開できる。

コーディネーターは、未完了の段階について編集長workerと別の進行編集workerを交互に1件ずつ起動する。順序はresearch、進行編集gate、shortlist、進行編集gate、finalize、進行編集gateであり、workerを並列実行しない。各編集長workerはその段階のウェブ調査、候補メモ、Issueコメント、planning branch commit、PRを完成させる。各進行編集workerは対象月、Vol.、stage成果、調査基準、branch、PR、CIを確認し、合格時だけ次stageへ進める。遅延中は次の月曜を待たず、同じ日中sessionで期待段階まで続ける。

finalize gate通過後、進行編集workerは承認済み計画PRをmainへmergeし、正式カバーIssueと計画どおりの記事Issueを作成して、計画Issueを `kotatsu:done` でcloseする。ここまでをPlanning Recoveryのgoalとし、正式カバー生成や記事制作は通常工程へ渡す。検索不能、未解消矛盾、外部障害、予期しないhead SHA変更、120分、worker 8件、19:00 JSTのいずれかで、現在段階、保持成果、次action、`endedAt`を記録して `state: checkpoint` としleaseを解放する。次の対象予定実行が固定曜日を待たず再開する。

## Rapid Recovery Dispatch

通常の時刻表は制作開始と障害時のfallbackであり、復旧工程間の待ち時間ではない。09:00から18:00までの予定済みタスクが遅延を発見した場合、そのroot実行が迅速復旧コーディネーターとなり、同じ実行内に役割別サブエージェントを逐次dispatchする。新しい高頻度automationや夜間枠は追加しない。10:00は編集長の予定済みタスクだけが全体復旧を開始し、同時刻のビジュアル編集は通常担当だけを扱う。

迅速復旧のゴールは「現在工程を終えること」ではなく、対象記事を安全に公開し、公開URLを確認してIssueをcloseすることである。root実行と後続の予定済みタスクは、Issueのactive goalを通常担当より優先し、役割ごとの修正、desk gate、公開ゲートを必要な順番で継続する。実施可能な `revise` は停止理由ではなく次workerへの入力として扱う。

ProductionまたはEditorial recoveryでは、制作担当workerの後に必ず別の進行編集workerが成果を確認し、通常と同じdesk gateで次担当を決める。制作担当同士の直接受け渡しは行わない。Delivery recoveryは既にdesk gateを通過しているため、公開担当workerへ直接委任できる。

rapid recovery sessionは次の手順で行う。

1. 工程が最も進み、元の公開予定が最も早い遅延記事を1件だけ選ぶ。
2. Issueへ `<!-- kotatsu:rapid-recovery -->`、session id、owner run、goal、class、現在工程、PR head SHA、開始時刻、120分後の期限、`active` 状態をコメントし、現在担当1つと `kotatsu:running` を反映して再取得する。最新のsession記録が `state: active` で期限内の場合だけ有効な別leaseとして扱い、開始しない。後続の `checkpoint`、`waiting-publishAt`、`completed` 記録があるsessionは、元のexpiresAtが未来でも排他leaseを持たない。
3. 現在工程のrole cardを指定してworkerを1件だけ起動する。workerには指定IssueとPR branchだけを扱い、別agentを起動せず、成果、検査、再開地点をGitHubへ残すよう明記する。
4. worker完了を待ってIssue、PR、Actionsとhead SHAを再取得する。ProductionまたはEditorialの制作workerがreviewへ戻した場合は進行編集workerを起動し、その判断後に必要な修正担当または次担当workerを起動する。実施可能な差し戻しは同じsessionで続け、workerを並列実行しない。
5. 公開完了でgoalを `completed` にする。人手でしか決められない編集判断、正本と実装の未解消矛盾、回復不能な外部障害、予期しないhead SHA変更、120分経過、worker 8件完了、19:00 JSTでは、現在工程、次action、`endedAt`を記録してgoalを `checkpoint` にし、その時点でleaseを解放する。19:00以降に新しいworkerを起動しない。

rootコーディネーター自身は本文、画像、校正、編集承認、公開を代行せず、最終記事PRをmainへmergeできるのは公開担当workerだけである。同じ障害fingerprintの再試行はsession内で1回までとし、再失敗時は現在工程、保持済みゲート、次actionを `kotatsu:revise` に残す。multi-agent tools、利用上限、PC、Codexアプリ、認証などの外部条件で続行できない場合もGitHubを永続checkpointとする。次に起動した日中の予定済みタスクは、新規session idとleaseを取得してcheckpointのgoalを通常作業より先に再開し、固定された担当時刻を待たない。

制作と品質ゲートが回復し、機械出力が未来の `publishAt` に対する `kotatsu:planned + agent:publisher` を返した場合は、goalを `waiting-publishAt` としてleaseを解放する。これは遅延中のactive/checkpointではなく正常な掲載待機であり、到来前の予定済みタスクは復旧優先対象にせず、ほかの記事制作を進める。公開日時が到来した公開担当が同じgoalを再開し、公開URL確認とIssue closeで `completed` にする。

## Recovery Classes

進行編集は、予定済み担当の起動が1回欠けた、予定工程から2時間を超えて進捗がない、または公開予定日を過ぎた対象を次の3種類に分類する。複数に当てはまる場合は、より下の編集判断を要する分類を使う。

| Class | Condition | Resume point |
| --- | --- | --- |
| Delivery | 校正、画像、CI、掲載予約を通過し、通信、Actions、artifact、Pages確認、mergeだけが未完了 | 公開担当が次の公開枠で再予約し、同じ起動内で公開を再開する |
| Production | ライター、ビジュアル、校正など通常工程の一部が未完了 | 完了済み工程を保ち、未完了の担当へ戻す |
| Editorial | 読者向け本文に旧具体日が残る、7日超、月跨ぎ、季節・生活イベントが変わる | 編集長または必要な制作担当から再確認する |

利用上限、PC停止、Codexアプリ停止などで予定済みタスク自体がGitHubへ結果を残せなかった場合も、次に起動した迅速復旧コーディネーターまたは進行編集はIssueとPRの最終更新時刻から同じ分類を行う。失敗した実行の再現を待たない。

## Delivery Recovery

当日中の技術的中断は `kotatsu:revise + agent:publisher` のまま、次の13:00または17:00公開担当が同じPRの未完了地点から再開する。`article:publish` と `visual:artifact` は再実行可能として扱い、commit、artifact、mergeを重複させない。

日付をまたいだscheduled記事、またはopen・未mergeのPR内でpublishedまで進んだ記事も、次の13:00または17:00公開担当が次の順で扱う。技術的な再予約に進行編集の中継を必須としない。Issue labelが誤って他担当を指していても、open・未mergeの記事PR内でpublished、校正passed、正式画像確認済みなら孤立したDelivery案件として公開担当が回収する。PRと記事metadataをDelivery状態の発見元とし、古いlabelだけを理由に対象外にしない。

1. 保護された公開日を集め、`pnpm recovery:slot -- --occupied=<comma-separated ISO dates>` で最短空き枠を得る。
   対象記事自身の期限超過した旧枠は `occupied` に含めない。
2. 同じ月で現在の `publishAt` から7日以内なら、記事branch上で `pnpm article:recover-publication -- --slug=<slug> --publishAt=<ISO date>` を実行する。PR内でpublishedなら `--resume-unmerged-publication` も付ける。日数を手計算して事前分類せず、コマンドの終了結果を使う。
3. コマンドが読者向け本文、title、description、heroAlt、tagsに旧具体日を検出した場合は変更せずEditorial recoveryへ移す。
4. 成功時はfrontmatter全体を再シリアライズせず、元の表記を保持したまま内部のeditorial、visual、sidecarの日付、status、scheduleRecoveryだけを更新し、passedの校正と確認済み画像を保持したscheduledへ戻す。
5. 記事branchの `publishAt` と `editorial.publicationDate` をIssue本文の現在公開予定へ同期し、class、元日時、新日時、保持したゲートをコメントする。
6. `article:handoff` の結果をIssueへ完全一致で反映し、Issueを再取得して確認する。到来済みなら同じ起動内で通常の公開ゲートを再開する。13:00と17:00の起動中は同日の回復枠を使用できる。

Delivery recoveryは画像、本文、校正の内容を変更しない。内部日付以外の差分が生じた場合は使用せず、ProductionまたはEditorial recoveryへ移す。

公開担当がDelivery recoveryコマンドから読者向け旧具体日、現在の `publishAt` から7日超、月跨ぎなどの拒否を受けた場合だけ、変更をpushせず `kotatsu:review + agent:managing-editor` へ送る。進行編集はProductionとEditorial recoveryだけを調整し、Delivery案件の日付を独自判断で再分類しない。

## Protected Publication Calendar

復旧のために未来Issueを連鎖的に動かさない。次の日付をprotectedとして回復枠の `occupied` に含める。

- publishedまたはscheduledの記事
- 記事PRが存在する `ready`、`running`、`review`、`publish` の記事
- 公開48時間前より前で、まだ制作開始前のplanned記事

plannedかつ記事PRのない記事は、公開72時間前に入った時点で次週分でもライターreadyへ進める。これは毎日14:00のライターデスクを48時間前のProduction cutoffより前に最低1回確保する先行窓であり、公開枠の移動には使わない。

公開48時間前までに制作開始できなかった場合、その枠は保護を解除し、その記事自身を復旧待ちへ移す。空いた枠は、工程が最も進んだ遅延記事が使える。優先順は、open・未mergeのpublished、校正済みscheduled、review、running、未着手plannedとし、同じ工程なら元の公開予定が早い記事を先にする。

`recovery:slot` はprotected日付を変更せず、48時間以上、同日公開なし、週2本以内、月8本以内の最短日を返す。空きがなければ対象の遅延記事だけを次の空きまで待機させる。後続のprotected日付、制作中PR、公開順を自動変更しない。順序変更が読者体験やVol.構成を損なう場合だけ進行編集がeditorial reviewへ戻す。

## Production And Editorial Recovery

Production recoveryは、未完了の同じ担当へ `kotatsu:revise` で戻し、PR/head branch、再開地点、完了条件をコメントする。ライターから画像、画像から校正のような担当間handoffは通常どおり進行編集を介す。完了済みの本文、画像、校正を理由なく作り直さない。

Editorial recoveryは、次のいずれかで開始する。

- Delivery recoveryコマンドが読者向け旧具体日を検出した。
- 直前の有効な掲載予約日から7日を超える。
- 暦月を跨ぐ。
- 季節、祝日、生活イベント、需要前提が変わる。

編集長はbriefの有効範囲だけを再確認し、変更不要な本文や画像を差し戻さない。具体日を含む画像文脈の変更が必要な場合だけビジュアル編集、読者向け表現が変わる場合だけ校正を再実施する。通常の `article:rebook` はこの経路で使い、必要なゲートを機械出力どおりに戻す。

記事PRがopen・未mergeのまま記事statusだけ `published` まで進んだ後にEditorial recoveryが必要になった場合、進行編集はPR状態とhead SHAを再取得し、`pnpm article:rebook -- --slug=<slug> --publishAt=<ISO date> --resume-unmerged-publication --editorial-revalidated-at=<YYYY-MM-DD>` を使う。この経路は記事を `draft` へ戻し、校正を必ずpendingにする。旧具体日が本文、visual metadata、sidecarにあればビジュアル再確認も必須にし、機械出力の担当labelから再開する。frontmatter全体を再シリアライズせず、本文と変更対象外のYAML表現を保持する。`--resume-unmerged-publication` はopen・未mergeのpublished記事PRと編集長の再確認日が揃ったEditorial recoveryだけに使い、Delivery recoveryの代用にはしない。

## Completion

復旧は、Issueコメントにclass、元の停止地点、選んだ公開枠、保持したゲート、再実行した検査を記録する。公開URL確認後は通常どおり `kotatsu:done` でIssueをcloseする。復旧中に同じ原因で再度失敗しても、新しい規則を追加せず、同じclassと再開地点を更新する。
