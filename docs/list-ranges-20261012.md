# 一覧の総件数・表示範囲（2026-10-12）

Users、Groups、Surveys、Assignmentsの主一覧の上下に「全N件中 X〜Y件を表示」を追加。検索・期間の条件に合う総件数を使用し、0件は0〜0、最終ページは実際の表示行数に合わせる。取得中・失敗時は古い範囲を表示しない。Users/Groupsは既存の全件表示を維持。Survey詳細の配信一覧（個人・グループ合計）と回答選択一覧にも同じ表示を追加。

adminページAPIのtotalはitemsと同一filterでcountDocuments、15秒の制限付き。既存モバイルAPIの形式は変更しない。

実画面検証で既存Groups検索が存在しない`/groups/search/`を参照し、詳細取得に解釈されnullになる問題を発見。`/groups?t=...`へ変更し、認証付きの部分一致検索を実装。検索文字は正規表現として解釈せずリテラル扱い。データ変更なし。

検証：隔離MongoDBの架空データで総件数・検索0件・期間0件・端数ページ・Groups部分一致と認証を確認。Web/APIのproduction build成功。ブラウザーでUsers46、Groups12、Surveys56、Assignments4,186の上下表示一致、Surveys 51〜56、Assignments 21〜40、Users検索0件を確認。最終反映後にGroups検索の実画面も確認する。

最終反映：API `e222a80` / Web `3cf8e9b`、release `proto-counts-r2-20261012`。配備前バックアップ `survey-20261012T034747Z-3313373.archive.gz` 成功。Groupsの検索0件（0〜0）と部分一致8件（1〜8）の上下表示一致を実ブラウザーで確認し、修正後の実行時エラーなし。Survey内の配信一覧3,330件・回答一覧1,081件も上下に1〜50件表示を確認。

## 上下の操作パネル（追加対応）

Web `79198d5` / 統合 `2198eea`、release `proto-pagination-20261012`。
共通ListPaginationでSurveys・Assignments・Survey詳細の配信/回答一覧の上下に表示件数（10/20/50/100）、前へ、次へを配置。上下は同じページと件数設定を参照し、取得中は操作を無効化する。Add Survey・Add Group・有効時の回答者招待も上下に配置。Users/Groupsの全件表示は維持。

Web production build成功。Protoのwebのみ再作成し、APIのコンテナーIDと起動日時が不変であることを確認。DB変更なし。
実ブラウザーでSurveysの下側から51〜56件、20件へ変更して1〜20件、次へ21〜40件、前へ1〜20件を確認。Assignmentsも下側から21〜40件へ移動し上下の範囲一致を確認。Add Groupと回答者招待のリンク各2個を確認。Survey詳細の配信件数10件への同期と回答一覧上下の件数選択の同期も確認。
