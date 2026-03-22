# Alma (Protan) Core Technologies Implementation Details

このドキュメントでは、「プロタン」開発において極めて重要となる3つの特定の技術要素（Ripgrep, AppleScript, Sandboxed Iframe / WidgetRenderer）の実際の実装詳細について、ソースコードの解析結果をもとに解説します。

---

## 1. Ripgrep (`rg`) - 高速ファイル検索の実装
Almaは、数万ファイルのコードベースであっても一瞬で検索を完了させるために、Node.jsの貧弱な標準検索ではなく、Rust製の超高速検索ツールである **Ripgrep (`rg`)** をネイティブな `Grep` ツールとして統合しています。

### 【実装の仕組み】
- **ツールのスキーマ定義**: 
  `Grep` ツールのスキーマには `-A`, `-B`, `-C` (Context行数) や `-i` (大文字小文字無視), `-n` (行番号表示) などの grep 標準オプションに加え、`glob` フィルタが定義されています。
- **実行ロジック**: 
  メインプロセス (`out/main/index.js`) 内で、`child_process.spawn` を使ってOS上の `rg` コマンドを直接呼び出しています。
  ```javascript
  // 抽出された実行ロジックの断片
  const s = spawn("rg", args, { cwd: workspacePath });
  s.stdout.on("data", e => { r += e.toString() });
  s.stderr.on("data", e => { i += e.toString() });
  ```
- **Protan開発での注意点**: 
  このツールを動かすためには、ユーザーの環境（Mac）に予め `ripgrep` がインストールされているか、Electronのバイナリ内に `rg` 実行ファイルを同梱する必要があります。

---

## 2. AppleScript (`osascript`) - macOS ネイティブ連携
Almaは「Mac上のデスクトップエージェント」である強みを活かし、**AppleScript** を通じてOSの深層機能（カレンダー、リマインダー、通知など）を直接コントロールします。

### 【実装の仕組み】
- **プロンプトでの明示的な指示**: 
  `Bash` ツールの説明文（Description）内に、AppleScript を使うべき場面がハードコードされています。
  > "On macOS, can also use osascript to interact with system features like calendar, reminders, emails, notifications, and controlling apps"
- **日付処理の厳格なルール**: 
  System Prompt には、AppleScriptで日付を扱う際の「AIが犯しやすいミス」を防ぐための専用のコードスニペットが埋め込まれています。
  ```applescript
  // AIに強制しているAppleScriptの日付設定ルール
  set targetDate to current date
  set year of targetDate to 2025
  set month of targetDate to 12 ...
  ```
- **Protan開発での応用**: 
  AppleScript専用のツール（`AppleScript` Tool）を作るのではなく、**`Bash` ツールに `osascript -e "..."` を渡させる**という設計になっています。これにより、Node.js側に追加の実装なしでMacのあらゆるネイティブ機能を操作可能にしています。

---

## 3. Sandboxed Iframes (`WidgetRenderer`) - 安全なUI動的生成
Almaはチャット画面内で、AIが生成したHTMLやJavaScript（グラフやインタラクティブなUI）を直接レンダリングする強力な機能を持っています。これが `WidgetRenderer` です。

### 【実装の仕組み】
- **Reactコンポーネント**: `/out/renderer/assets/index-Dc1oFkjg.js` に `WidgetRenderer` というメモ化されたコンポーネントが存在します。
- **動的リサイズと安全性の確保**: 
  AIが生成したHTMLは `iframe` 内で実行されますが、メインアプリ側（React）と `postMessage` (IPC) で通信する仕組みが組み込まれています。
  ```javascript
  // 抽出された Iframe との通信ロジック
  if (d.type === "widget-resize" && typeof d.height === "number") {
      setHeight(Math.max(50, Math.min(d.height + 8, 4e3)));
  }
  if (d.type === "send-prompt" && typeof d.text === "string") {
      sendMessage?.(d.text.trim());
  }
  ```
- **双方向の対話**: 
  単にHTMLを表示するだけでなく、レンダリングされたウィジェット（例えばAIが作った「Todoリストアプリ」のボタン）をクリックした際に、`send-prompt` というイベントを親ウィンドウ（Alma）に送ることで、**ウィジェットからAIにチャットを送信させる**ことまで可能です。
- **Protan開発での注意点**: 
  `iframe` には `sandbox="allow-scripts"` を付与しつつ、ElectronのNode.js環境（メインプロセス）には絶対にアクセスできないよう、コンテキストを完全に隔離（Context Isolation）する必要があります。
