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
