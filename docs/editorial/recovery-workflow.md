# Editorial Recovery Lane

この文書は、予定済みタスクの欠損、通信障害、Actionsやartifactの失敗、公開予定日の超過から復旧する場合の正本である。通常制作の役割、品質基準、状態labelは `docs/editorial/agent-workflow.md` を使い、復旧の分類、再開地点、公開枠だけをこの文書で定める。

## Principles

- 復旧は、完了済み工程を繰り返さず、未完了地点から再開する。
- 本文、画像、校正の品質ゲートは省略しない。ただし、既に通過したゲートを技術障害だけで無効にしない。
- 復旧作業も予定済み担当エージェントの起動内で行い、この文書を根拠に人手で直接公開しない。
- GitHub Issue、記事PR、Actionsを永続キューとする。予定時刻を過去時刻として再現しない。
- 復旧の速さと公開カレンダーを分離する。制作上の未完了工程は速やかに完了させ、公開は読者向けの間隔を守る最短空き枠で行う。

## Recovery Classes

進行編集は、予定済み担当の起動が1回欠けた、予定工程から2時間を超えて進捗がない、または公開予定日を過ぎた対象を次の3種類に分類する。複数に当てはまる場合は、より下の編集判断を要する分類を使う。

| Class | Condition | Resume point |
| --- | --- | --- |
| Delivery | 校正、画像、CI、掲載予約を通過し、通信、Actions、artifact、Pages確認、mergeだけが未完了 | 進行編集が実日付へ復旧予約し、公開担当へ戻す |
| Production | ライター、ビジュアル、校正など通常工程の一部が未完了 | 完了済み工程を保ち、未完了の担当へ戻す |
| Editorial | 読者向け本文に旧具体日が残る、7日超、月跨ぎ、季節・生活イベントが変わる | 編集長または必要な制作担当から再確認する |

利用上限、PC停止、Codexアプリ停止などで予定済みタスク自体がGitHubへ結果を残せなかった場合も、次の進行編集はIssueとPRの最終更新時刻から同じ分類を行う。失敗した実行の再現を待たない。

## Delivery Recovery

当日中の技術的中断は `kotatsu:revise + agent:publisher` のまま、次の13:00または17:00公開担当が同じPRの未完了地点から再開する。`article:publish` と `visual:artifact` は再実行可能として扱い、commit、artifact、mergeを重複させない。

日付をまたいだscheduled記事、またはopen・未mergeのPR内でpublishedまで進んだ記事は、進行編集が次の順で扱う。

1. 保護された公開日を集め、`pnpm recovery:slot -- --occupied=<comma-separated ISO dates>` で最短空き枠を得る。
   対象記事自身の期限超過した旧枠は `occupied` に含めない。
2. 同じ月で直前の掲載予約日から7日以内なら、記事branch上で `pnpm article:recover-publication -- --slug=<slug> --publishAt=<ISO date>` を実行する。PR内でpublishedなら `--resume-unmerged-publication` も付ける。
3. コマンドが読者向け本文、title、description、heroAlt、tagsに旧具体日を検出した場合は変更せずEditorial recoveryへ移す。
4. 成功時は内部のeditorial、visual、sidecarの日付だけを更新し、passedの校正と確認済み画像を保持したscheduledへ戻す。
5. `article:handoff` の結果をIssueへ反映し、到来済みなら17:00までの次の公開担当が通常の公開ゲートから再開する。

Delivery recoveryは画像、本文、校正の内容を変更しない。内部日付以外の差分が生じた場合は使用せず、ProductionまたはEditorial recoveryへ移す。

## Protected Publication Calendar

復旧のために未来Issueを連鎖的に動かさない。次の日付をprotectedとして回復枠の `occupied` に含める。

- publishedまたはscheduledの記事
- 記事PRが存在する `ready`、`running`、`review`、`publish` の記事
- 公開48時間前より前で、まだ制作開始前のplanned記事

plannedかつ記事PRのない記事が公開48時間前までに制作開始できなかった場合、その枠は保護を解除し、その記事自身を復旧待ちへ移す。空いた枠は、工程が最も進んだ遅延記事が使える。優先順は、open・未mergeのpublished、校正済みscheduled、review、running、未着手plannedとし、同じ工程なら元の公開予定が早い記事を先にする。

`recovery:slot` はprotected日付を変更せず、48時間以上、同日公開なし、週2本以内、月8本以内の最短日を返す。空きがなければ対象の遅延記事だけを次の空きまで待機させる。後続のprotected日付、制作中PR、公開順を自動変更しない。順序変更が読者体験やVol.構成を損なう場合だけ進行編集がeditorial reviewへ戻す。

## Production And Editorial Recovery

Production recoveryは、未完了の同じ担当へ `kotatsu:revise` で戻し、PR/head branch、再開地点、完了条件をコメントする。ライターから画像、画像から校正のような担当間handoffは通常どおり進行編集を介す。完了済みの本文、画像、校正を理由なく作り直さない。

Editorial recoveryは、次のいずれかで開始する。

- Delivery recoveryコマンドが読者向け旧具体日を検出した。
- 直前の有効な掲載予約日から7日を超える。
- 暦月を跨ぐ。
- 季節、祝日、生活イベント、需要前提が変わる。

編集長はbriefの有効範囲だけを再確認し、変更不要な本文や画像を差し戻さない。具体日を含む画像文脈の変更が必要な場合だけビジュアル編集、読者向け表現が変わる場合だけ校正を再実施する。通常の `article:rebook` はこの経路で使い、必要なゲートを機械出力どおりに戻す。

## Completion

復旧は、Issueコメントにclass、元の停止地点、選んだ公開枠、保持したゲート、再実行した検査を記録する。公開URL確認後は通常どおり `kotatsu:done` でIssueをcloseする。復旧中に同じ原因で再度失敗しても、新しい規則を追加せず、同じclassと再開地点を更新する。
