# Alma (Protan) AI Provider Management Architecture

このドキュメントは、Alma（Protan）が複数のAIプロバイダー（OpenAI, Anthropic, Gemini, Ollama等）をどのように管理し、モデルを呼び出しているかの仕組みを解説するものです。

## 🌐 1. Provider Management API (プロバイダー管理)
APIサーバーには、プロバイダーとモデルを管理するための専用エンドポイントが用意されています。

| Method | Endpoint | Role |
| :--- | :--- | :--- |
| `GET` | `/api/providers` | 登録されている全プロバイダー（APIキーや状態）の取得 |
| `POST` | `/api/providers` | 新しいカスタムプロバイダー（OllamaやOpenRouter等）の追加 |
| `PUT` | `/api/providers/:id` | APIキーの設定や有効化状態の更新 |
| `POST` | `/api/providers/:id/test` | APIキーの有効性テスト（Ping） |
| `GET` | `/api/providers/:id/models` | そのプロバイダーで使用可能なモデル一覧の取得 |
| `POST` | `/api/providers/:id/models/fetch` | API経由で利用可能な最新モデルのリストを動的にフェッチ |
| `POST` | `/api/providers/:id/refresh-quotas` | APIの使用量（クォータ）やクレジット残高の更新 |

## 🧠 2. Supported AI Providers (サポートされている主要プロバイダー)
コード内の出現頻度やSDK構成から、Almaは以下のプロバイダーをネイティブにサポートしていることが判明しました。

- **OpenAI** (gpt-4o, o1等)
- **Anthropic** (Claude 3.5 Sonnet等)
- **Google Gemini** (Gemini 1.5 Pro等)
- **OpenRouter** (複数モデルのルーティング)
- **DeepSeek** (コーディングエージェントとして強力)
- **Ollama** (完全なローカルモデルの実行環境)

## 🔄 3. Architecture & Proxying (プロキシとリクエストの仕組み)
Almaの最大の特徴は、**ローカルでプロキシ（Proxy）として振る舞う**ことです。
チャットUI（レンダラープロセス）やCLIからのAIモデル呼び出しは、直接外部のAPIを叩くのではなく、必ずローカルAPIサーバーを経由します。

- `POST /proxy/:providerId/v1/responses`
- `POST /anthropic-proxy/:providerId/v1/messages`

**なぜプロキシを経由するのか？**
1. **APIキーの隠蔽（Security）**: クライアント（UIやCLI）側にAPIキーを露出させないため。
2. **コンテキストの自動注入**: リクエストを転送する前に、`SOUL.md`（アイデンティティ）や `USER.md`（ユーザー情報）、`threads`（過去の履歴）を「システムプロンプト」として動的に合成するため。
3. **ツールのフック（Tool Interception）**: AIが「Bashを使いたい」と返してきた時、それをそのままUIに返すのではなく、サーバー側でインターセプトしてOSのコマンドを実行し、結果を再びAIに返す「エージェントループ」を回すため。
