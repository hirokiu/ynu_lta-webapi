# 通知の検証準備（2026-10-06）

現在地：①保全 → ②環境準備 → ③Proto公開 → **④認証・アプリ検証** → ⑤最終移行 → ⑥旧サーバー解約。
実機は未接続。ユーザー指定により後で接続する。今回の変更は作業ブランチで検証し、
稼働Dev/Protoへのデプロイ・通知有効化・実Push送信は行っていない。

## 修正

- FCMの応答前に通知済みを書いていた処理を変更。FCM受付成功時だけ記録し、
  失敗・例外・トークン欠落時は未通知のままにする。トークンや通知本文はログへ出さない。
- 1件ずつカーソルで取得・順次送信し、同一APIプロセス内のタイマー処理重複を防止。
- 個人配信はAssignment、グループ配信はAssignmentResultsを使用。
  削除済みAssignmentを参照する回答先はスキップする。
- 公開通知・期限通知の既存時間枠は維持。無効なトークンの除去・時間枠外の再試行は未実装。
- FCM受付は端末到達・閲覧の証明ではない。FCM受付後にDB更新が失敗すると重複送信が
  起こり得る。同一プロセス内の重複防止であり、複数APIインスタンスを並行運用する前には
  分散ロック／ジョブ管理が必要。

## 確認結果

TypeScriptビルドと`test/notifications.integration.test.js`成功。
隔離MongoDBとFirebase送信モックで、通知停止、空トークン、送信例外・拒否、成功、
個人／グループの公開・期限、再試行、処理重複、削除済み参照、成功後の再送なしを確認。
実Firebaseへは通知していない。

Androidは受信直後のstartActivityを廃止し、標準通知とimmutable PendingIntentに変更。
通知権限・通知停止を尊重し、チャンネルを画面起動時に作成。日本語／既定言語の名称を追加。
ProtoDebugとDevDebugビルド、API37上のNotificationConstructionTest成功。
同テストは通知を構築するだけで、画面タップ・OSへの通知投稿・FCM受信を代替しない。

iOSはwillPresentデリゲートで前面バナー・通知センター・音を許可し、一覧更新を通知。
ProtoDebugシミュレータービルド成功。APNs/FCMの実受信は未確認。

## 実機接続後の手順

1. Dev Firebaseの専用テスト端末だけを対象にする。通常Devの端末登録・topic購読停止は維持し、
   検証専用ビルドで明示的に端末トークンを取得する仕組みを先に用意する。
   iOSではDev Bundle IDのAPNs設定と署名を確認する。
2. テスト送信はDevプロジェクトから指定端末1台へのtoken送信に限定する。
   通常のSurvey定期通知やtopic一斉送信は有効化しない。トークンは非公開一時ファイルで扱う。
3. 前面／背景／終了状態で受信し、通知タップ後のログイン状態・Dev表示・Survey一覧を確認。
   権限拒否・ログアウト・別アカウント・再ログインも確認。実受信と模擬通知を区別する。
4. 上記が成功後、Protoの/me・全回答者UID対応とAPI更新を先に検証する。
   その後、上松の専用テスト端末でProto通知を確認してから一般配信を再開する。

