# Dev新認証の配備準備と中断記録（2026-10-05）

①保全 → ②環境準備 → ③Proto公開 → **④認証・アプリ検証** → ⑤最終移行 → ⑥旧サーバー解約。

## 実施済み

- SSHで新サーバーを読取確認。DevはFirebase kirokun-dev、UID方式、通知・自動配信ともfalse。既存管理者マッピング1件。
- Dev旧コード0c884d7、Web06a6bf7、.envをサーバー内 ops/state/pre-auth-* に保存（設定ファイル0600）。未保存コード変更なしを確認。
- API2c35254とWeb5b2af9dをGit bundle経由で転送し、Devのcheckoutのみ変更。
- Devの.envのみ新認証モジュールを有効化、ACCOUNT_SCOPE=dev、RELEASE_ID=dev-auth-2c35254に準備。
- Dev用APIとWebのイメージビルドを開始したが、その後SSH banner exchangeと公開Protoヘルスチェックがタイムアウト。サーバー負荷が原因の可能性はあるが、実測できていない。
- 今回のビルド用SSHと進捗確認SSHをMac側で停止した。遠隔のビルドプロセス停止は未確認。

**稼働コンテナーの置換、DBバックアップ/更新、Firebaseテストユーザー作成は未実施。** ビルド完了は未確認。Protoのコード・設定・コンテナーを変更する操作はしていないが、同一ホストのため公開Protoも応答を確認できなくなった。接続回復と状態確認を最優先する。

## 接続回復後

1. サーバー負荷・メモリー・ビルドプロセス・Dev/Protoコンテナーの状態を確認する。応答不能ならVPS管理画面コンソールで確認を依頼する。
2. ビルドを停止したことを確認して、Devの.envをops/state/pre-auth.envから戻す。checkoutはpre-auth-commitの0c884d7、webappは06a6bf7に戻す。新実装はGitHub/bundleに残っているため失われない。
3. 公開ProtoとDevのヘルスチェックを確認する。MongoDBを初期化しない。既存データを古いバックアップで上書きしない。
4. 再配備はMacなど別環境でlinux/amd64イメージを作り、新サーバーへ転送する方式を優先する。同一ホストでAPI/Webの同時ビルドは行わない。
5. 新イメージの準備後、Dev DBを既存手順でバックアップしてからDevだけを更新。Protoは別作業。

## 実Firebase検証スクリプト（未実行）

`ops/dev-auth-smoke.js`を用意した。Dev APIコンテナーの/appを作業ディレクトリとして標準入力からnodeへ渡す。QA_FIREBASE_WEB_API_KEYにはDev Webの公開APIキーを環境変数として渡す。秘密鍵の転送や表示は不要。Firebase Project/ACCOUNT_SCOPE/通知停止を検査してから実行する。

- 既存Dev管理者のカスタムトークンをテスト用に発行してAPIの招待操作を確認する。管理者の認証情報・権限は変更しない。
- qa_auth_で始まる専用回答者を1件作成して保存する（本物のメールを使用・送信しない）。
- 招待、登録、/me、本人Survey一覧、管理者操作拒否、再設定、旧パスワード・旧セッション・リンク再利用拒否を検証する。
- 実行前に存在する利用者・グループ・Survey・配信・回答文書を読み、同じ文書が変わっていないことを最後に照合する。
- 成功した場合だけコンテナー/tmp/kirokun-dev-auth-test-account.jsonへテスト用認証情報を0600で保存。Git/チャット/ログに出さない。必要ならサーバーの保護されたops/stateへ移してモバイル検証に使う。
- 途中失敗の場合は一部テストアカウントが存在し得る。無条件に再実行せず、状態を確認する。削除対象は別途明示し、既存データに触れない。

## ProtoアプリのGoogleログイン設定

手元のProto用設定では、iOSのCLIENT_ID/REVERSED_CLIENT_IDとAndroidのWeb/Android OAuthクライアント情報が不足している。Dev設定の流用はしない。Proto Firebase側でGoogle provider・iOSアプリ・Android署名登録を確認し、更新設定ファイルを用意してからネイティブGoogle入口を追加する。パスワードの新旧互換ログインは実装済み。
