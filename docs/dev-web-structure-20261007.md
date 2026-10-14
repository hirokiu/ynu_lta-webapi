# Dev Survey構造チェック反映

稼働認証ブランチecbce2aへ構造チェック7782bfdを競合なく取り込み、Web c37fc00を作成。
Mac上でlinux/amd64イメージをビルド。Dev Webだけ再作成し、APIコンテナーIDの不変を確認。
Web/API正常、実配信JSに構造チェックUIとfooter欠落エラーがあることを確認。
テンプレート構造・不正保存阻止、ページ分割・出力・Firebase設定の自動テスト成功。
ブラウザー実操作の確認は未実施。Proto、通知設定、DBは変更していない。

- Dev release tag: dev-structure-c37fc00
- API image content: dev-answer-a1a89fdと同一。新タグも同一イメージを参照。
- 転送archive SHA256: 2fca1ac52cb373bb48505c2fd2fbd62ae8e57b7cc91b3fc473c6c5b5cd1bcf96
- サーバーimage ID: 1bcfb43a2e16725dc662ee4a4adada829b0f29db1baee98b5cbcfc2e88b9c6e8
- Mac image IDとの差を検出し停止。archive SHA256と全RootFSレイヤー一致を確認後に反映。
- 設定バックアップ: ~/kirokun-dev/ops/state/env-before-web-structure-20261007（非公開）
- 稼働内訳: ~/kirokun-dev/ops/state/web-structure-release-20261007

切り戻しはmaintenance.lock取得後、上記.envバックアップを復元し、
Docker Composeでwebのみ --no-deps --no-build --pull never で再作成する。
サーバーのソースcheckoutはAPI版336754bのまま。Webの実稼働版は上記内訳で追跡。
今後ソースから再ビルドする前にWebをc37fc00以上へ更新すること。
次の検証: 通知payloadへ配信IDを付与し、認証・所属確認後に対象Surveyを開く。
既存のPush成功は受信とアプリ起動のみ。Proto認証更新と45UID対応は未適用。
