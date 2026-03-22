# Alma (Protan) Data Model & Schema Specification

このドキュメントでは、Alma (Protan) のデータ管理方法、データベース(DB)の有無、保存形式、およびスキーマ定義について、リバースエンジニアリングで得たソースコード（`out/main/index.js`）の実装を基に解説します。

## 1. データ管理の全体アーキテクチャ

Alma は「すべてのデータを一つのデータベースに詰め込む」のではなく、**「データの特徴とアクセス頻度に応じたハイブリッド構成」** を採用しています。

大きく分けて以下の3つの形式でデータを管理しています：
1. **SQLite (RDB + Vector DB)**: `sqlite3` + `sqlite-vec` によるトランザクショナルなデータとベクトルインデックス。
2. **JSON (Structured File Storage)**: スレッド履歴（チャットログ）やワークスペース、各種設定データ。
3. **Markdown/YAML (Document Storage)**: スキル、ユーザープロファイル、人物データなど、LLM（AI）が直接読み書きしやすい形式のデータ。

---

## 2. 🗄️ SQLite データベース (Relational & Vector DB)
複雑なクエリや全文検索、および AI のコンテキスト検索（RAG）を必要とするデータは、ローカルの SQLite データベースに保存されます。
（※`sqlite-vec` 拡張モジュールを使うことで、SQLite上で直接 1536次元のベクトル検索を実現しています）

### 主要なテーブルと Schema 定義 (抽出結果)

#### 【Memory (RAG/ベクトル検索)】
AI が過去の文脈を自律的に思い出すための領域。
- **`memories`**
  - `id` (TEXT PRIMARY KEY)
  - `content` (TEXT): 記憶の本文
  - `type` (TEXT): `message`, `note` など
  - `metadata` (TEXT): JSON文字列
  - `thread_id` (TEXT): 関連するチャットスレッド
- **`memory_embeddings` (Virtual Table)**
  - `memory_id` (TEXT PRIMARY KEY)
  - `embedding` (FLOAT[1536]): `sqlite-vec` 拡張を用いた 1536次元ベクトルデータ

#### 【Chat & FTS (全文検索)】
過去のチャットログをユーザーがUI上で高速検索（Thread Search）するためのインデックス。
- **`messages_fts` (Virtual Table)**
  - `message_id`, `thread_id` (UNINDEXED)
  - `content`: `fts5` 拡張を用いた全文検索インデックス
- **`fts_metadata`**
  - `key` (TEXT PRIMARY KEY)
  - `value` (TEXT)

#### 【Usage & Telemetry (トークン消費・統計)】
LLM の利用量（トークン）やAPI課金目安を管理・表示するためのテーブル。
- **`usage_logs`**
  - `id` (TEXT PRIMARY KEY)
  - `provider` (TEXT)
  - `model` (TEXT)
  - `message_id` (TEXT)
  - `input_tokens`, `output_tokens`, `cached_input_tokens`, `reasoning_tokens`, `total_tokens` (INTEGER)
  - `timestamp` (TEXT)

#### 【Extension & Security (プラグイン・MCP・権限)】
- **`plugins` / `plugin_permissions` / `plugin_settings`**: プラグインのメタデータやサンドボックス権限。
- **`mcp_servers` / `mcp_oauth_tokens`**: Model Context Protocol サーバーの設定とOAuthトークン。

---

## 3. 📄 JSON ファイル (Structured File Storage)
ステートレスに扱いやすいデータや、起動時にメモリに丸ごと乗せるべき設定データは、`~/.config/alma/` 配下に JSON ファイルとして保存されます。

| データ種別 | 保存パス | 役割・特徴 |
| :--- | :--- | :--- |
| **App Config** | `config.json` | ユーザー設定（テーマ、言語、APIキーの有無など） |
| **Workspace Snapshots** | `workspaces/temp-xxx/.alma-snapshots/history.json` | ワークスペース（作業領域）内で現在進行中のチャットの状態・メッセージツリー |

---

## 4. 📝 Markdown / YAML (Document Storage)
LLM（AI）が直接テキストとして読んで解釈したり、ユーザーがターミナルやエディタで直接書き換えたりする設定は、Markdown（YAML Frontmatter付き）として保存されます。

| データ種別 | 保存パス | 役割・特徴 |
| :--- | :--- | :--- |
| **Threads (会話履歴)** | `threads/YYYY-MM-DD_Title.md` | チャットの会話履歴の永続化フォーマット。人間が読みやすく、AIのコンテキストにもそのまま流し込める。 |
| **People Profiles** | `people/<name>.md` | `telegram_id` 等の YAML メタデータと、その人物の好みや事実のテキストデータ。（AIの幻覚防止用） |
| **Skills** | `skills/<skill-name>/SKILL.md` | YAML でツール権限 (`allowed-tools`) を定義し、Markdown でAI向けのプロンプト（マニュアル）を定義する。 |
| **Identity & User** | `SOUL.md`, `USER.md` | エージェントの性格とユーザー情報。システムプロンプトの最上部にプレーンテキストとして直接インジェクションされる。 |

## 5. Protan開発への応用 (設計のポイント)
Protan のデータモデルを設計する際、**「なんでもかんでもRDB（SQLite）に入れない」** ことが、エージェントを高速かつ柔軟に保つ最大のポイントです。

- **AIに読ませるデータ**: `Markdown` で保存（RAGで検索しやすい、コンテキストにそのまま注入できる）
- **アプリの状態・設定**: `JSON` で保存（React/Redux に直接ロードしやすい）
- **高速検索・ベクトル・集計**: `SQLite` (sqlite-vec / fts5) に保存（RDBの強みを活かす）

この**「トリプル・ストレージ・アーキテクチャ（SQLite + JSON + Markdown）」**こそが、Alma の軽快さと無限の拡張性を支えるデータモデリングの正体です。