参考：[Firebase Android受信仕様](https://firebase.google.com/docs/cloud-messaging/android/receive-messages)、
[Android通知からの画面起動](https://developer.android.com/develop/ui/views/notifications/navigation)、
[Firebase Apple受信仕様](https://firebase.google.com/docs/cloud-messaging/ios/receive-messages)。

## 実機接続後の結果（2026-10-06 夜）

上記の未接続状態は更新済み。iPhone11 Pro/iOS26.6とAndroid14/CPH2603を接続した。

- Android: DevDebug限定のQA受信サービスと、明示的なinstrumentation引数pushQa=trueで
  トークン取得を用意。Devプロジェクト・Bundle ID・QA状態・payloadマーカーを検査。
  Firebase送信成功だけでなく、前面アプリの受信記録を確認した。
  本人がホーム画面へ戻した後に2通目を送り、通知タップによる起動を本人とアプリ記録の両方で確認。
  通知先は取得したDev端末トークン1件だけ。topic送信・ユーザーDB登録なし。
- Android試験後: QAフラグと自動登録を停止、FCMトークンを削除するテスト成功。
  アプリ内記録とMac／サーバーの一時トークンファイルを削除。通常Devの状態へ戻した。
  実機の通知権限は本人が許可した状態を保持。Androidコミット039a00a。
- iPhone: DevDebugの明示的な起動引数のみで通知登録を許可。署名ビルドと配置・通知許可・
  FCMトークン取得まで成功。指定1台への送信はthird-party-auth-errorで拒否。
  本人がDev FirebaseのAPNsキー未登録を確認し設定中。設定完了後に再送する。
  iPhoneトークンは非公開一時ファイルで保持し、受信確認後に削除する。iOSコミット03aad82。
- iOS/AndroidのProtoビルドとAndroid DevReleaseビルド成功。Androidの既存JPEGにPNG拡張子が
  付いていたため、内容を変えずjpgへ修正。実利用者・研究者の認証やSurveyデータに変更なし。
- 新サーバーの通常通知・配信準備は引き続きfalse。APIの通知修正は未デプロイ。
  実機でのログイン→Survey回答の通し試験、Proto通知、終了状態からの通知は未確認。


## iPhone実機Push確認完了（2026-10-06追記）

APNsキー登録後、iPhone 11 Pro / iOS 26.6のKIROKUN DevでFCM送信成功、
前面受信（22:56:47 JST）、背景の通知タップ（22:58:59 JST）をアプリ記録で確認。
本人も通知からKIROKUN Devが開くことを確認した。
DevDebug専用の `--kirokun-push-qa-cleanup` で一時FCMトークンを失効し、
端末内QAファイルを削除。23:02:34 JSTの完了記録を確認し、通常起動へ戻した。
Mac・新サーバーの一時トークンファイルも削除済み。
Android実機と合わせ、単一Dev端末への通知受信・タップ起動確認が完了。
通常の通知スケジューラー、Proto、既存利用者への配信は変更していない。
これはDevの単一端末通知試験であり、実機のログイン→Survey回答、
通知から対象Surveyへの遷移、アプリ終了状態、Proto配信の通し確認は別途必要。
API通知処理の修正は未デプロイ。

## HTTPS実機回答確認と検証データ修正（2026-10-06）

iPhone DevDebug実機のHTTPS接続を有効化し、本人がGoogle認証後のSurvey一覧表示を確認。
上松Devアカウント専用のqa_device_manual_20261006_iosを作成したが、自由入力1問のみで
header/footerが欠落し、「次へ」で進めないことが判明した。SDKの送信試験用データを
画面確認用にも使用したことが原因。未回答であることを確認したうえで、この1件だけ
index 0=header、1=open（既存設問を保持）、2=footerに修正し、保存形式を再読込検証。
今後の画面確認用データでは連番と開始・送信確認ページを必須とする。
本人の再入力・送信とDB保存確認は未完了。既存Survey・Protoは変更していない。


## 通知から対象Surveyへの遷移（2026-10-07）

通知にkirokunAssignmentId・kirokunUserId・kirokunEnvironmentを付与。
グループ配信はAssignmentResultsではなく、本人一覧に返る親AssignmentのIDを使用。
アプリはタップ情報をログイン後まで保持（最大1時間）、環境と宛先を照合し、
認証後に取得した本人のSurvey一覧にある対象だけを開く。一度消費した情報は再利用しない。
回答可能なら回答開始、回答済みなら結果、期限切れなら期限情報。見つからない場合は案内。
Androidの前面通知もpayloadを維持し、PendingIntentを通知ごとに分離する。

検証: API TypeScriptビルド、隔離MongoDB＋FCMモックの個人/グループID・送信結果・再試行テスト成功。
Android Dev/Protoビルド成功。OPPOで環境違い・宛先違い・ID形式・期限・一度限り消費テスト成功。
iOS Dev実機ビルド成功。回答済み検証Survey宛のPush1通をDev iPhoneへ送信受付成功。
本人による回答済み画面への遷移確認待ち。通常API配信は未デプロイ・無効のまま。
新サーバーのops/state/push-qa-ios-20261007.jsonとMac非公開一時ファイルに検証トークン保持。
確認後はiOS QA cleanup起動でトークン失効・ファイル削除し、通常起動へ戻すこと。
未回答・期限切れ・削除済みの画面遷移、ログアウトからの復帰、Android実Push遷移は未確認。

### iPhone本人確認完了（2026-10-07）
本人が通知タップ後に該当Surveyの回答済み画面が直接開くことを確認。
iOS QA cleanup完了記録（2026-10-07 02:06:43 JST）でトークン失効・端末QAファイル削除を確認。
通常起動へ戻し、Macとサーバーの今回の一時トークンを削除済み。
上記の「確認待ち」「トークン保持」はこの追記により解消。Android実Push遷移と他の分岐は引き続き未確認。


## 未回答・期限切れの実機遷移検証準備（2026-10-07）

iPhone/OPPOの回答済み通知遷移は本人確認済み。回答後のバッジ消去も本人確認済みで、
Dev DB上のバッジ用検証回答保存と個人未回答0件を照合済み。OPPOは数字ではなく点を表示。
次の分岐検証用に上松Devアカウントだけへ `qa_route_active_20261007` と
`qa_route_expired_20261007` を作成した。header/open/footerの3ページで回答送信不要。
通常通知は停止のまま。接続したiPhone 11 Pro/OPPOで単一端末QAを有効にし、
Mac `/tmp/kirokun-route-{ios,android}.json` と新サーバー
`~/kirokun-dev/ops/state/push-route-{ios,android}-20261007.json` に非公開一時トークンを保持。
両端末をホーム画面に戻す本人操作を待ってから、未回答・期限切れを順番に送信する。
現時点では今回の通知は未送信。終了後は両端末のQA cleanupでトークン失効、
一時ファイルを両側から削除し、通常起動へ戻すこと。Protoと既存利用者は変更していない。

### 未回答通知の本人確認（2026-10-07）

両端末をホーム画面に戻したことを本人が確認後、Dev専用iPhone/OPPO各1台へ
`qa_route_active_20261007` の通知を1通ずつ送信し、FCM受付成功。
両端末で回答開始画面が開くかの確認依頼に対して、本人から「かくにんしました」と回答を受領。
次は期限切れSurveyの案内と回答開始不可を確認する。期限切れ通知はまだ未送信。
QAトークンは試験継続用に保持中。終了時の失効・一時ファイル削除は未完了。

### 期限切れ通知の確認と試験終了（2026-10-07）

両端末をホーム画面に戻した本人確認後、期限切れ検証Surveyの通知を各1通送信しFCM受付成功。
期限切れの案内と回答開始不可の確認依頼に対し、本人から「期限切れを確認できました」と報告を受領。
今回の未回答・期限切れ、および先行する回答済み通知の画面遷移について本人確認が揃った。
AndroidのdisableSingleDeviceTest成功。iPhoneのcleanup-complete記録は
2026-10-07 20:43:03 JSTで、FCMトークン失効と端末内トークンファイル削除を確認。
Macと新サーバーのpush-route一時トークンファイルを削除し、両アプリを通常起動へ戻した。
検証Surveyは保全。Dev/Protoの通常通知スケジューラーは変更していない。
未確認事項: 削除済みSurvey通知、ログアウト・終了状態からの復帰、Proto認証移行後の通し試験。
API通知修正の稼働環境への反映と、アプリ終了中の未回答件数更新も未完了。

### マルチタスクから終了後の通知起動（2026-10-07）

Dev専用の単一端末QA登録を再準備し、本人が両端末をマルチタスクから終了した後、
未回答検証Survey `qa_route_active_20261007` の通知をiPhone/OPPO各1通送信。
FCM受付成功に加え、本人が「どちらも開きました」と対象Survey画面への遷移を確認。
これはマルチタスクから終了した状態の確認であり、Android設定の強制停止の確認ではない。
次のログアウト時試験のためQA登録は継続中。トークンは非公開ファイル
Mac `/tmp/kirokun-cold-{ios,android}.json` とサーバー
`~/kirokun-dev/ops/state/push-cold-{ios,android}-20261007.json` に保持。
一連の試験終了後に両端末のQA解除・トークン失効・両側一時ファイル削除を行う。
通常通知スケジューラーとProtoは変更なし。

### ログアウト・終了状態からの復帰確認（2026-10-07）
本人が両端末でログアウト・終了後、未回答通知を各1通送信しFCM受付成功。通知からログイン画面、Dev Googleログイン後に対象Surveyへ進む手順について「その手順で無事に動作しました」と確認を受領。
Android QA解除テスト成功、iPhone cleanup-completeは2026-10-07 21:11:26 JST。両側のpush-cold一時トークンファイルを削除し通常起動へ戻した。削除済みSurvey通知とProto移行後の試験は未確認。

### 削除済み配信への通知準備（2026-10-07）
Androidのログアウト確認余白は本人確認済み。次の通知試験としてDevの上松専用に
qa_deleted_notification_20261007を新規作成し、未回答のその1件だけを即時削除。
IDがDBに存在しないことを確認した。既存配信・回答は変更していない。
両端末のQA登録を準備し、ホーム画面への移動を確認待ち。通知はまだ未送信。
一時トークン: Mac /tmp/kirokun-deleted-{ios,android}.json、
サーバー ~/kirokun-dev/ops/state/push-deleted-{ios,android}-20261007.json。
参照先記録は同stateのpush-deleted-fixture-20261007.json。試験後にQA解除・トークン失効・ファイル削除が必要。

### 削除済み配信通知の本人確認完了（2026-10-07）
両端末のホーム画面への移動確認後、削除済み検証配信IDを指定した通知を各1通送信。
送信直前にもDBに対象IDが存在しないことを照合し、FCM受付成功。
対象が見つからない旨の案内、回答画面へ進まないこと、一覧を利用できることの確認依頼に対し、本人から「確認できました」と回答を受領。
Android QA解除テスト成功。iPhone cleanup-completeは2026-10-07 21:29:31 JST。
Mac・サーバーのpush-deleted一時トークンと参照先記録を削除し、両アプリを通常起動へ戻した。
Dev実機で未回答・回答済み・期限切れ・削除済み、および終了状態・ログアウト後の通知遷移の本人確認が完了。
Protoの認証移行・通知API反映・実機通し確認、終了中のバッジ件数更新は別途未完了。
