# 旧環境の保全確認

2026-09-18 12:27 JST、旧dev.alchembright.comを停止/変更せずオンライン論理バックアップを取得。新サーバーuva.alchembright.comの `/opt/kirokun-secrets/preservation-20260918/` に保存（親0700）。

- `survey.archive.gz`：MongoDB Survey全体。SHA256ファイルあり。
- `survey-exports.tar.gz`：全SurveyのCSV/JSONと元レコード、manifest。SHA256ファイルあり。
- `exports/manifest.json`：Survey ID/名称・配信/回答件数と出力の対応表。0回答のSurveyも含む。
- 通常回答は `<Survey ID>.answers.csv/json`、旧形式の配信埋込回答は `<Survey ID>.legacy-answers.csv/json`。両者は重複の可能性があるため合算しない。
- `<Survey ID>.raw.json`：Survey・配信・未回答も含む回答レコードの原本。DBアーカイブが型を含む復元用の正本。

ネットワーク隔離した使い捨てMongoDBへ復元し、8,946件成功・失敗0件。元環境と復元の件数一致：users45、groups12、surveys56、assignments4,182、assignmentresults4,651。

56Surveyすべてを出力。回答入りAssignmentResults2,650件、旧形式回答入りAssignment1,101件。全4,651回答用レコードの出力先を照合し、Surveyに紐付かない回答用レコード0件。空の回答用レコードもraw/アーカイブへ保全。CSVは稼働版由来の既存フォーマッターを使用。CSV/JSONの回答行と抽出件数を照合。回答内容はログ/Gitへ保存していない。

使用コード：ops/export-preserved-surveys.js。APIイメージstaging-06ae025で隔離MongoDBに接続し実行。外部ネットワークなし、通知処理を起動しない。出力先は `/output`、検証用資格情報は読取専用マウント。検証コンテナー/ボリュームは終了後削除済み。

これは稼働中取得の保全用コピーであり、書込停止による厳密な最終移行スナップショットではない。切替直前は再取得する。Firebase AuthenticationユーザーはMongoDBバックアップには含まれない。認証変更前にUID対応とFirebaseユーザーの別途保全が必要。

Macへの追加保存は転送承認待ち。新サーバーのファイルはSSH/SCPで取得可能だが公開URLには出さない。
