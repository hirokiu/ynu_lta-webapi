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

初期導入スクリプト配置・構文確認まで完了。管理者のsudo実行待ち。アプリ起動・DB移行・DNS切り替えは未実施。
