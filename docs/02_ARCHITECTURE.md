# tomu - アーキテクチャ設計書

Status: Draft v1
Date: 2026-03-22

---

## 1. システム全体構成

tomu は **API ファースト（バックエンド主導）** な設計を採用する。
フロントエンド (React) とバックエンド (Express) は完全に分離され、すべての通信は REST API + SSE/WebSocket で行われる。

### 1.1 レイヤー構成

```
┌─────────────────────────────────────────────────────────┐
│                  Client Layer (Frontend)                 │
│  ┌──────────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Desktop UI   │  │ CLI      │  │ External Bots     │  │
│  │ (React/Vite) │  │ (Bun)    │  │ (Telegram/Discord)│  │
│  └──────┬───────┘  └────┬─────┘  └────────┬──────────┘  │
└─────────┼───────────────┼─────────────────┼─────────────┘
          │ HTTP/SSE      │ HTTP            │ Webhook
┌─────────▼───────────────▼─────────────────▼─────────────┐
│              Local API Hub (Express.js :23001)           │
│  ┌──────────────────────────────────────────────────┐   │
│  │                  API Router                       │   │
│  │  /api/chat  /proxy  /api/providers  /api/skills   │   │
│  └──────────┬───────────────────────────────────────┘   │
│  ┌──────────▼───────────────────────────────────────┐   │
│  │              Core Engine                          │   │
│  │  ┌─────────────┐ ┌──────────────┐ ┌───────────┐  │   │
│  │  │ LLM Proxy & │ │ Context      │ │ Agentic   │  │   │
│  │  │ Adapter     │ │ Synthesizer  │ │ Loop      │  │   │
│  │  └─────────────┘ └──────────────┘ └───────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │          Extensions & Tools                       │   │
│  │  ┌──────────┐ ┌────────┐ ┌────────┐ ┌─────────┐  │   │
│  │  │ Native   │ │ Skills │ │Plugins │ │ Task    │  │   │
│  │  │ Tools    │ │        │ │ & MCP  │ │ Runner  │  │   │
│  │  └──────────┘ └────────┘ └────────┘ └─────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
          │                     │
┌─────────▼─────────┐ ┌────────▼──────────────────────────┐
│  External AI      │ │       Data Storage                 │
│  ┌──────────────┐ │ │  ┌──────────┐ ┌──────┐ ┌────────┐ │
│  │ OpenAI       │ │ │  │ SQLite   │ │ JSON │ │Markdown│ │
│  │ Anthropic    │ │ │  │+sqlite-vec│ │      │ │        │ │
│  │ Gemini       │ │ │  └──────────┘ └──────┘ └────────┘ │
│  │ Ollama       │ │ └───────────────────────────────────┘
│  └──────────────┘ │
└───────────────────┘
```

### 1.2 モノレポ構成

```
tomu-app/
├── apps/
│   ├── desktop/                # Electron メインプロセス + プリロード
│   │   ├── src/
│   │   │   ├── main/           # Node.js サーバー (Express)
│   │   │   │   ├── index.ts    # エントリー・API ルーター
│   │   │   │   ├── proxy/      # LLM プロキシとコンテキスト合成
│   │   │   │   ├── agent/      # エージェントループ (Task 委譲)
│   │   │   │   └── tools/      # Native Tools (Bash, Read, Write)
│   │   │   └── preload/        # IPC ブリッジ
│   ├── viewer/                 # React UI (Vite SPA)
│   │   ├── src/
│   │   │   ├── pages/          # 画面コンポーネント (Chat, Settings)
│   │   │   ├── components/     # UI コンポーネント (chat, artifact, sidebar)
│   │   │   ├── hooks/          # React Hooks
│   │   │   └── store/          # 状態管理 (jotai)
│   └── cli/                    # ターミナル用 CLI コマンド
│       ├── index.ts            # コマンドルーター (`tomu`)
│       └── commands/           # サブコマンド (config, skill, providers)
├── packages/
│   ├── core/                   # 共通の型定義・ユーティリティ
│   └── ui/                     # 共通 React コンポーネント (Design System)
└── resources/
    ├── bundled-skills/         # Markdown 初期スキル群 (SKILL.md)
    ├── tts/                    # ローカル音声合成エンジン (Python)
    └── vendor/                 # 同梱バイナリ (bun, ripgrep)
```

