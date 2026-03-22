# Protan Development Roadmap

このドキュメントでは、Almaのリバースエンジニアリング結果（アーキテクチャ、データモデル、エージェントループ、UI設計）に基づき、「プロタン」をゼロから開発するための**推奨ロードマップ（開発手順）**を定義します。

最も依存関係が少なく、かつシステムの「脳」となるバックエンド（Express Server）のコア機能から着手し、徐々に手足（ツール）やUIを肉付けしていくアプローチを提案します。

---

## 🗺️ フェーズ 0: プロジェクトのセットアップ
**目標**: 開発環境の構築と、静的な設定ファイル（Personality）の読み込み。

1. **モノレポの構築**
   - Node.js / Bun をベースにしたモノレポ（例: `apps/server`, `apps/desktop`, `packages/core`）を初期化。
2. **Local API Hub (Express) の立ち上げ**
   - ポート `23001` で起動するシンプルなExpressサーバーを作成。
3. **コンテキスト・ローダーの実装**
   - `~/.config/protan/SOUL.md` と `USER.md` を読み込むユーティリティ関数を作成（プロンプト合成の第一歩）。

---


**【使用技術・ライブラリ】**
- **Runtime**: `Node.js`, `bun` (パッケージ管理と高速な実行用)
- **Web Framework**: `express` (ローカルAPIハブ用)
- **File System**: `fs/promises`, `path` (Node.js標準モジュール)


## 🧠 フェーズ 1: LLM Proxy と AI Provider 管理（★現在地）
**目標**: 外部のAIモデルと通信できる「プロキシ」としての役割を完成させる。UIなしで Postman や curl から AI とチャットできるようにする。

1. **SQLite データベースの初期化**
   - `providers` テーブルを作成（id, name, type, apiKey, baseURL, models）。
2. **Provider Management API の実装**
   - `POST /api/providers`, `GET /api/providers/:id/models` などを実装。
3. **LLM Proxy API の実装 (`/proxy/:provider/v1/chat/completions`)**
   - クライアントからのリクエストを受け取り、SQLiteから対象プロバイダーのAPIキーを引き当て、OpenAI/Anthropicに転送（Fetch）し、ストリーミング（SSE）でレスポンスを返すラッパーを実装。
4. **コンテキストの自動注入 (Context Builder)**
   - Proxyする直前に、フェーズ0で作った `SOUL.md` の内容を `system` プロンプトとして配列の先頭に差し込むミドルウェアを実装。

---


**【使用技術・ライブラリ】**
- **Database**: `better-sqlite3` または `sqlite3` (プロバイダー情報保存用), `drizzle-orm` (型安全なORMとして推奨)
- **AI / LLM SDKs**: `@anthropic-ai/sdk`, `openai` (公式SDKを使用してAPIと通信), `@modelcontextprotocol/sdk`
- **HTTP/Proxy**: `undici` (高速なfetchクライアント), `express` (ルーティング)


## 🛠️ フェーズ 2: エージェントループと Native Tools の実装
**目標**: AI に「手足」を与え、ターミナルやファイルを操作できるようにする。プロタンが自律エージェントに進化するフェーズ。

1. **Native Tools Schema の定義**
   - OpenAIの `tools` パラメータとして `Bash`, `Read`, `Write` のJSON Schemaを定義し、Proxy API のリクエストに常に付与する。
2. **エージェント・ループ (The Agentic Loop) の実装**
   - Proxy API で LLM から `tool_calls` が返ってきた場合、クライアントに返さず、サーバー側でインターセプトする `while` ループを実装。
3. **Tool Execution Engine (node-pty)**
   - `Bash` ツールが呼ばれたら `node-pty` でシェルを立ち上げ、コマンドを実行し、結果 (stdout) を回収して LLM に再送信する処理を実装。
   - `Read` / `Write` ツールでローカルファイルの読み書きを実装。

---


**【使用技術・ライブラリ】**
- **Terminal Emulator**: `node-pty` (非常に重要: バックグラウンドで永続的なシェルを立ち上げるため)
- **Process Management**: `child_process` (Node.js標準), `tree-kill` (暴走したプロセスの終了用)
- **Data Parsing**: `zod` (LLMから返ってきた Tool Call のJSONバリデーション用)


