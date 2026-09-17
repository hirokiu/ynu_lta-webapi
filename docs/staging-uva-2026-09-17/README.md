# 新サーバー確認環境

2026-09-17。移行先 `uva.alchembright.com` (133.242.138.54)。旧 `dev.alchembright.com` (160.16.122.89) と異なるサーバー。
Debian 12 amd64、メモリ約2GB、ルートディスク空き約186GB。初回確認時Docker/Git未導入。sudoは対話認証が必要。

## 配置方針

- アプリ：`/opt/kirokun-staging`、Composeプロジェクト：`kirokun-staging`。
- Firebase資格情報：`/opt/kirokun-secrets`（Git管理外・ディレクトリ0700）。
- Web公開範囲：`127.0.0.1:8080`。DB/APIはホストに公開しない。
- 通知：`NOTIFICATIONS_ENABLED=false`。Firebase認証は既存プロジェクトを利用し、データは新サーバーの独立したDBを利用する。
- 確認時はMacから `ssh -A -N -L 18080:127.0.0.1:8080 uva.alchembright.com` で接続し、`http://localhost:18080` を開く。
- DNS、旧サイト、既存アプリの接続先は切り替えない。

## 管理者による初期導入

`ops/bootstrap-debian.sh` はDocker公式APTリポジトリからDocker Engine/Compose/BuildxとGitを導入し、配置先を作成する。hiroki_uをDockerグループに追加する。SSHやsudoの設定・DNS・既存サイトは変更しない。
新サーバーに配置した `~/kirokun-bootstrap-debian.sh` を `sudo bash ~/kirokun-bootstrap-debian.sh` で実行し、SSHに再接続する。

公式手順：https://docs.docker.com/engine/install/debian/

## 移行検証

確認用DBは旧サーバーから取得した論理バックアップを新環境に復元する。稼働中取得の場合は最終移行用の整合スナップショットではないことを記録する。最終切り替えでは書き込み停止後に再取得・復元し、件数・回答出力・ログイン・アプリ疎通を確認してからDNSを変更する。
旧サーバーの解約はDNS切り替え後の実機・通知・定期処理・バックアップ復元の確認と切り戻し期間を経て実施する。

## 現在の状態

確認環境の構築・起動・ブラウザー確認まで完了。DNS切り替えは未実施。

- Docker Engine 29.8.1 / Compose v5.5.1。
- ビルド元：API `bcd593f`、Web `69aec91`。イメージ名 `kirokun-api:staging-bcd593f` / `kirokun-web:staging-bcd593f`。
- Web/API/MongoDBはすべてhealthy。通知falseを実コンテナーで確認。
- 確認用データ取得：2026-09-17 18:57 JST、旧APIを停止しないオンライン取得。最終移行用ではない。
- バックアップSHA-256：`e5795cb018855d169965e8f54b993b385ed56ad6fa745b4ba15a9c609bfb3926`。
- 復元件数：users45、groups12、surveys56、assignments4,182、assignmentresults4,651（計8,946）。
- 新サーバーで論理バックアップを再取得し、隔離コンテナーへの復元と全コレクション件数一致を確認。一時復元コンテナーは削除済み。
- Chromeで既存アカウントのFirebaseログイン、Survey一覧の2ページ目、CSV生成リンクを確認。
- 読み取りAPI：Survey50件＋次ページあり、配信50件＋次ページあり、指定利用者の配信取得成功。
- 回答最多のSurveyで、CSVの1,247行がDBの1,247回答と一致。日本語の先頭3列も一致。サーバー内リクエストで約0.27秒（単発確認であり、本番比較の性能測定ではない）。
- 確認時のメモリavailable約1.2GB。待受はSSH22、既存ローカル監視10050、確認用Web127.0.0.1:8080。DB/APIポートは外部待受なし。
- このMacからSSHトンネルを接続済み。Chromeで `http://localhost:18080/surveys` を確認できる。Codex内蔵ブラウザーではFirebase通信エラーが出たためChromeで検証。
- 定期バックアップ・再起動のタイマーはまだ有効化していない。設定は`ops/schedule.conf`。本番移行時に適用する。

確認環境で変更したDBは旧本番へ同期しない。確認用コピーの取得後に旧本番で発生した回答は、最終移行時の再取得で取り込む。

SSHトンネルが切れた場合は、Macのターミナルで前掲のトンネルコマンドを実行する。今回作成した接続の終了は `ssh -S /tmp/kirokun-staging-ssh.sock -O exit uva.alchembright.com`。秘密鍵・DBバックアップ・認証トークンはGitに保存していない。
