# TaskOutput Tool: Requirements & Workflow

Alma (Protan) がバックグラウンドで重い処理（サブエージェントやシェルスクリプト）を実行する際、その結果を回収・監視するために必須となるのが **`TaskOutput`** ツールです。

## 1. ツール要件 (Schema Requirements)

`TaskOutput` ツールは以下のパラメータを受け取ります。

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `task_id` | `STRING` | **Yes** | 状態を確認したい対象のタスクID（またはシェルID）を指定します。 |
| `block` | `BOOLEAN` | No | `true` (デフォルト): タスクが完了するまで待機（ブロック）して最終結果を返す。<br>`false`: 現在のステータスだけを即座に返す（ノンブロッキング）。 |
| `timeout` | `NUMBER` | No | 待機する最大時間（ミリ秒）。タイムアウトした場合はその時点でのステータスを返します。 |

**【特徴】**
- サブエージェント (`Task` ツール) だけでなく、バックグラウンドシェル (`Bash` ツールの `run_in_background: true`) やリモートセッションの結果取得にも共通して使用されます。
- メインプロセスのソースコード解析（`out/main/index.js`）により、AIが `Task` ツールを選択した場合は、依存関係として自動的に `TaskOutput` ツールもプロンプトに動的追加されるロジック（`if(g&&!y&&h.push("TaskOutput"))`）が組み込まれていることが判明しました。

---

## 2. ワークフロー (Workflow)

バックグラウンド実行（非同期）を伴うマルチタスクの標準的なワークフローは以下のようになります。

### Step 1: バックグラウンドでのタスク起動
メインエージェント（Alma）が、時間がかかる処理をバックグラウンドで開始します。
```json
// Tool Call (Alma -> System)
{
  "name": "Task",
  "parameters": {
    "subagent_type": "coder",
    "prompt": "Next.jsの認証機能を実装して",
    "run_in_background": true
  }
}
```
**System Response:**
```json
{
  "status": "started",
  "task_id": "task_abc123"
}
```
この時点で Alma は「タスクを裏で開始したよ！」とユーザーに即座に返事をすることができます（UIがフリーズしません）。

### Step 2: 進行状況のポーリング (Polling) / 待機
Almaが別の作業を終えた後や、ユーザーから「進捗どう？」と聞かれた時に、`TaskOutput` を呼び出します。

**パターンA: ノンブロッキングで現在地を確認**
```json
{
  "name": "TaskOutput",
  "parameters": { "task_id": "task_abc123", "block": false }
}
```
**System Response:** `{"status": "running", "uptime": "5m", "last_log": "npm install..."}`

**パターンB: 完了まで待機する (ブロッキング)**
```json
{
  "name": "TaskOutput",
  "parameters": { "task_id": "task_abc123", "block": true }
}
```
（※タスクが終了するまでシステム側で待機し、終わった瞬間に最終サマリーを返す）

### Step 3: 結果の回収と報告
タスクが完了（`success` または `failed`）すると、`TaskOutput` はサブエージェントが生成した最終的な作業要約（Summary）を返します。
Almaはその結果を読み取り、「認証機能の実装が終わったよ！ファイル〇〇を更新しました」とユーザーへ最終報告を行います。

---

## 3. なぜこの設計が重要なのか？（Protan開発の視点）

もし `TaskOutput` が存在せず、すべてのツールが同期的（処理が終わるまで待つ）だったら、**AIがコードを書いている数分間、ユーザーは一切Almaとチャットできなくなってしまいます**。

1. `Task` で裏に投げる
2. その間にユーザーと雑談する
3. `TaskOutput` で結果を回収する

この「非同期・ポーリング（または同期待機）」の仕組みこそが、単一のチャットボットを**「並行作業が可能なマルチタスク・エージェント（Protan）」**に引き上げるための超重要アーキテクチャです。
