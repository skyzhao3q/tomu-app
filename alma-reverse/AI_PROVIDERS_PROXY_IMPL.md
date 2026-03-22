# AI Provider Proxy Implementation (Express Server)

このドキュメントでは、Alma（Protan）の頭脳であるAIプロバイダーとの通信を中継する **Express Server の Proxy（プロキシ）API** の具体的な実装詳細について解説します。
「プロタン」のエンジンを開発する上で、このProxy APIの実装は最初に着手すべき最も重要なコア機能です。

## 1. Proxy API のエンドポイント
Express サーバー (`out/main/index.js`) には、クライアント（React UI や CLI）からのLLM呼び出しをインターセプトするためのプロキシ用エンドポイントが定義されています。

```javascript
app.post("/proxy/:providerId/v1/responses", this.handleResponsesApi.bind(this));
app.post("/anthropic-proxy/:providerId/v1/messages", this.handleAnthropicApi.bind(this));
```

- **OpenAI 互換プロキシ**: `handleResponsesApi` メソッドで処理。
- **Anthropic (Claude) 互換プロキシ**: `handleAnthropicApi` メソッドで処理。

## 2. Proxy ハンドラーの実装ロジック (`handleAnthropicApi` の解析)
抽出されたコードをもとに、サーバー側でリクエストをどう処理しているかのワークフローを解説します。

### Step 1: プロバイダー情報の取得
URLのパスパラメータから `:providerId` を取得し、ローカルのデータベース（設定）から該当するプロバイダーの設定（`apiKey`, `baseURL`, `type`）を引き当てます。

```javascript
const { providerId: n } = e.params;
const o = zn.getProviderById(n); // DBからプロバイダー設定を取得
if (!o) return t.status(404).json({ error: "Provider not found" });
```

### Step 2: エンドポイント (Base URL) の動的解決
プロバイダーの `type`（OpenAI, Anthropic, Gemini等）に応じて、実際のリクエスト先エンドポイントを動的に切り替えます。ユーザーが設定で `baseURL` を上書きしている場合はそちらを優先します。

```javascript
let s = "";
switch (o.type) {
    case "openai": s = o.baseURL || "https://api.openai.com/v1"; break;
    case "anthropic": s = o.baseURL || "https://api.anthropic.com"; break;
    case "openrouter": s = o.baseURL || "https://openrouter.ai/api/v1"; break;
    case "deepseek": s = o.baseURL || "https://api.deepseek.com"; break;
    case "google": s = o.baseURL || "https://generativelanguage.googleapis.com/v1beta"; break;
    case "ollama": s = o.baseURL || "http://localhost:11434/v1"; break;
    // ... custom, azure, etc.
}
```

### Step 3: APIキー (認証情報) の検証と保護
ここで初めて、UIには隠蔽されていた APIキー が呼び出されます。キーが未設定の場合は即座にエラーを返します。
```javascript
const r = o.apiKey;
if (!r) {
    return t.status(401).json({
        type: "error",
        error: { type: "authentication_error", message: `Provider ${o.name} has no API key configured.` }
    });
}
```

### Step 4: モデルのオーバーライドとフォールバック
リクエストの `body.model` が空の場合や、UI側で別のモデル（セッション連携など）が指定されている場合、サーバー側でモデル文字列を強制的に上書きします。
```javascript
let a = e.body?.model;
// セッションからターゲットモデルを取得、またはプロバイダーのデフォルトモデルをフォールバックとして使用
if (targetModel) {
    a = targetModel;
} else if (!a && o.models && o.models.length > 0) {
    a = o.models[0];
}
// リクエストの body を上書き
if (e.body && a !== e.body.model) {
    e.body.model = a;
}
```

### Step 5: バックエンドからの HTTP Fetch (Proxying)
すべての準備が整った後、Node.js サーバーから実際のAIプロバイダーに向けてリクエストを送信します。
プロバイダーによっては特殊なフォーマット（例: Google Gemini）への変換が必要なため、内部で変換用のアダプター関数（`ai()` や `Yr()` など）に分岐しています。

```javascript
if (o.type === "google") {
    // Gemini 用のリクエスト変換と送信
    const n = { baseUrl: s, apiKey: r };
    await ai(e, t, n);
} else {
    // OpenAI / Anthropic 標準フォーマットでの送信とストリーミング返却
    await Yr(e, t, s, r);
}
```

## 3. プロタン開発での設計アプローチ (Implementation Guide)

プロタンのコアエンジンを最初から実装する場合、この「Proxy API」の構造を一番最初に構築する必要があります。

1. **DB / Config 連携**:
   ユーザーがUIから入力した APIキー や URL は、JSON または SQLite に保存し、この Proxy ルーターだけがアクセスできるようにする。
2. **ルーティングの集約**:
   UI (React) 内では、`fetch('https://api.openai.com/...')` とは絶対に書かず、常に `fetch('http://localhost:23001/proxy/openai/v1/chat/completions')` と書く設計にする。
3. **アダプター層 (Adapter Pattern)**:
   LLM の仕様は日々変わるため、`handleResponsesApi` の最後でプロバイダーごとに通信を分岐させる **アダプター層 (`Yr()` 関数に相当)** を設け、ストリーミング (SSE) を正しくクライアントに中継（Pipe）できるようにする。

これが完了すれば、セキュアで透過的な「LLMの頭脳」が手に入り、次に `Tool Call` のインターセプト（手足の追加）へと進むことができます。
