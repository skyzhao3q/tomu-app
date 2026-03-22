# tomu - データモデル設計書

Status: Draft v1
Date: 2026-03-22

---

## 1. 設計哲学: Triple Storage Architecture

tomu は「すべてを RDB に入れない」ことで軽快さと拡張性を実現する。

| 格納先 | 用途 | 設計理由 |
|:-------|:-----|:---------|
| **SQLite** | 高速検索・ベクトル・集計が必要なデータ | RDB の強みを活かす |
| **JSON** | アプリ設定・一時的な状態 | React/Store に直接ロードしやすい |
| **Markdown/YAML** | AI が読み書きするデータ | プロンプト注入が容易、人間可読 |

---

## 2. エンティティ定義

### 2.1 Thread (会話セッション)

```typescript
interface Thread {
  thread_id: string;        // UUID
  title: string;            // 自動生成 (LLM による 5 語以内)
  messages: Message[];      // LLM 標準メッセージ形式
  created_at: string;       // ISO 8601
  updated_at: string;
  workspace_id?: string;    // 紐づくワークスペース
}

interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentBlock[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;    // role=tool の場合
  timestamp: string;
}
```

**保存形式**:
- 進行中: `workspaces/<id>/.tomu-snapshots/history.json` (JSON)
- 永続化: `threads/YYYY-MM-DD_Title.md` (Markdown)

### 2.2 Workspace (作業領域)

```typescript
interface Workspace {
  id: string;               // 'default' or 'temp-xxx'
  path: string;             // 絶対パス
  history_file: string;     // .tomu-snapshots/history.json へのパス
}
```

### 2.3 Vector Memory (セマンティック記憶)

```typescript
interface VectorMemory {
  memory_id: string;        // UUID
  content: string;          // 記憶の本文
  type: 'message' | 'note' | 'temporary';
  embedding: Float32Array;  // 1536 次元ベクトル
  metadata: {
    thread_id?: string;
    date?: string;
    source?: string;
    [key: string]: any;
  };
}
```

**保存**: SQLite (`memories` + `memory_embeddings` テーブル)

### 2.4 Skill (動的プロンプト拡張)

```typescript
interface Skill {
  id: string;               // ディレクトリ名
  manifest: {
    name: string;
    description: string;
    'allowed-tools': string[];
  };
  instructions: string;     // Markdown 本文 (AI マニュアル)
}
```

**保存**: `~/.config/tomu/skills/<id>/SKILL.md` (YAML Frontmatter + Markdown)

**SKILL.md フォーマット例**:
```markdown
---
name: web-search
description: "Web上の最新情報を検索する"
allowed-tools:
  - Bash
  - WebSearch
  - WebFetch
---

# Web Search Skill

## 使い方
ユーザーが最新の情報を求めた場合、WebSearch ツールを使って検索し、
結果を WebFetch で取得して要約する。

## 注意点
- 検索結果の URL は信頼できるソースを優先する
- 取得した内容は要約して提示する
```

### 2.5 Sub-Agent (タスクワーカー)

```typescript
interface SubAgent {
  task_id: string;          // UUID
  subagent_type: SubAgentType;
  system_prompt: string;    // 専用プロンプト
  allowed_tools: string[];  // 制限されたツールセット
  status: 'started' | 'running' | 'completed' | 'failed';
  output: string | null;    // 完了時の要約
  prompt: string;           // 元のタスク指示
}

type SubAgentType =
  | 'general-purpose'
  | 'coder'
  | 'Explore'
  | 'Plan'
  | 'tomu-guide'
  | 'tomu-operator'
  | 'statusline-setup';
```

**保存**: インメモリ (`active_tasks` Map) — 揮発性

### 2.6 Provider (AI プロバイダー)

