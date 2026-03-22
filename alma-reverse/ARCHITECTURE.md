# ARCHITECTURE.md (Protan / Alma)

Protan は、Alma のリバースエンジニアリング結果に基づき設計された、自律型のデスクトップ AI エージェントアプリケーションです。Electron を外殻とし、React + Vite をフロントエンド、Express.js (Node.js) をバックエンド API ハブとして稼働させます。

## ディレクトリ構造 (モノレポ推奨構成)

```
protan-app/
├── apps/
│   ├── desktop/                # Electron メインプロセス + プリロード
│   │   ├── src/
│   │   │   ├── main/           # Node.js サーバー (Express)
│   │   │   │   ├── index.ts    # エントリー・APIルーター
│   │   │   │   ├── proxy/      # LLM プロキシとコンテキスト合成
│   │   │   │   ├── agent/      # エージェントループ (Task委譲)
│   │   │   │   └── tools/      # Native Tools (Bash, Read, Write)
│   │   │   └── preload/        # IPC ブリッジ
│   ├── viewer/                 # React UI (Vite SPA)
│   │   ├── src/
│   │   │   ├── pages/          # 画面コンポーネント (Chat, Settings)
│   │   │   ├── components/     # UIコンポーネント (chat, artifact, sidebar等)
│   │   │   ├── hooks/          # React Hooks
│   │   │   └── store/          # 状態管理 (jotai)
│   └── cli/                    # ターミナル用 CLI コマンド
│       ├── index.ts            # コマンドルーター (`alma` -> `protan`)
│       └── commands/           # サブコマンド (config, skill, travel)
├── packages/
│   ├── core/                   # 共通の型定義やユーティリティ
│   └── ui/                     # 共通 React コンポーネント (Design System)
└── resources/
    ├── bundled-skills/         # Markdownで書かれた初期スキル群 (`SKILL.md`)
    ├── tts/                    # ローカル音声合成エンジン (Python)
    └── vendor/                 # 同梱バイナリ (bun, ripgrep)
```

## データフロー（エージェント実行）

```
ユーザー入力 (UI / CLI)
  → POST /api/chat/completions (Local Express Server)
  → Context Builder (SOUL.md + USER.md + SKILL.md をプロンプトに合成)
  → Semantic Search (sqlite-vec で過去ログをベクトル検索しコンテキストへ追加)
  → Proxy Layer (OpenAI / Anthropic API へリクエスト転送)
  → LLM レスポンス (Tool Call: "Bash", "Task" 等)
  → Tool Execution Engine (メインプロセスで `node-pty` を使いコマンド実行)
  → 実行結果を LLM に再送信 (Agentic Loop)
  → 最終レスポンスをストリーミング (SSE) で UI に返却
```

## データベース（SQLite / JSON / Markdown）

Protan は、データの特性に応じた**トリプル・ストレージ・アーキテクチャ**を採用しています。

| ストレージ | 用途・テーブル | パス |
|-----------|------|------|
| **SQLite** | `providers` (APIキー管理) | `~/.config/protan/db.sqlite` |
| **SQLite** | `memories` (会話のRAG記憶) | 同上 |
| **SQLite** | `memory_embeddings` (1536次元ベクトル) | 同上 (`sqlite-vec` 使用) |
| **SQLite** | `usage_logs` (トークン消費量) | 同上 |
| **JSON** | アプリのグローバル設定 | `~/.config/protan/config.json` |
| **JSON** | 進行中の会話状態 | Workspace内 `.alma-snapshots/history.json` |
| **Markdown**| エージェントの性格・設定 | `~/.config/protan/SOUL.md`, `USER.md` |
| **Markdown**| 人物プロファイル | `~/.config/protan/people/<name>.md` |
| **Markdown**| 拡張スキル (動的プロンプト) | `~/.config/protan/skills/<name>/SKILL.md` |

## 主要コンセプト

### 1. Local API Hub (プロキシ設計)
すべての LLM 通信やファイル操作は、UIから直接行わず、Express.js のローカルサーバー (`localhost:23001`) を経由します。これにより、APIキーの隠蔽、コンテキストの動的合成、そして CLI と GUI の両方からの完全な制御が可能になります。

### 2. Dual Memory Architecture
ハルシネーションを防ぐための二層構造。
- **Semantic RAG**: `sqlite-vec` を用いた過去の雑談のベクトル検索。
- **Structured Profiles**: `people/` ディレクトリに保存される確実な Markdown/YAML プロファイル。

### 3. サブエージェント (`Task` ツール)
メインエージェントが重い処理（コーディングやリサーチ）を非同期でバックグラウンドに委譲する仕組み。用途別に `coder`, `Explore`, `Plan` 等がハードコードされており、専用のシステムプロンプトと権限スコープで動作します。

### 4. Skills システム (動的プロンプト注入)
プログラムコードを書かずに、Markdown (`SKILL.md`) でツールのマニュアルを記述するだけで機能を無限拡張できる仕組み。ユーザーの入力意図にマッチしたスキルだけが動的にプロンプトへ注入されます。

### 5. Fatigue (疲労度) システム
AIが単なるボットではなく「体力」を持つように設計。会話ごとにエネルギーが減少し、疲れると応答が鈍くなったり、`alma sleep` コマンドで強制的に睡眠モードに入ったりします。

### 6. Sandboxed Generative UI
AI がチャット画面上に `widgetRenderer` ツールを使って、アプリのテーマに完全にマッチした HTML/JS ウィジェットを生成。`send-prompt` イベントを用いて、ウィジェット内のボタンから AI に逆操作（チャット送信）させることが可能です。

## 新增功能标准触及点 (新機能追加時の触及点)

添加新功能时通常需要修改以下位置：

| 触及点 | 路径 (Path) | 说明 |
|--------|------|------|
| API 路由 | `apps/desktop/src/main/api/` | 新規 Express エンドポイントの追加 |
| LLM ツール定義 | `apps/desktop/src/main/tools/` | 新しい Native Tool の Schema 定義と実行処理 |
| データベース | `packages/core/src/db/` | SQLite のテーブルやベクトル検索の追加 |
| UI コンポーネント | `apps/viewer/src/components/` | React の画面・モーダル・Artifact 描画 |
| 状態管理 (Hook) | `apps/viewer/src/hooks/` | バックエンド API と通信する `useSWR` や Jotai atom |
| 拡張機能 (コード不要) | `~/.config/protan/skills/` | Markdownによるプロンプトマニュアルの追加 |

## 技术栈 (Tech Stack)

| 层 (Layer) | 技术 (Technology) |
|----|------|
| デスクトップ外殻 | Electron |
| UI フレームワーク | React 18 + Vite |
| スタイリング | Tailwind CSS + Radix UI |
| 状態管理 | jotai |
| AI / エージェント統合 | `@anthropic-ai/sdk`, `openai`, `@modelcontextprotocol/sdk` |
| 国際化 | i18next + react-i18next |
| ローカルサーバー | Express.js + ws (WebSocket) |
| バックグラウンドシェル | `node-pty` (疑似ターミナル) |
| ベクトルデータベース | `sqlite-vec` (SQLite拡張) |
| ブラウザ自動化 | `playwright` |
| ファイルパース | `gray-matter`, `mammoth` (Word), `react-pdf`, `xlsx`, `turndown` |
| 認証・外部連携 | `firebase`, Telegram / Discord API |
| ビルド・バンドル | `esbuild`, `bun` |
| エラー追跡 | `@sentry/electron`, `@sentry/react` |