---

## 2. コンポーネント詳細設計

### 2.1 Local API Hub (Express.js Server)

**ポート**: `23001` (localhost only)
**責務**: すべての LLM 通信・ファイル操作・メモリ管理の中央ハブ

#### 主要 API エンドポイント群

| カテゴリ | Method | Endpoint | 説明 |
|:---------|:-------|:---------|:-----|
| **Chat** | POST | `/api/chat/completions` | メインエントリー: コンテキスト合成 + プロキシ + エージェントループ |
| **Proxy** | POST | `/proxy/:providerId/v1/messages` | LLM API パススルー (Anthropic 形式) |
| **Proxy** | POST | `/proxy/:providerId/v1/responses` | LLM API パススルー (OpenAI 形式) |
| **Threads** | GET/POST/DELETE | `/api/threads[/:id]` | スレッド CRUD |
| **Threads** | GET | `/api/threads/:id/messages` | メッセージ履歴取得 |
| **Providers** | GET/POST/PUT/DELETE | `/api/providers[/:id]` | AI プロバイダー管理 |
| **Providers** | POST | `/api/providers/:id/test` | API キー有効性テスト |
| **Providers** | POST | `/api/providers/:id/models/fetch` | 利用可能モデル取得 |
| **Memory** | POST | `/api/memories/search` | ベクトル類似度検索 |
| **Memory** | GET/POST/DELETE | `/api/memories[/:id]` | メモリ CRUD |
| **People** | GET/POST/PUT/DELETE | `/api/people[/:name]` | 人物プロファイル管理 |
| **Skills** | GET/POST/DELETE | `/api/skills[/:id]` | スキル管理 |
| **Plugins** | GET/POST/DELETE | `/api/plugins[/:id]` | プラグイン管理 |
| **MCP** | GET/POST/DELETE | `/api/mcp-servers[/:id]` | MCP サーバー管理 |
| **Tasks** | GET | `/api/agents/tasks/:taskId` | サブエージェント状態取得 |
| **Workspaces** | GET/POST/DELETE | `/api/workspaces[/:id]` | ワークスペース管理 |
| **Settings** | GET/PUT | `/api/settings` | アプリ設定 |
| **Chrome** | POST | `/api/chrome-relay/*` | Chrome ブラウザ操作 |

### 2.2 Core Engine

#### 2.2.1 Context Synthesizer (プロンプト合成)

LLM にリクエストを送る直前に、以下を動的に結合してシステムプロンプトを生成:

```
1. Base Instructions (ハードコード) ─── 人格の「憲法」
2. SOUL.md (Identity) ────────────── エージェントの性格・外見・ルール
3. USER.md (User Profile) ─────────── ユーザー情報
4. MEMORY.md + Daily Notes ────────── 長期記憶 + 今日/昨日のメモ
5. Vector RAG Results ─────────────── sqlite-vec からの関連記憶 (top-5)
6. Matched Skills ─────────────────── 入力に関連する SKILL.md のマニュアル
7. Tool Schemas ───────────────────── 利用可能な Native Tools の JSON Schema
```

#### 2.2.2 Agentic Loop (エージェントループ)

```
function run_agent_loop(messages, workspace_id):
    sys_prompt = build_system_prompt(messages.last(), workspace_id)
    tools = get_native_tools_schema()

    while true:
        response = llm.create_completion(system=sys_prompt, messages=messages, tools=tools)

        if response.has_tool_calls():
            for call in response.tool_calls:
                result = execute_tool(call.name, call.args, workspace_id)
                messages.append(ToolResultMessage(call.id, result))
        else:
            return response.text  // 最終テキスト応答 → クライアントへ返却
```

