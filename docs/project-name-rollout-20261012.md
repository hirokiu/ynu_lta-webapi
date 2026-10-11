# プロジェクト表示名の管理（2026-10-12）

## 今回の範囲

管理画面の「プロジェクト設定」で表示名を設定し、更新したiOS/Androidアプリが認証後に取得する。初期値はProto。内部ID `proto`、URL、Firebase、利用者ID、回答データは変更しない。

公開プロジェクト一覧JSON、所属一覧、任意URLへの接続、非公開プロジェクト、新たな認証基盤は今回の範囲外。将来の拡張方針は `proto-dev-identity-plan/project-directory.md` を参照。

## API・管理画面

- GET `/api/project`: 認証済み利用者にprojectId/displayName/revisionを返す。
- PUT `/api/admin/project`: 既存の管理者権限で表示名のみ変更可能。1〜80文字、制御文字禁止。revisionで同時更新を検知し409を返す。
- `/api/me` にproject情報を追加。名称取得の失敗だけで認証を失敗させない。
- 更新履歴は同じMongoDBドキュメントに操作主体・日時・変更前後を直近100件保存。
- 管理画面 `/project-settings` で取得・保存・再読み込み。競合時には再読み込みを案内。

## アプリ

- iOS `ca6d35e`: 2.0.0 (2026101201)。Android `975332a`: 2.0.0 (versionCode 5)。
- 認証済み `/api/me` のproject情報から名称を反映。キャッシュは接続先・Firebase UIDごとに分離。
- 未ログイン時や未取得時は既定のProto/Dev。公開ディレクトリからログイン前に名前を取る処理は未実装。
- 更新前のアプリは引き続き固定のProto表示となる。
- 共同研究者への新ビルド配布は上松さんの実機確認後。今回の新ビルドは追加しない。

## 検証・配置

- APIビルド、名称設定統合試験（未認証拒否、権限、名称検証、同時更新、監査履歴、環境分離）、既存アカウント・通知統合試験が成功。
- 管理画面ビルド、iOS Protoシミュレーター/配布アーカイブ、Android Proto/DevビルドおよびProto単体試験が成功。
- サーバー配置ソース67d7df5、Webサブモジュールd8d1ec3。
- 配置イメージ `kirokun-api:proto-project-20261012` / `kirokun-web:proto-project-20261012-r2`。APIのr2タグは同一イメージの別名。Macでlinux/amd64向けに作成。
- 更新前バックアップ `survey-20261011T164653Z-2782339.archive.gz`。gzip検証・SHA256を作成（今回の復元試験は未実施）。
- 2026-10-12 01:47 JSTに3コンテナーhealthy、公開API `/api/health` ready=trueを確認。
- NOTIFICATIONS_ENABLED=true、ASSIGNMENT_PREPARATION_ENABLED=true、ACCOUNT_SCOPE=protoを維持。
- ブラウザーで上松アカウントのログイン、表示名Protoの取得・同名での初期保存が成功。改名を勝手に選定せずProtoのまま保存。
- Android APK SHA256: a35b1a2ded91162409872570eba5fceb437b9aa28e22b315b61c3e61f0301f01。

## 上松さんによる確認

1. iOSはTestFlightの2026101201、AndroidはversionCode 5のProto確認用APKへ更新。
2. 管理画面「プロジェクト設定」で希望する名称を保存。
3. 各アプリをホーム画面へ戻して開き直し、トップとメニューの名称を確認。必要に応じて再ログイン。
4. Survey一覧・回答済み状態が従来どおりであることを確認。
5. 問題がなければ、その確認済みビルドだけ共同研究者へ配布する。

実機での名称反映・長い名称のレイアウトは上松さんの確認待ち。任意の新名称への変更試験は隔離DBの統合試験で実施済み。

## 最終確認

- ページを直接再読み込みした際の認証復元で名称取得を再試行する修正を追加し、実サーバーのブラウザーで保存済みProtoの自動表示を確認。
- iOS 2026101201はTestFlight「上松・先行確認」でTesting。上松さんの2メールアドレスのみ。共同研究者グループは2名・従来ビルド1件のまま。
- Androidは確認用APK作成済み。実機未接続のため、この版のインストール・名称反映は未確認。