## 🌟 フェーズ 3: 拡張システム (Skills & Task)
**目標**: エージェントをマルチタスク化し、Markdownだけで機能を無限拡張できるようにする。

1. **Skills ローダーの実装**
   - `~/.config/protan/skills/*/SKILL.md` をスキャンし、ユーザーの質問ベクトル（またはキーワード）にマッチするものをプロンプトに動的注入する仕組みを作る。
2. **サブエージェント (`Task` ツール) の実装**
   - メインの会話ループから分離して、バックグラウンドで別のLLMセッションをスピンオフさせる `Task` ツールを作る。
   - `TaskOutput` ツールを実装し、メインエージェントがサブエージェントの完了をポーリング（待機）できるようにする。

---


**【使用技術・ライブラリ】**
- **Markdown Parsing**: `gray-matter` (SKILL.md の YAML Frontmatter メタデータと本文を分離するため)
- **File Matching**: `fast-glob` (ディレクトリ内のパターン検索用)
- **Text Processing**: `marked` または `remark` (プロンプト抽出用)


## 💾 フェーズ 4: 記憶システム (Dual Memory & RAG)
**目標**: 長期記憶を持たせ、ハルシネーションを防ぐ。

1. **Vector DB (`sqlite-vec`) の導入**
   - `memory_embeddings` テーブルを作成。
   - テキストを Embedding API (例: `text-embedding-3-small`) でベクトル化し、保存・検索する `/api/memories/search` を実装。
2. **People Profiles の実装**
   - 確実な事実を保存するための `people/<name>.md` を管理する API を作成。
3. **Hidden Prompts (バックグラウンド処理) の実装**
   - チャット送信時に裏側で「スレッドタイトルの生成」や「記憶の自動抽出」を行う非同期ワーカーを実装。

---


**【使用技術・ライブラリ】**
- **Vector Database**: `sqlite-vec` (Alma最大の特徴: 外部サービスを使わずSQLite内で直接1536次元のベクトル類似度検索を行うための拡張モジュール)
- **Tokenization**: `tiktoken` または `gpt-tokenizer` (テキストをチャンク分割してベクトル化する前のトークン計算用)


## 🖥️ フェーズ 5: フロントエンド (React UI) とデスクトップ化
**目標**: ユーザーが操作できる GUI を被せ、完成したアプリにする。

1. **Electron 外殻の構築**
   - Express サーバーを内包して起動する Electron メインプロセスを作成。
2. **Main Chat Screen の実装**
   - メッセージのストリーミング表示、Markdownレンダリング。
   - `Tool Execution Indicator` (ターミナル実行中のスピナー) のUI実装。
3. **Settings Modal の実装**
   - Providerの登録や、Memory、Skillsを管理する設定画面。
4. **WidgetRenderer の実装 (Generative UI)**
   - AIが生成したHTMLを安全に描画する Sandboxed Iframe コンポーネントと、双方向通信 (`send-prompt`) の実装。

---


**【使用技術・ライブラリ】**
- **Desktop Framework**: `electron`, `@sentry/electron` (エラー追跡), `electron-updater`
- **Frontend Framework**: `react`, `react-dom`, `vite` (ビルドツール)
- **Styling & UI Components**: `tailwindcss`, `@radix-ui/react-*` (Avatar, Select, Tooltip等のヘッドレスUI), `framer-motion` (アニメーション), `sonner` (トースト通知)
- **State Management**: `jotai` (軽量なグローバル状態管理)
- **Markdown / Code Rendering**: `react-markdown`, `remark-gfm`, `shiki` (コードのシンタックスハイライト)


## 🚀 次のアクションプラン (Next Step)
現在の**【フェーズ 1: LLM Proxy と AI Provider 管理】**が完了したら、次は**【フェーズ 2: エージェントループと Native Tools】**の実装に進むのが最もスムーズで確実です。UIは最後にガワとして被せるだけで動くように、まずはバックエンド（API）の堅牢なテストを繰り返しながら進めましょう。
