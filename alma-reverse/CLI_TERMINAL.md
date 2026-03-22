# Alma (Protan) CLI & Terminal Architecture

このドキュメントは、ターミナルからAlmaを操作するためのCLI（`alma` コマンド）の実装構造と、エージェントが内部でターミナル（Bash）を制御する仕組みについて解説します。

## 💻 1. CLIコマンドの実装 (`alma`) 
ターミナルで叩く `alma` コマンドの実体は、**Bunでコンパイルされた単一のJavaScriptファイル** (`cli/alma`) です。
このCLIはローカルで稼働しているAPIサーバー (`http://localhost:23001`) に対してHTTPリクエストを送信する**「薄いラッパー」**として機能しています。

### 主なコマンド一覧
- **ステータス・設定**
  - `alma status`: APIサーバーへの生存確認 (Ping)
  - `alma config get/set/list`: `~/.config/alma/config.json` への読み書き
- **チャット・記憶**
  - `alma chat list / history <chatId>`: `~/.config/alma/chats/` に保存された会話ログの表示
  - `alma thread new / list`: 新しいコンテキスト（スレッド）の作成
- **自撮り・感情 (Alma固有機能)**
  - `alma selfie generate`: AIによる自撮り画像生成
  - `alma emotion get / set-base`: 現在の感情パラメータや疲労度(Fatigue)の設定
- **外部操作**
  - `alma browser ...`: Chromeリレーを通じたブラウザ自動操作

## 🔌 2. Terminal Automation (AIによるターミナル操作)
AI（エージェント）があなたのMac上で `ls` や `cat` などのコマンドを実行する裏側では、**`node-pty`** という強力なライブラリが使用されています。

### `node-pty` の役割
通常の `child_process.spawn` ではなく `node-pty` (Pseudo-Terminal) を使うことで、以下のメリットを実現しています：
1. **状態の保持**: 一過性のコマンド実行ではなく、バックグラウンドでシェル（Bash/Zsh）を開きっぱなしにして、状態（カレントディレクトリや環境変数）を維持できます。
2. **インタラクティブ性**: パスワード入力待ちや、インタラクティブなスクリプトに対しても、AIが後から文字を流し込む（Typeする）ことが可能です。
3. **リアルタイム出力**: コマンドの実行結果（stdout/stderr）をストリーミングでキャプチャし、UI（チャット画面）にリアルタイムで表示させることができます。

### ワークフロー
1. AIモデルが `{"name": "Bash", "parameters": {"command": "ls -la"}}` というツール呼び出しを生成。
2. メインプロセス（`out/main/index.js`）がそれを受け取り、`node-pty` で仮想ターミナルを立ち上げる。
3. コマンドをストリームに流し込み、実行結果をキャプチャ。
4. 結果をMarkdownフォーマットに整形し、再びAIモデルのプロンプト（Context）に戻す。

