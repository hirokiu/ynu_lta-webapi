# 回答出力・Assignments修正と全件照合（2026-10-12）

## 全件照合
旧環境とProtoのSurvey DBを全コレクション・全ドキュメントについてIDと正規化SHA256で比較。2026-10-12 12:18 JST時点。稼働中の読み取りであり、同時更新を停止したスナップショット比較ではない。

|保存先|旧|Proto|旧のみ|Protoのみ|共通IDの内容変更|
|---|---:|---:|---:|---:|---:|
|assignmentresults|4651|4651|0|0|0|
|assignments|4182|4186|0|4|0|
|surveys|56|56|0|0|0|
|groups|12|12|0|0|0|
|users|45|46|0|1|4|
|loginaccounts|0|3|0|3|0|
|projectsettings|0|1|0|1|0|
|auththrottles|0|0|0|0|0|

旧データの欠損はない。旧Survey・Group・Assignment（埋込回答を含む）・AssignmentResultsは内容も全一致。Userの4件はos/updatedAt/versionNumber/deviceTokenだけの差分。既存利用者情報・回答を上書き復元しない。
両DB全件archiveと照合manifestは新サーバーの `~/kirokun-proto/ops/state/` に保全し、Gitに回答・個人情報を含めない。

## 原因と修正
- Assignmentsの表セルがES importとmodule.exportsを混在させ、production bundleで実行時例外を起こしていた。export defaultに統一。
- Assignmentsの期間初期値が当日のみで過去データを隠していた。初期値を全期間にし、期間指定と空表示の説明を追加。
- 通常の回答一覧・出力はAssignmentResultsだけを参照していた。旧Assignment.datasetも統合。同じ配信ID＋回答者に回答済みの新形式があれば新形式を優先し、重複を防ぐ。DB自体は変換しない。
- CSV作成後に別の保存リンクを押す2段階操作を、自動ダウンロード＋保存リンクによる再試行に変更。作成中スピナーは維持。
- 旧回答の選択IDにはlegacy:を付与。全期間・期間指定・選択出力とも同じ統合対象。回答一覧は新形式、旧形式の順でそれぞれ更新日時降順。ページ件数は出力範囲に影響しない。
- 出力のカーソル処理、容量・時間制限と同時実行抑制を維持。

## 検証
架空データの隔離MongoDBで、旧新両形式の混在・重複抑制・ページ境界・期間・選択・他SurveyのID拒否をテスト。型検査・Web production buildも確認。実環境の全Survey出力検証と反映結果は追記する。
