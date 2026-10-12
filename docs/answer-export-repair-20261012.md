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
- 旧回答の選択IDにはlegacy:を付与。全期間・期間指定・選択出力とも同じ統合対象。回答一覧は保存形式にかかわらず更新日時降順。ページ件数は出力範囲に影響しない。
- 出力のカーソル処理、容量・時間制限と同時実行抑制を維持。

## 検証
架空データの隔離MongoDBで、旧新両形式の混在・重複抑制・ページ境界・期間・選択・他SurveyのID拒否をテスト。型検査・Web production buildも確認。実環境の全Survey出力検証と反映結果は追記する。

全件CSV/JSONの全セル比較で、既存CSVライブラリが未選択の複数選択列（qXX.N）の空文字を`undefined`へ変換する問題を追加検出した。平坦化済みの列名をそのまま扱うCSV書き出しに変更。引用符・カンマ・改行を含む自由記述と未選択の空欄を回帰テストした。
`ops/verify-survey-exports.js`は配備済みAPIコンテナー内で実行する読み取り検証。DBを変更せず、一時ファイルで全SurveyのCSVとJSONの件数・全セルを比較する。回答本文は出力しない。

## 反映・実データ検証結果
- Proto配備コード: `76a54ce`、Web: `c763a73`、release: `proto-answers-r3-20261012`。API/Web/Mongo healthy、API OOMなし・再起動回数0。
- 配備直前の整合バックアップ: `survey-20261012T033228Z-3299463.archive.gz`。API書込み停止中に作成しgzip・checksum確認。
- 全56Surveyに対しCSV/JSON各1回（計112回）をサーバー内で生成。新形式2,650回答＋旧形式1,103回答＝3,753回答。件数・全セル一致。Assignmentに紐づかない回答済みAssignmentResultsは0。
- 4,651件のAssignmentResultsには未回答の空レコードも含まれるため、出力回答行数とは異なる。未回答レコードも元DBとbackupに保全。
- 1出力最大15.49秒、検証プロセス最大RSS100.2MiB。検証では本文をログやGit、Macに転送していない。CSV/JSONの内容照合はサーバー内で行った。
- 旧環境全体との照合に加え、修正前後のProto全8コレクションを再比較。追加・削除・内容変更すべて0。
- ブラウザーでAssignmentsの50件初期表示、10件切替、2ページ目を確認。修正後の画面実行時エラーなし。
- 「アンケート（長谷川）」の回答合計1,081件（新124＋旧957）をブラウザー確認。最新の旧形式回答も先頭に表示。
- 通常出力の自動保存処理を修正。ブラウザーから実回答ファイルをMacへ保存する操作は実施せず、生成内容は上記サーバー内検証で確認。利用者のブラウザーで保存までの再確認を依頼する。

比較・検証記録: 新サーバー `ops/state/kirokun-{old,proto}-fingerprint-20261012.json`、`kirokun-diff-summary-20261012.json`、`answer-export-verification-20261012.log`。旧・Proto全件archiveも同ディレクトリに権限0600で保全。稼働中の全件取得とは別に、最終配備時は書込み停止バックアップを取得済み。

## 旧サイト接続と再照合（2026-10-12 13:18 JST頃）

旧サイトのHTTPS（443）は接続不可だが、HTTP（80）は200 OK。旧nginxの有効設定はlisten 80のみでTLS設定はコメントアウト。旧Web/API/MongoDBは継続稼働。設定変更は実施していない。
旧・Protoの全コレクションを再読み取りしてIDと正規化SHA256で照合し、上記の件数・差分と完全に同じ結果。両環境とも前回manifestからの変更なし。旧のみのドキュメントは全コレクションで0、Survey/Group/Assignment/AssignmentResultsの共通データは全一致。
新サーバーops/stateの `kirokun-{old,proto}-fingerprint-recheck-20261012.json` と `kirokun-diff-recheck-20261012.json` に記録。