#### 2.2.3 LLM Proxy & Adapter

プロバイダーごとに異なる API 形式 (OpenAI / Anthropic / Gemini) を統一的に扱うアダプターレイヤー:

- **OpenAI 互換**: `/v1/chat/completions` 形式
- **Anthropic**: `/v1/messages` 形式
- **Ollama**: OpenAI 互換 API (ローカル)
- **OpenRouter**: OpenAI 互換 API (外部ルーティング)

### 2.3 Native Tools

LLM が呼び出せるツール群:

| ツール名 | 実装方法 | 説明 |
|:---------|:---------|:-----|
| `Bash` | node-pty | 永続的疑似ターミナルでのコマンド実行 |
| `Read` | fs.readFileSync | ローカルファイル読み取り |
| `Write` | fs.writeFileSync | ローカルファイル書き込み |
| `Edit` | string replace | ファイル内テキスト置換 |
| `Glob` | glob pattern | ファイルパターン検索 |
| `Grep` | ripgrep | ファイル内容検索 |
| `Task` | sub-agent spawn | バックグラウンドサブエージェント起動 |
| `TaskOutput` | polling | サブエージェント結果取得 |
| `BrowserOpen` | Playwright | ヘッドレスブラウザ起動 |
| `BrowserClick` | Playwright | ブラウザ要素クリック |
| `WebSearch` | external API | Web 検索 |
| `WebFetch` | HTTP + Turndown | Web ページ取得 (Markdown 変換) |
| `widgetRenderer` | iframe srcdoc | チャット内 HTML/JS ウィジェット生成 |

### 2.4 Sub-Agent Orchestrator

#### サブエージェント定義

| Type | System Prompt 概要 | 許可ツール |
|:-----|:-------------------|:-----------|
| `general-purpose` | 汎用タスク処理 | 全ツール |
| `coder` | コーディング専門 | Bash, Read, Write, Edit, Glob, Grep |
| `Explore` | コードベース調査 | Read, Glob, Grep |
| `Plan` | 設計・計画立案 | Read, Glob, Grep |
| `tomu-guide` | アプリ使用ガイド | Read, WebFetch |
| `tomu-operator` | 設定操作 | Read, Write, Bash |

#### ライフサイクル

```
Started → Running → Completed / Failed
                        ↓
           Main Agent が TaskOutput で結果取得
```

---

## 3. データアーキテクチャ

### 3.1 Triple Storage Architecture

データの特性に応じて 3 種類のストレージを使い分ける:

| ストレージ | 用途 | 特性 |
|:-----------|:-----|:-----|
| **SQLite** (+ sqlite-vec, fts5) | ベクトル検索, 全文検索, 使用量ログ, プラグイン管理 | 高速クエリ, トランザクション |
| **JSON** | アプリ設定, 進行中の会話状態 | ステートレス, メモリにロード |
| **Markdown/YAML** | Identity, Skills, People, Threads | LLM が直接読み書き, 人間可読 |

### 3.2 SQLite スキーマ

```sql
-- RAG / ベクトル検索
CREATE TABLE memories (
    id TEXT PRIMARY KEY,
    content TEXT,
    type TEXT,          -- 'message', 'note'
    metadata TEXT,      -- JSON
    thread_id TEXT
);

-- sqlite-vec 仮想テーブル (1536次元)
CREATE VIRTUAL TABLE memory_embeddings USING vec0(
    memory_id TEXT PRIMARY KEY,
    embedding FLOAT[1536]
);

-- 全文検索 (FTS5)
CREATE VIRTUAL TABLE messages_fts USING fts5(
    message_id,
    thread_id UNINDEXED,
    content
);

-- トークン使用量
CREATE TABLE usage_logs (
    id TEXT PRIMARY KEY,
    provider TEXT,
    model TEXT,
    message_id TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cached_input_tokens INTEGER,
    reasoning_tokens INTEGER,
    total_tokens INTEGER,
    timestamp TEXT
);

-- プラグイン管理
CREATE TABLE plugins (id, name, version, enabled, ...);
CREATE TABLE plugin_permissions (...);
CREATE TABLE plugin_settings (...);

-- MCP サーバー
CREATE TABLE mcp_servers (...);
CREATE TABLE mcp_oauth_tokens (...);
```

