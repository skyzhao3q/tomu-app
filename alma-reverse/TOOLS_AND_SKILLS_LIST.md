# Alma (Protan) 🛠️ Tools vs 🌟 Skills 一覧

このドキュメントでは、Alma（Protan）の「ネイティブ機能（Tools）」と「追加開発された拡張機能（Skills）」の完全な一覧を比較・整理しています。

## 🛠️ Native Tools (ネイティブ・ツール)
**実装方法**: Node.js / TypeScript によるハードコード
**役割**: OSレベルの権限を持つ、AIの直接的な「手足」。メインプロセス (`out/main/index.js`) に組み込まれており、ユーザーが勝手に変更することはできません。

### 💻 OS & Shell (ターミナル操作)
- `Bash`: バックグラウンドシェル(node-pty)でコマンドを実行する
- `BashOutput`: 実行中コマンドのログを取得する
- `KillShell`: 実行中のシェルを強制終了する

### 📁 File System (ファイル操作)
- `Read`: ファイルの読み込み（大規模ファイルはページネーション対応）
- `Write`: ファイルの新規作成・上書き
- `Edit`: ファイル内の文字列の検索・置換（sedのような動作）
- `Glob`: パターンマッチングによるファイル検索
- `Grep`: ripgrep を用いた高速な文字列検索

### 🤖 Sub-Agents (自律エージェントの委譲)
- `Task`: 複雑な作業（コーディングやリサーチ）を別プロセスの専用エージェント（coder, explore等）に委譲する
- `TaskOutput`: 委譲したタスクの進捗や結果を取得する

### 🌐 Web & Browser (ウェブ探索・ブラウザ操作)
- `WebSearch`: Google等でのウェブ検索
- `WebFetch`: URLにアクセスしてJSレンダリング後のコンテンツをMarkdown化する
- `BrowserOpen` / `BrowserClick` / `BrowserType` / `BrowserScreenshot`: ヘッドレスブラウザや内蔵ブラウザのDOMを直接操作する
- `ChromeRelay*`: ユーザーが実際に使っているChromeブラウザと連携してタブを操作する一連のツール

### 📊 Visualization (UI描画)
- `widgetRenderer`: チャット画面にインタラクティブなHTML/SVGウィジェットを描画する
- `pieChart` / `barChart`: チャット画面にグラフを描画する

### ⚙️ System
- `AttemptCompletion`: タスク完了時にユーザーへ結果を報告する（CLIデモ等も可能）
- `ToolSearch`: 利用可能なツールをセマンティック検索で探す
- `Skill`: 後述の「Skills」を呼び出すためのハブ・ツール

---

## 🌟 Bundled Skills (バンドルされた拡張スキル)
**実装方法**: Markdownファイル (`SKILL.md`) と必要に応じたスクリプト
**役割**: Native Tools（特に `Bash` や `Read/Write`）を組み合わせて作られた「応用機能」。ユーザー自身がフォルダを追加するだけで無限に拡張可能な、Protan最大の強み。

### 💬 コミュニケーション & プラットフォーム
- `telegram`: Telegramボットとの連携
- `discord`: Discordボットとの連携
- `twitter-media`: Twitter（X）へのメディア投稿や操作
- `xiaohongshu-cli`: 小紅書（RED）の自動化コマンドラインツール

### 🧠 記憶と自己管理 (Identity & Management)
- `memory-management`: 過去の会話やユーザー情報をSQLiteベクトルDBから検索・保存する
- `self-management`: Alma自身のシステム設定（音声、テーマ等）を変更する
- `self-reflection`: 過去の行動を振り返って成長する
- `selfie`: `alma selfie` コマンドを通じて、アイデンティティに合った自撮り画像を生成する

### 📂 ユーティリティ (Utilities)
- `file-manager`: ファイルの整理、圧縮、リネームなどを行うマニュアル
- `system-info`: MacのOSバージョンやメモリ、ディスク状態を取得する
- `send-file`: チャット画面に画像や音声、ドキュメントファイルを送信する
- `screenshot`: Macの画面のスクリーンショットを撮る
- `video-reader`: 動画ファイルを解析・読み取る

### 🗓️ タスク & 計画 (Planning & Tasks)
- `plan-mode`: 複雑なマルチステップの課題を解く前に、構造的な計画を立てるモード
- `todo`: ワークスペース内の Markdown を使ってTodoリストを管理する
- `tasks`: Almaの内部タスク管理機能
- `scheduler`: `cron` を用いて定期実行タスク（リマインダー等）を設定する

### 🎨 クリエイティブ & エンタメ
- `image-gen`: プロンプトから画像を生成する
- `music-gen`: 音楽やリズムを生成する（Strudel等）
- `music-listener`: ユーザーが流している音楽を聴く/解析する
- `voice`: 音声メッセージを生成してユーザーに送信する
- `reactions`: チャットに対して絵文字などでリアクションする

### 🌐 情報収集
- `web-search` / `web-fetch`: Webブラウジングやリサーチのベストプラクティス
- `browser`: ブラウザ操作に特化したスキルセット
- `travel`: 旅行の計画やリサーチを行う
- `notebook`: リサーチ結果をノートにまとめる

### 🔄 スキル管理
- `skill-search` / `skill-hub`: 新しいスキルをGitHubやコミュニティから検索してインストールする

