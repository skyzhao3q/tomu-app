# Alma (Protan) Memory System Architecture

このドキュメントでは、Alma（Protan）がユーザーの情報や過去の会話を「記憶」し、適切に思い出すためのMemory機能のアーキテクチャと実装詳細を解説します。

## 1. 記憶システムの基本構造 (Dual Memory Architecture)

Almaの記憶システムは、LLMの幻覚（ハルシネーション）を防ぎ、正確なコンテキストを維持するために、**「ベクトル検索（RAG）」** と **「構造化プロファイル」** の2層構造で設計されています。

### ① ベクトルメモリ (Semantic RAG)
過去の雑談や出来事、一般的な事実を「意味的（セマンティック）」に保存・検索する仕組みです。

- **技術スタック**: `sqlite-vec` (SQLiteの拡張モジュール。ローカル環境で高速なベクトル演算と近似最近傍探索を実現)
- **DBスキーマ (抽出結果)**:
  - `memories` テーブル: `content` (記憶のテキスト), `type`, `metadata`, `thread_id` (会話との紐付け)
  - `memory_embeddings` (仮想テーブル): `vec0(memory_id PRIMARY KEY, embedding FLOAT[1536])`
    ※ 1536次元は OpenAI の `text-embedding-3-small` や `text-embedding-ada-002` と互換性のある標準サイズです。
- **特徴**: 会話中、現在のコンテキストに近い過去の記憶が自動的に検索され、裏でプロンプトにインジェクション（注入）されます。

### ② 構造化プロファイル (People & Identities)
「名前」「年齢」「趣味」「ID」など、**絶対に間違えてはいけない情報**をベクトル空間に混ぜると、他の人の記憶と混ざる（ハルシネーション）危険があります。そのため、個人情報は物理ファイル（Markdown + YAML）として分離されています。

- **保存場所**: `~/.config/alma/people/<name>.md`
- **フォーマット**:
  ```yaml
  ---
  telegram_id: "123456789"
  discord_username: "someone"
  ---
  ```
- **特徴**: チャットの相手が判明した瞬間、このファイルが丸ごとプロンプトの冒頭にロードされます。`memory-management` スキルにおいても、「**個人情報にはベクトル検索（alma memory）ではなく、プロファイル管理（alma people）を優先して使うこと**」と厳密にルール化されています。

---

## 2. API エンドポイントと操作 (Backend)

ローカルAPIサーバー (`out/main/index.js`) には、記憶とプロファイルを管理するための豊富なエンドポイントが用意されています。

**【Vector Memory API】**
- `POST /api/memories/search`: ベクトル類似度による記憶のセマンティック検索
- `POST /api/memories`: 新しい記憶（テキストと埋め込みベクトル）の追加
- `GET /api/memories/stats`: 現在の記憶の総数やDBサイズの統計取得
- `POST /api/memories/rebuild`: 過去のチャットログから埋め込み（Embeddings）を再構築するバッチ処理

**【People Profile API】**
- `GET /api/people/:name`: 特定ユーザーのプロファイル（Markdown）を取得
- `PUT /api/people/:name`: プロファイルの更新（趣味や設定の追加）
- `POST /api/people/:name/avatar`: ユーザーの顔写真・アイコン画像の保存

---

## 3. エージェントの自律的な記憶管理 (The `memory-management` Skill)

ユーザーが「前に話したあの件、覚えてる？」や「私の趣味を覚えといて」と言った時、Almaは `memory-management` スキル（`SKILL.md`）を参照し、自律的にCLIコマンドを叩いて記憶を操作します。

**【AIが使用するコマンド群】**
- `alma memory search <query>`: 過去の文脈を自力で検索する。
- `alma memory add <content>`: 新しい事実をベクトルの海に放り込む。
- `alma people append <name> <fact>`: 人物のプロファイルに確実な事実（例えば "好きな色は赤"）を追記する。

## 4. プロタン開発への応用 (Key Takeaways)

「プロタン」を開発する上で、この Memory アーキテクチャの最大の発見は以下の点です：
1. **Pinecone などの外部ベクタデータベースが不要**: `sqlite-vec` を使うことで、完全オフラインかつローカルPC内で完結する高速な RAG 環境を構築できる。
2. **記憶の使い分け**: すべてをベクトル化するのではなく、設定や人物プロファイルは「確実なYAML/Markdownファイル」として管理し、雑多な出来事だけをベクトル化する設計が、AIエージェントの賢さを担保している。
