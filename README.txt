修正版ファイル一式です。

構成:
- index.html: ログイン入口
- staff.html: スタッフ画面
- admin.html: 管理画面
- styles.css: 共通スタイル
- shared.js: API通信・共通関数
- index.js: ログイン処理
- staff-app.js: スタッフ画面ロジック
- admin-app.js: 管理画面ロジック
- config.js: GAS URL設定
- Code.gs: Google Apps Script側

主な改善点:
- 日報中心の導線へ整理
- 学生/社会人の扱いをUIと集計に反映
- スタンプを補助機能へ縮小
- 管理画面を確認中心に整理
- JSを役割ごとに分割

初期ログイン:
- 管理者: admin / admin123
- 学生: student01 / pass123
- 社会人: employee01 / pass123
