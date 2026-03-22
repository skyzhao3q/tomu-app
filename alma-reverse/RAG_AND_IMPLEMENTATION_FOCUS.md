# Protan (Alma) Implementation Focus: RAG & Embeddings

このドキュメントでは、プロタンの「開発最大のハードル」であり、システムの賢さを決定づける **RAG (Retrieval-Augmented Generation)** と **Embedding (埋め込み)** のアーキテクチャ・設計アプローチについて深掘りします。

## 1. RAG (ベクトル検索) のアーキテクチャ定義

Alma（Protan）のRAGシステムは、外部のクラウドデータベース（PineconeやWeaviateなど）に依存せず、ユーザーのローカルPC内で完結する **Private RAG** を実現しています。

### 1.1 Vector Database: `sqlite-vec`
- **概要**: 通常のSQLiteにベクトル検索機能を追加する C 言語ベースの拡張モジュール。
- **スキーマ設計**:
  ```sql
  CREATE VIRTUAL TABLE memory_embeddings USING vec0(
      memory_id TEXT PRIMARY KEY,
      embedding FLOAT[1536]  -- 1536次元（OpenAI標準）のベクトル
  )
  ```
- **メリット**: アプリ全体の設定データ（`providers`等）と同じSQLiteファイル（`~/.config/alma/db.sqlite`）内に保存できるため、バックアップやマイグレーションが極めて容易になります。

### 1.2 Embedding API (埋め込みの生成)
テキストをベクトル（数値の配列）に変換する処理です。
ソースコード解析の結果、Almaは単一のAPIに依存せず、プロバイダーごとのフォーマットを吸収するアダプター（`generateEmbedding` 等）を実装しています。

- **OpenAI 互換 (`type: "openai"`, `type: "openrouter"`)**
  - モデル: `text-embedding-3-small` (デフォルト, 1536次元)
  - エンドポイント: `https://api.openai.com/v1/embeddings`
- **Ollama (完全ローカル)**
  - モデル: ユーザー指定のローカルモデル
  - エンドポイント: `http://localhost:11434/api/embeddings`
- **Google Gemini (`type: "google"`)**
  - モデル: `text-embedding-004`
  - エンドポイント: `https://generativelanguage.googleapis.com/v1beta/models/...:embedContent`

---

## 2. 開発への実装アプローチ (Implementation Focus)

プロタンの開発において、RAGとメモリ管理をどう実装していくべきか、具体的なステップと注意点（ハードル）を解説します。

### 🚧 ハードル1: `sqlite-vec` の環境構築 (ネイティブビルド)
`sqlite-vec` は C/C++ で書かれた SQLite 拡張であるため、Node.js（Electron）環境に組み込む際に**ネイティブコンパイル（node-gyp）**の壁にぶつかります。
- **解決策**:
  - `better-sqlite3` と `sqlite-vec` の pre-built バイナリ（OS・アーキテクチャ別にコンパイルされたもの）を正しく `vendor` にバンドルするか、パッケージマネージャー（Bun）のクロスコンパイル設定を適切に構成する必要があります。

### 🚀 アプローチ1: RAG の検索フロー (Retrieval Flow)
ユーザーがチャットを送信した時のバックエンドの処理フローです。

1. **ユーザー入力のベクトル化**:
   - `generateEmbedding("ユーザーの質問文")` を呼び出し、設定されているEmbedding API（例: OpenAI）を叩いて `[0.012, -0.054, ...]` という1536次元の配列を取得する。
2. **類似度検索 (Cosine Similarity)**:
   - `sqlite-vec` に対して以下のSQLクエリを発行する。
     ```sql
     SELECT memory_id, vec_distance_cosine(embedding, '[0.012...]') as distance
     FROM memory_embeddings
     ORDER BY distance ASC
     LIMIT 5;
     ```
3. **コンテキストの復元**:
   - 取得した `memory_id` を元に実データテーブル（`memories`）から元のテキスト（`content`）を引き当て、システムプロンプトの `## MEMORIES` セクションにテキストとして注入する。

### 🚀 アプローチ2: 記憶の再構築 (Rebuild Embeddings)
ユーザーが途中で「OpenAI」から「ローカルのOllama」にEmbeddingモデルを変更した場合、**過去のベクトルデータは次元数（例: 1536次元→768次元）や意味空間が変わるため、使えなくなります。**

- **解決策 (Almaの実装)**:
  - Almaには `rebuildMemoryEmbeddings` というAPIが存在します。
  - これは、既存の `memory_embeddings` テーブルを一度 `DROP` し、DBに残っている元のテキスト（`content`）を新しいモデルで全件再度APIに投げてベクトル化し直し、新しい次元数でテーブルを再作成（`CREATE VIRTUAL TABLE... FLOAT[新しい次元数]`）するバッチ処理です。
  - フロントエンドには SSE または WebSocket でプログレスバー（何件中何件終わったか）を表示します。

## 3. まとめ
RAGのシステムを設計する際、**「Embeddingモデルは途中で変わる可能性がある」** という前提で設計されているのが、Alma (Protan) アーキテクチャの極めて優秀な点です。
外部クラウド（Pinecone等）に依存しないこの仕組みを完成させることで、真の意味で「セキュアでプライベートな」ローカルAIエージェントが完成します。