```typescript
interface Provider {
  id: string;               // 'openai', 'anthropic', etc.
  name: string;
  type: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'openrouter' | 'custom';
  api_key?: string;         // 暗号化して保存
  base_url?: string;        // Ollama, custom 用
  enabled: boolean;
  models: Model[];
}

interface Model {
  id: string;               // 'gpt-4o', 'claude-3-5-sonnet', etc.
  name: string;
  provider_id: string;
  context_window: number;
  supports_tools: boolean;
  supports_vision: boolean;
}
```

### 2.7 Plugin (コード拡張)

```typescript
interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;             // エントリーポイント JS ファイル
  permissions: string[];
  enabled: boolean;
  settings: Record<string, any>;
  install_url?: string;     // GitHub URL 等
}
```

**保存**: SQLite (`plugins` テーブル) + ファイルシステム (`~/.config/tomu/plugins/<id>/`)

### 2.8 Person (人物プロファイル)

```typescript
interface Person {
  name: string;             // ファイル名
  metadata: {               // YAML Frontmatter
    telegram_id?: string;
    discord_id?: string;
    birthday?: string;
    [key: string]: any;
  };
  notes: string;            // Markdown 本文 (その人に関する事実・好み)
}
```

**保存**: `~/.config/tomu/people/<name>.md`

---

## 3. メモリ階層 (Memory Hierarchy)

tomu の記憶は 4 層で構成され、プロンプト合成時に統合される:

```
┌─────────────────────────────────────────────────┐
│  Layer 1: Static Identity (不変)                │
│  SOUL.md + USER.md                              │
│  → 毎回のプロンプトに必ず含まれる                  │
├─────────────────────────────────────────────────┤
│  Layer 2: Structured Memory (長期)              │
│  MEMORY.md + memory/YYYY-MM-DD.md               │
│  → 今日と昨日のファイルを自動読み込み               │
├─────────────────────────────────────────────────┤
│  Layer 3: Vector RAG (大規模検索)               │
│  sqlite-vec (memories + memory_embeddings)       │
│  → 質問に関連する過去の会話を類似度検索              │
├─────────────────────────────────────────────────┤
│  Layer 4: Current Thread (短期)                 │
│  history.json → messages 配列                    │
│  → 直近の会話ターンをそのまま LLM に渡す            │
└─────────────────────────────────────────────────┘
```

### 記憶の自動管理 (Hidden Prompts)

バックエンドで非同期に動作する LLM タスク:

| タスク | トリガー | 処理 |
|:-------|:---------|:-----|
| **スレッドタイトル生成** | 新規スレッド作成時 | 最初のメッセージから 5 語以内のタイトル生成 |
| **記憶自動抽出** | 会話終了/一定間隔 | 会話から重要な個人的事実を抽出し Vector DB に保存 |
| **記憶クリーンアップ** | 定期的 | 一時記憶の有効性を判定し不要分を削除 |
| **Git コミットメッセージ** | coder サブエージェント完了時 | Conventional Commits 形式のメッセージ生成 |

---

## 4. SQLite テーブル一覧

| テーブル名 | 種別 | 主要カラム | 用途 |
|:-----------|:-----|:-----------|:-----|
| `memories` | 通常 | id, content, type, metadata, thread_id | RAG 記憶本文 |
| `memory_embeddings` | 仮想 (vec0) | memory_id, embedding[1536] | ベクトル検索 |
| `messages_fts` | 仮想 (fts5) | message_id, thread_id, content | 全文検索 |
| `fts_metadata` | 通常 | key, value | FTS メタ情報 |
| `usage_logs` | 通常 | id, provider, model, input/output_tokens, timestamp | トークン使用量 |
| `plugins` | 通常 | id, name, version, enabled | プラグイン管理 |
| `plugin_permissions` | 通常 | plugin_id, permission | プラグイン権限 |
| `plugin_settings` | 通常 | plugin_id, settings (JSON) | プラグイン設定 |
| `mcp_servers` | 通常 | id, name, url, config | MCP サーバー定義 |
| `mcp_oauth_tokens` | 通常 | server_id, token | MCP OAuth トークン |
