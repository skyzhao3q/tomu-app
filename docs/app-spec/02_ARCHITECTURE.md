# tomu - アーキテクチャ設計書

Status: Draft v2
Date: 2026-05-01

---

## 1. システム全体構成

tomu は **API ファースト（バックエンド主導）** な設計を採用する。
フロントエンド (React) とバックエンド (Express) は完全に分離され、すべての通信は REST API + SSE で行われる。現行実装ではチャットストリームに SSE を使い、設定変更の WebSocket ブロードキャストは未実装。

### 1.1 レイヤー構成

```
┌─────────────────────────────────────────────────────────┐
│                  Client Layer (Frontend)                 │
│  ┌──────────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Desktop UI   │  │ CLI      │  │ External Tools    │  │
│  │ (React/Vite) │  │ (tsx)    │  │ (HTTP clients)    │  │
│  └──────┬───────┘  └────┬─────┘  └────────┬──────────┘  │
└─────────┼───────────────┼─────────────────┼─────────────┘
          │ HTTP/SSE      │ HTTP            │ Webhook
┌─────────▼───────────────▼─────────────────▼─────────────┐
│              Local API Hub (Express.js :33001/:33002)    │
│  ┌──────────────────────────────────────────────────┐   │
│  │                  API Router                       │   │
│  │  /api/chat  /api/providers  /api/skills  /api/tasks│   │
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
│  │ Anthropic    │ │ │  │+FTS/RAG   │ │      │ │        │ │
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
│   │   │   │   ├── routes/     # Express API ルート
│   │   │   │   ├── tasks.ts    # エージェント実行・Task 委譲
│   │   │   │   ├── agents.ts   # Agent profile DB/seed
│   │   │   │   └── tools/      # Native Tools (Bash, Read, Write)
│   │   │   └── electron/       # Electron main/preload/tray
│   ├── viewer/                 # React UI (Vite SPA)
│   │   ├── src/
│   │   │   ├── components/     # UI コンポーネント (chat, artifact, sidebar)
│   │   │   ├── hooks/          # React Hooks
│   │   │   └── store/          # 状態管理 (jotai)
│   └── cli/                    # ターミナル用 CLI コマンド
│       ├── index.ts            # コマンドルーター (`tomu`)
│       └── commands/           # サブコマンド (config, skill, providers)
├── packages/
│   ├── core/                   # 共通の型定義・ユーティリティ
│   └── ui/                     # 共通 React コンポーネント (Design System)
└── assets/
    ├── prompts/                # Base/sub-agent prompts
    ├── skills/                 # Bundled SKILL.md directories
    └── tools/                  # Tool documentation loaded by prompts
```

---

## 2. コンポーネント詳細設計

### 2.1 Local API Hub (Express.js Server)

**ポート**: CLI 既定は `http://localhost:33001`。Express 単体の既定は `PORT` 未指定時 `33002`。
**責務**: すべての LLM 通信・ファイル操作・メモリ管理の中央ハブ

#### 主要 API エンドポイント群

| カテゴリ | Method | Endpoint | 説明 |
|:---------|:-------|:---------|:-----|
| **Chat** | POST | `/api/chat/completions` | メインエントリー: コンテキスト合成 + エージェントループ |
| **Threads** | GET/POST/DELETE | `/api/threads[/:id]` | スレッド CRUD |
| **Threads** | GET | `/api/threads/:id/messages` | メッセージ履歴取得 |
| **Providers** | GET/POST/PUT/DELETE | `/api/providers[/:id]` | AI プロバイダー管理 |
| **Providers** | POST | `/api/providers/:id/test` | API キー有効性テスト |
| **Providers** | POST | `/api/providers/:id/models/fetch` | 利用可能モデル取得 |
| **Memory** | POST | `/api/memories/search` | ベクトル類似度検索 |
| **Memory** | GET/POST/DELETE | `/api/memories[/:id]` | メモリ CRUD |
| **People** | GET/POST/PUT/DELETE | `/api/people[/:name]` | 人物プロファイル管理 |
| **Skills** | GET/DELETE | `/api/skills[/:id]` | スキル管理 |
| **Skills** | POST | `/api/skills/install` | スキルインストール |
| **Plugins** | GET/POST/DELETE | `/api/plugins[/:name]` | プラグイン管理 |
| **MCP** | GET/POST/PUT/DELETE | `/api/mcp/servers[/:name]` | MCP サーバー管理 |
| **Tasks** | GET/POST/DELETE | `/api/tasks[/:id]` | サブエージェント状態取得・起動 |
| **Missions** | GET | `/api/missions[/:id]` | 永続化ミッション状態 |
| **Workspaces** | GET/PUT | `/api/workspaces[/:id]` | ワークスペース管理 |
| **Settings** | GET/PUT | `/api/settings` | アプリ設定 |
| **Browser** | GET/POST | `/api/browser/*` | ブラウザ操作 |

### 2.2 Core Engine

#### 2.2.1 Context Synthesizer (プロンプト合成)

LLM にリクエストを送る直前に、以下を動的に結合してシステムプロンプトを生成:

