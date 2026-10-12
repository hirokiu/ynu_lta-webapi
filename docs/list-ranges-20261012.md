# 一覧の総件数・表示範囲（2026-10-12）

Users、Groups、Surveys、Assignmentsの主一覧の上下に「全N件中 X〜Y件を表示」を追加。検索・期間の条件に合う総件数を使用し、0件は0〜0、最終ページは実際の表示行数に合わせる。取得中・失敗時は古い範囲を表示しない。Users/Groupsは既存の全件表示を維持。Survey詳細の配信一覧（個人・グループ合計）と回答選択一覧にも同じ表示を追加。

adminページAPIのtotalはitemsと同一filterでcountDocuments、15秒の制限付き。既存モバイルAPIの形式は変更しない。

実画面検証で既存Groups検索が存在しない`/groups/search/`を参照し、詳細取得に解釈されnullになる問題を発見。`/groups?t=...`へ変更し、認証付きの部分一致検索を実装。検索文字は正規表現として解釈せずリテラル扱い。データ変更なし。

検証：隔離MongoDBの架空データで総件数・検索0件・期間0件・端数ページ・Groups部分一致と認証を確認。Web/APIのproduction build成功。ブラウザーでUsers46、Groups12、Surveys56、Assignments4,186の上下表示一致、Surveys 51〜56、Assignments 21〜40、Users検索0件を確認。最終反映後にGroups検索の実画面も確認する。
