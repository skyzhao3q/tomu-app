# Alma (Protan) AI Providers & LLM Proxy Architecture

このドキュメントでは、「プロタン」の頭脳であるAIモデル（LLM）と通信する機能、特に Express Server が担っている「Proxy」や「プロバイダー管理」の実装詳細について解説します。

## 1. 🌐 なぜ Proxy (プロキシ) が必要なのか？

UI（React）から直接 OpenAI や Anthropic の API を呼び出すことは技術的には可能ですが、AlmaはすべてのAIとの通信を **ローカルの Express Server (`http://localhost:23001`)** に迂回（Proxy）させています。
このアーキテクチャには以下の決定的な理由があります。

1. **認証情報の隠蔽 (Credential Security)**
   APIキーなどの秘密情報（`sk-...`）は、ローカルDB（SQLite/JSON）に保存され、Express サーバーだけが知っています。UI側にキーを持たせないことで、フロントエンドのコードからキーが漏洩するリスクをゼロにしています。
2. **コンテキストの自動注入 (Context Injection)**
   プロキシサーバーは、リクエストを受け取った直後、APIに投げる前に `SOUL.md`、`USER.md`、RAGメモリ（`sqlite-vec`）、および有効な `SKILL.md` をシステムプロンプトに動的に合成（Inject）します。UI側はいちいちこれらのファイルを読み込む必要がありません。
3. **Tool Call のインターセプト (Agentic Loop)**
   LLM が「ターミナル（Bash）を使いたい」とレスポンスを返してきた場合、それを UI に返すのではなく、Express サーバーがインターセプトしてローカル環境でコマンドを実行します。この「OS権限」を持ったループは、Node.js ベースのサーバーでしか実現できません。

---

## 2. 🔌 サポートされているプロバイダーと認証フロー

抽出されたコードやCLIの構造から、以下のプロバイダーがネイティブ対応していることが分かっています。

| Provider Name | API Endpoint Mapping (Proxy) | 備考 |
| :--- | :--- | :--- |
| **OpenAI** | `/proxy/:providerId/v1/chat/completions` | `gpt-4o`, `o1` など。標準の OpenAI 互換フォーマット。 |
| **Anthropic** | `/anthropic-proxy/:providerId/v1/messages` | `claude-3-5-sonnet` 等。Anthropic 独自の Messages API 仕様に合わせたプロキシ。 |
| **Google Gemini** | `/proxy/:providerId/v1/...` | Vertex AI または Google AI Studio 経由。 |
| **OpenRouter** | `/proxy/:providerId/v1/...` | 複数モデルのルーティング。 |
| **DeepSeek** | `/proxy/:providerId/v1/...` | コーディングに強いモデル。 |
| **Ollama** | `http://localhost:11434/v1` | ローカルで動くモデル。APIキー不要。 |

### 🔑 認証とトークン管理
1. ユーザーが `alma provider add` や GUIから APIキーを登録する。
2. `config.json` または SQLite DB にキーが保存される。
3. プロキシリクエストが飛んできた際、`ProviderManager` が該当する `providerId` のキーを引き当て、`Authorization: Bearer sk-...` ヘッダを付与して本来のエンドポイント（`api.openai.com` 等）へフォワードします。

---

## 3. 🔄 プロタン開発の第一歩 (The Initial Implementation)

プロタンの「エンジン」を開発する際、まずはこの **LLM Proxy 機能** から着手するのが最短ルートです。

### 開発のステップ

#### Step 1: 単純な Proxy サーバーの作成
- Express.js で `/api/chat/completions` エンドポイントを作成する。
- リクエストを受け取り、サーバーの環境変数（または設定ファイル）から APIキーを取り出して OpenAI に転送（Fetch）し、レスポンスをそのまま返す機能を作る。

#### Step 2: Context Injection の追加
- 転送する直前に、リクエストの `messages` 配列の先頭（`system` ロール）に、`SOUL.md` と `USER.md` のテキストファイルの中身を読み込んで文字列結合するロジックを追加する。

#### Step 3: Tool Call のインターセプト (The Engine Core)
- OpenAI に `tools` パラメータとして `Bash` や `Read` などの定義を渡す。
- OpenAI からのレスポンスが `tool_calls` を含んでいた場合、それをフロントエンドに返さずに、Node.js 側で `child_process.exec` や `fs.readFileSync` を使って実行する。
- 実行結果を新しいメッセージとして配列に追加し、**再度 OpenAI の API を叩く**（これがエージェント・ループです）。

---
## 4. 結語
**「AI Provider がないと Express Server はほとんど機能しない」**という見立ては完全に正しいです。
このローカルAPIサーバーは、LLMの推論能力を借りて初めて「脳と手足」が繋がるように設計されています。プロタンの開発は、まさにこの「プロキシサーバーの構築」と「エージェントループの実装」から始めるべきです。