```
1. Base Instructions (ハードコード) ─── 人格の「憲法」
2. SOUL.md (Identity) ────────────── エージェントの性格・外見・ルール
3. USER.md (User Profile) ─────────── ユーザー情報
4. People Profile ─────────────────── 会話相手にマッチした ~/.config/tomu/people/<name>.md (context.ts が注入)
5. MEMORY.md + Daily Notes ────────── 長期記憶 + 今日/昨日のメモ
6. Vector RAG Results ─────────────── memory_embeddings (vec0) からの関連記憶
7. Matched Skills ─────────────────── 入力に関連する SKILL.md のマニュアル
8. Tool Schemas ───────────────────── 利用可能な Native Tools の JSON Schema
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
| `Bash` | child_process | シェルコマンド実行 |
| `Read` | fs.readFileSync | ローカルファイル読み取り |
| `Write` | fs.writeFileSync | ローカルファイル書き込み |
| `Edit` | string replace | ファイル内テキスト置換 |
| `Glob` | glob pattern | ファイルパターン検索 |
| `Grep` | ripgrep | ファイル内容検索 |
| `Task` | sub-agent spawn | バックグラウンドサブエージェント起動 |
| `TaskOutput` | polling | サブエージェント結果取得 |
| `widgetRenderer` | iframe srcdoc | チャット内 HTML/JS ウィジェット生成 |
| `pieChart` | SVG widget | 円グラフウィジェット生成 |
| `barChart` | SVG widget | 棒グラフウィジェット生成 |

### 2.4 Sub-Agent Orchestrator

#### サブエージェント定義

| Type | System Prompt 概要 | 許可ツール |
|:-----|:-------------------|:-----------|
| `general-purpose` | 汎用タスク処理 | 全ツール |
| `coder` | コーディング専門 | Bash, Read, Write, Edit, Glob, Grep |
| `explore` | コードベース調査 | Read, Glob, Grep, Bash |
| `plan` | 設計・計画立案 | Read, Glob, Grep |
| `tomu-guide` | アプリ使用ガイド | Read, Glob, Grep |
| `tomu-operator` | 設定操作 | Read, Glob, Grep |
| `product-manager` | 要件・計画・委譲 | Read, Glob, Grep, Task, TaskOutput |
| `designer` | UX/UI 設計 | Read, Glob, Grep, Task, TaskOutput |
| `developer` | 実装・検証 | Bash, Read, Write, Edit, Glob, Grep, Task, TaskOutput |
| `researcher` | 調査 | Read, Glob, Grep |
| `operator` | 運用 | Bash, Read, Write |

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
| **SQLite** (+ fts5) | ベクトル検索, 全文検索, 使用量ログ, プラグイン管理 | 高速クエリ, トランザクション |
| **JSON** | アプリ設定, 進行中の会話状態 | ステートレス, メモリにロード |
| **Markdown/YAML** | Identity, Skills, People, Threads | LLM が直接読み書き, 人間可読 |

### 3.2 SQLite スキーマ

```sql
-- RAG / ベクトル検索
CREATE TABLE memories (
    id TEXT PRIMARY KEY,
    content TEXT,
    type TEXT,          -- 'message', 'note', 'temporary'
    metadata TEXT,      -- JSON
    thread_id TEXT
);

-- Vector similarity search (sqlite-vec vec0 virtual table)
CREATE VIRTUAL TABLE memory_embeddings USING vec0(
    memory_id TEXT PRIMARY KEY,
    embedding FLOAT[1536]
);

-- 全文検索 (FTS5)
CREATE VIRTUAL TABLE messages_fts USING fts5(
    content,
    thread_id UNINDEXED
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
| スタイリング | Tailwind CSS + `@tomu/ui` |
| 状態管理 | jotai |
| AI/エージェント統合 | Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`) |
| ローカルサーバー | Express.js |
| バックグラウンドシェル | Node.js child process |
| ベクトル DB | sqlite-vec 仮想テーブル (`memory_embeddings`, FLOAT[1536]) |
| 全文検索 | fts5 (SQLite 拡張) |
| ファイルパース | gray-matter |
| ビルド・バンドル | TypeScript, tsx, Vite, Turbo |

---

## 5. 開発フェーズ計画

### Phase 1: 基礎インフラ (Local API Hub)
- Express サーバー起動 (CLI 既定 port 33001 / 単体既定 port 33002)
- プロバイダー登録・API キー管理
- LLM プロキシ (OpenAI/Anthropic パススルー)
- **マイルストーン**: curl/Postman から AI とチャットできる

### Phase 2: エージェントの心臓部 (Core Engine)
- SOUL.md / USER.md の読み込みとプロンプト合成
- 言語自動追従ルール適用

### Phase 3: 手足の獲得 (Agentic Loop + Tools)
- tool_calls のインターセプトとループ実装
- Bash / Read / Write / Edit / Glob / Grep ツール実装
- **マイルストーン**: ターミナルから指示 → AI が自律的にファイル操作

### Phase 4: 拡張性 (Skills + Sub-Agents)
- Skill の動的ロード・プロンプト注入
- Task / TaskOutput ツールとサブエージェントオーケストレーション

### Phase 5: 記憶の永続化 (Vector DB + RAG)
- memory_embeddings (sqlite-vec) セットアップと記憶保存
- Hidden Prompt による自動記憶抽出・クリーンアップ
- Daily Notes / MEMORY.md の自動読み込み

### Phase 6: フロントエンドと Electron 外殻
- React チャット UI (SSE ストリーミング)
- WidgetRenderer (sandbox iframe)
- 設定画面 (プロバイダー, スキル, プラグイン)
- Electron パッケージング
