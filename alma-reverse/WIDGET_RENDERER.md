# WidgetRenderer: Sandboxed Iframe Architecture

Alma (Protan) の最も視覚的に強力な機能の一つである「チャット画面内への動的UI（ウィジェット）の生成機能」を担う、**`WidgetRenderer`** コンポーネントの実装とアーキテクチャについて解説します。

## 1. 機能の概要
`WidgetRenderer` は、LLM（AI）が `widgetRenderer` ツールを呼び出して生成した任意の HTML/CSS/JS を、Reactのチャット画面上に安全かつインタラクティブに描画するためのコンポーネントです。
- 単なる静的なHTMLではなく、Reactコンポーネントの枠を超えて、**AIがその場で「ミニアプリ」を作り、ユーザーが操作する**ことが可能です。

## 2. 🛡️ サンドボックス化 (Sandboxing) とセキュリティ

ユーザーが安全にAIのコードを実行できるようにするため、生成されたコードは厳密な権限が設定された `<iframe>` の中で実行されます。

### Iframeの属性設定
ソースコードから、以下のサンドボックス設定が施されていることが判明しました：
```html
<iframe sandbox="allow-scripts allow-same-origin allow-popups" ... />
```
- **`allow-scripts`**: ウィジェット内での JavaScript 実行を許可します（これがないとインタラクティブなUIが動きません）。
- **完全な隔離 (Context Isolation)**:
  Electronの Node.js 統合機能（`nodeIntegration`）や IPC メッセージ（`preload` スクリプト）は Iframe 内には**絶対に露出されません**。これにより、AIが「ファイルシステムを破壊する悪意あるJS」を生成しても、Iframeの壁に阻まれて無害化されます。

## 3. 🔄 双方向通信 (postMessage IPC)

Iframeの中（AIが書いたコード）と、外（AlmaのReactアプリ）は完全に隔離されていますが、**`window.postMessage`** を使ってシームレスな対話を実現しています。

抽出されたReactコンポーネント (`WidgetRenderer2`) のイベントハンドラー実装：

```javascript
const handleMessage = useCallback((e) => {
    if (!iframeRef.current) return;
    const d = e.data;
    if (!d || typeof d !== "object") return;
    
    // 1. 動的リサイズ (Auto-resizing)
    if (d.type === "widget-resize" && typeof d.height === "number") {
        setHeight(Math.max(50, Math.min(d.height + 8, 4000)));
    }
    
    // 2. 外部リンクの安全なオープン
    if (d.type === "open-link" && typeof d.url === "string") {
        window.systemFile?.openExternal(d.url).catch(console.error);
    }
    
    // 3. チャットへのコールバック送信 (Reverse Trigger)
    if (d.type === "send-prompt" && typeof d.text === "string" && d.text.trim()) {
        sendMessage?.(d.text.trim());
    }
}, [sendMessage]);
```

### 💡 `send-prompt` がもたらす革命的UX
この通信の仕組みの中で最も注目すべきなのは、**`send-prompt`** イベントです。
これは、**「ウィジェットの中のボタンが押されたら、ユーザーが入力欄にテキストを打ってエンターを押したのと同じように、AIにメッセージを送信する」**という機能です。

例えば、AIが「タスク承認ウィジェット」を生成し、その中の `[承認する]` ボタンをユーザーがクリックすると、Iframeから親ウィンドウに `{type: "send-prompt", text: "承認しました。次のステップへ"}` というメッセージが飛びます。
これにより、テキスト入力すら不要なGUIベースのエージェント対話が可能になっています。

## 4. 🎨 ストリーミングとテーマの同期

- **Streaming Rendering**:
  AIがHTMLを生成している途中（ストリーミング中）でも、中途半端なDOM構造をIframeに流し込み、ユーザーを待たせずにプレビューを表示します（`isStreaming` プロパティで制御）。
- **テーマ同期**:
  `WidgetRenderer` には、Almaアプリ本体のテーマカラー（Dark / Lightモードの色、CSS変数）が自動的に注入される仕組みになっており、AIが適当なHTMLを書いても、アプリ全体と完全に馴染んだデザインで表示されます。

---
## 5. Protan開発への応用
プロタンでこの機能を実装する際は、以下の順番で開発を進めるのがベストプラクティスです。

1. React上で `iframe` をマウントし、`srcdoc` または `Blob URL` でHTMLを流し込むベースを作る。
2. セキュリティのため `sandbox` 属性を適切に制限する。
3. `window.addEventListener("message", ...)` をReact側で購読し、Iframe内からの `widget-resize` メッセージに応じて `iframe` の高さを動的に変える処理を実装する（これにより、ウィジェット内にスクロールバーが出ず、シームレスなカードのように見えます）。
4. `send-prompt` を実装し、ウィジェットからエージェントを逆操作できるようにする。
