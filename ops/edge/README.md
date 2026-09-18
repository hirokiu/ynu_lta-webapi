# 環境別のHTTPS公開

新サーバーの共通入口。`docker compose -f ops/edge/compose.yaml up -d` で起動する。Linux host networkで80/443を公開し、localhostの環境別Webポートへ転送する。Caddy管理APIはlocalhostのみ。証明書は専用永続ボリュームに保存し、自動更新する。

2026-09-18更新。現在は `proto.kirokun.alchembright.com` → `127.0.0.1:8081` のみ。DNS Aは133.242.138.54。既存本番のDNSは変更しない。確認環境の通知は無効、DBは本番のコピーで、本番へ同期しない。

将来は環境ごとに独立したCompose project、DBボリューム、設定、localhostポートを用意し、`sites/<環境>.caddy` に明示的なホスト設定を追加する。認証・Firebaseも用途に応じて分離する。ワイルドカードDNSだけでは環境は作成されない。証明書は実際に追加したホストごとに取得するため、現時点でワイルドカード証明書やDNS API鍵は不要。未登録ホストをdevに転送するcatch-allは設けない。

設定確認：`docker compose -f ops/edge/compose.yaml run --rm gateway caddy validate --config /etc/caddy/Caddyfile`

反映：`docker compose -f ops/edge/compose.yaml exec -T gateway caddy reload --config /etc/caddy/Caddyfile`

公開停止：`docker compose -f ops/edge/compose.yaml down`（DBと証明書ボリュームは削除しない）。

公式仕様：https://caddyserver.com/docs/automatic-https