### 3.3 ファイルシステムレイアウト

```
~/.config/tomu/
├── config.json              # グローバル設定
├── db.sqlite                # SQLite DB (memories, usage_logs, plugins...)
├── SOUL.md                  # エージェント Identity
├── USER.md                  # ユーザープロファイル
├── MEMORY.md                # 長期記憶インデックス
├── memory/
│   ├── 2026-03-22.md        # 日付別メモリ
│   └── ...
├── people/
│   ├── tanaka.md            # 人物プロファイル
│   └── ...
├── threads/
│   ├── 2026-03-22_Title.md  # 会話履歴
│   └── ...
├── skills/
│   ├── browser/
│   │   └── SKILL.md
│   ├── web-search/
│   │   └── SKILL.md
│   └── ...
├── plugins/
│   ├── my-plugin/
│   │   ├── manifest.json
│   │   └── index.js
│   └── ...
└── workspaces/
    └── temp-xxx/
        └── .tomu-snapshots/
            └── history.json  # 進行中の会話状態
```

---

## 4. テクノロジースタック

| Layer | Technology |
|:------|:-----------|
| デスクトップ外殻 | Electron |
| UI フレームワーク | React 18 + Vite |
| スタイリング | Tailwind CSS + Radix UI |
| 状態管理 | jotai |
| AI/エージェント統合 | `@anthropic-ai/sdk`, `openai`, `@modelcontextprotocol/sdk` |
| 国際化 | i18next + react-i18next |
| ローカルサーバー | Express.js + ws (WebSocket) |
| バックグラウンドシェル | node-pty (疑似ターミナル) |
| ベクトル DB | sqlite-vec (SQLite 拡張) |
| 全文検索 | fts5 (SQLite 拡張) |
| ブラウザ自動化 | Playwright |
| ファイルパース | gray-matter, mammoth (Word), react-pdf, xlsx, turndown |
| ビルド・バンドル | esbuild, bun |
| エラー追跡 | Sentry (@sentry/electron, @sentry/react) |

---

## 5. 開発フェーズ計画

### Phase 1: 基礎インフラ (Local API Hub)
- Express サーバー起動 (port 23001)
- プロバイダー登録・API キー管理
- LLM プロキシ (OpenAI/Anthropic パススルー)
- **マイルストーン**: curl/Postman から AI とチャットできる

### Phase 2: エージェントの心臓部 (Core Engine)
- SOUL.md / USER.md の読み込みとプロンプト合成
- 言語自動追従ルール適用

### Phase 3: 手足の獲得 (Agentic Loop + Tools)
- tool_calls のインターセプトとループ実装
- Bash (node-pty) / Read / Write / Edit / Glob / Grep ツール実装
- **マイルストーン**: ターミナルから指示 → AI が自律的にファイル操作

### Phase 4: 拡張性 (Skills + Sub-Agents)
- Skill の動的ロード・プロンプト注入
- Task / TaskOutput ツールとサブエージェントオーケストレーション

### Phase 5: 記憶の永続化 (Vector DB + RAG)
- sqlite-vec セットアップと記憶保存
- Hidden Prompt による自動記憶抽出・クリーンアップ
- Daily Notes / MEMORY.md の自動読み込み

### Phase 6: フロントエンドと Electron 外殻
- React チャット UI (SSE ストリーミング)
- WidgetRenderer (sandbox iframe)
- 設定画面 (プロバイダー, スキル, プラグイン)
- Electron パッケージング
