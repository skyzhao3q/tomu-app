# tomu - データモデル設計書

Status: Draft v3
Date: 2026-05-01

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

**保存**: SQLite。現行実装では `memories` (本文テーブル) と、sqlite-vec の vec0 仮想テーブル `memory_embeddings` (FLOAT[1536]) を使う。`memory_vectors` テーブルは存在しない。

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
  | 'explore'
  | 'plan'
  | 'tomu-guide'
  | 'tomu-operator'
  | 'statusline-setup';
```

**保存**: 互換 API 用の `Task` はメモリ上にも保持されるが、実行実体は `agent_missions`, `agent_runs`, `agent_handoffs` に永続化される。`agent_runs.messages_json` は再起動後の resume 用の会話状態を保持する。

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

### 2.9 Agent Profile (設定可能な専門エージェント)

```typescript
interface AgentProfile {
  id: string;               // a-z, 0-9, hyphen
  name: string;
  category: 'design' | 'product' | 'engineering' | 'research' | 'operations' | 'custom';
  executionMode:
    | 'general-purpose'
    | 'plan'
    | 'coder'
    | 'tomu-operator'
    | 'explore'
    | 'tomu-guide'
    | 'statusline-setup';
  enabled: boolean;
  builtIn: boolean;
  color: string;
  summary: string;
  focus: string[];
  delegatesTo: string[];
  prompt: string;
  model?: string;
}
```

**保存**: SQLite (`agent_profiles`)。組み込みプロファイルは初回起動時に `assets/prompts/subagents/*.md` から seed される。

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
│  memory_embeddings (vec0 仮想テーブル, FLOAT[1536])│
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
| `memory_embeddings` | 仮想 (vec0) | memory_id TEXT PRIMARY KEY, embedding FLOAT[1536] | ベクトル検索用 embedding |
| `messages_fts` | 仮想 (fts5) | content, thread_id UNINDEXED | 全文検索 |
| `usage_logs` | 通常 | id, provider, model, input/output_tokens, timestamp | トークン使用量 |
| `plugins` | 通常 | id, name, version, enabled | プラグイン管理 |
| `plugin_permissions` | 通常 | plugin_id, permission | プラグイン権限 |
| `plugin_settings` | 通常 | plugin_id, settings (JSON) | プラグイン設定 |
| `mcp_servers` | 通常 | id, name, url, config | MCP サーバー定義 |
| `mcp_oauth_tokens` | 通常 | server_id, token | MCP OAuth トークン |
| `agent_missions` | 通常 | id, thread_id, root_message_id, title, status | ミッション単位の管理 |
| `agent_runs` | 通常 | id, mission_id, agent_id, status, messages_json | エージェント実行履歴・resume |
| `agent_handoffs` | 通常 | id, mission_id, from_run_id, to_agent_id, to_run_id, status, to_agent_name, packet, result_summary | 委譲履歴 |
| `agent_profiles` | 通常 | id, execution_mode, enabled, built_in, prompt, model | Settings の Agents UI |

---

## 5. RAG & Embedding Architecture

tomu のRAGシステムは外部クラウドデータベース (Pinecone, Weaviate 等) に依存せず、ユーザーのローカルPC内で完結する **Private RAG** を実現する。

### 5.1 Embedding プロバイダー

| プロバイダー | タイプ | モデル | 次元数 | エンドポイント |
|:-------------|:-------|:-------|:-------|:---------------|
| **OpenAI** | `openai` / `openrouter` | `text-embedding-3-small` (デフォルト) | 1536 | `https://api.openai.com/v1/embeddings` |
| **Ollama** | `ollama` (完全ローカル) | ユーザー指定のローカルモデル | モデル依存 | `http://localhost:11434/api/embeddings` |
| **Google** | `google` | `text-embedding-004` | モデル依存 | `https://generativelanguage.googleapis.com/v1beta/models/...:embedContent` |

### 5.2 `generateEmbedding()` アダプターパターン

テキストをベクトルに変換する処理は、プロバイダーごとのフォーマット差異を吸収するアダプター関数 `generateEmbedding()` で抽象化される。各プロバイダーの API 仕様の違い (リクエスト/レスポンス形式) をこの関数内で吸収し、呼び出し側は統一的なインターフェースで Embedding を取得できる。

### 5.3 検索フロー (Retrieval Flow)

ユーザーがチャットを送信した際のバックエンド処理:

```
1. ユーザー入力のベクトル化
   generateEmbedding("ユーザーの質問文") → [0.012, -0.054, ...] (1536次元配列)

2. 類似度検索 (Cosine Similarity)
   SELECT memory_id, vec_distance_cosine(embedding, '[0.012...]') as distance
   FROM memory_embeddings
   ORDER BY distance ASC
   LIMIT 5;

3. コンテキストの復元
   取得した memory_id → memories テーブルから content を引き当て
   → システムプロンプトの ## MEMORIES セクションにテキストとして注入
```

### 5.4 Embedding 再構築 (Rebuild Mechanism)

ユーザーが Embedding モデルを変更した場合 (例: OpenAI → Ollama)、過去のベクトルデータは次元数や意味空間が変わるため使用不能になる。

**`rebuildMemoryEmbeddings` API**:
1. 既存の `memory_embeddings` テーブルを `DROP`
2. `memories` テーブルに残っている元テキスト (`content`) を新しいモデルで全件再ベクトル化
3. 新しい次元数で `CREATE VIRTUAL TABLE ... FLOAT[新次元数]` としてテーブルを再作成
4. フロントエンドに SSE でプログレス (何件中何件完了) を報告

> **設計思想**: 「Embedding モデルは途中で変わる可能性がある」という前提で設計されている。

---

## 6. People Profiles (ファイルベース人物プロファイル)

### 6.1 ファイルスキーマ

保存先: `~/.config/tomu/people/<name>.md`

```yaml
---
telegram_id: "123456789"
discord_id: "987654321"
feishu_id: "ou_xxxxx"
username: "alex_dev"
---
# About Alex
- 職業: フロントエンドエンジニア
- 言語: 主に日本語で話す
- 好み: ReactとTailwindCSSを好む
```

### 6.2 アバター画像

| ファイル | 用途 |
|:---------|:-----|
| `~/.config/tomu/people/<name>.avatar.jpg` | デフォルトアバター |
| `~/.config/tomu/people/<name>.avatar.discord.jpg` | Discord 連携用 |
| `~/.config/tomu/people/<name>.avatar.telegram.jpg` | Telegram 連携用 |

### 6.3 RAG に対する優先度

Context Synthesizer はチャット相手が特定できた場合、**RAG の検索結果よりも優先して** `<name>.md` の内容をシステムプロンプトの上部に強制注入する。これにより「ユーザーの ID」や「嫌いなもの」といった絶対に間違えてはいけない事実が確実にコンテキストに含まれる。

### 6.4 プラットフォームマッチング

IM Bridge (Telegram / Discord 等) 経由でメッセージを受信した際、メッセージの `user_id` とプロファイル内の `telegram_id` / `discord_id` をマッチングさせることで、AI は「今話しかけてきているのが誰か」を正確に認識する。

---

## 7. Cron データストレージ

### 7.1 ジョブ定義

保存先: `~/.config/tomu/cron/jobs.json`

```typescript
interface CronJob {
  id: string;               // UUID
  name: string;             // ジョブ名
  scheduleType: string;     // 'cron' | 'interval' 等
  schedule: string;         // cron 式 or interval 値
  executionMode: string;    // 実行モード
  payload: string;          // 実行内容 (プロンプト等)
  enabled: boolean;         // 有効/無効
}
```

### 7.2 実行履歴

保存先: `~/.config/tomu/cron/runs.json`

ジョブの実行結果 (成功/失敗、実行時刻、出力) を時系列で記録する。
