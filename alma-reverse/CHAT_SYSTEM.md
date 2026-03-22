# Chat System Architecture (Reverse Engineered)

## 1. API Endpoints (Backend)
チャット機能はローカルのAPIサーバー (`localhost:23001`) で処理されています。
以下は抽出された主要なチャット関連のAPIエンドポイントです：

- `POST /api/chat/completions`: チャットの送信・応答生成のエントリーポイント。
- `POST /api/chat/responses`: プロキシを通じたLLMへのリクエスト。
- `POST /api/chat/generate-title`: スレッドタイトルの自動生成。
- `POST /api/chat/generate-summary`: 会話の要約生成。
- `POST /api/threads`: 新しいチャットスレッドの作成。
- `GET /api/threads/:id`: スレッドの履歴取得。
- `PUT /api/threads/:id`: スレッドの更新（アーカイブやタイトル変更）。

## 2. Fatigue (疲労度) システムとの連携
チャットメッセージを送信するたびに、裏で `recordMessage()` が呼ばれ、エージェントの「疲労度」が蓄積されます。
- **Awake**: 通常状態。
- **Tired**: エネルギーが低下し、応答が少し面倒くさそうになる。
- **Asleep**: 返信を拒否するか、`alma wake` で起こす必要がある。

## 3. Storage
チャット履歴は Markdown 形式と JSON 形式の両方で `~/.config/alma/threads/` および Workspace 内に永続化されています。
