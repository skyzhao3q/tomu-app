# tomu - UI/UX・ウィジェット設計書

Status: Draft v1
Date: 2026-03-22

---

## 1. UI アーキテクチャ

### 1.1 技術スタック

| 項目 | 技術 |
|:-----|:-----|
| フレームワーク | React 18 + Vite (SPA) |
| スタイリング | Tailwind CSS + Radix UI |
| 状態管理 | jotai (atomic state) |
| データフェッチ | useSWR |
| 国際化 | i18next + react-i18next |
| Electron 連携 | preload スクリプト (IPC ブリッジ) |

### 1.2 画面構成

```
┌──────────────────────────────────────────────┐
│  Title Bar (Electron)                        │
├──────┬───────────────────────────────────────┤
│      │  Chat Area                            │
│  S   │  ┌────────────────────────────────┐   │
│  i   │  │ Message (user)                 │   │
│  d   │  │ Message (assistant)            │   │
│  e   │  │ Widget (iframe sandbox)        │   │
│  b   │  │ Message (assistant + tool use) │   │
│  a   │  │ ...                            │   │
│  r   │  └────────────────────────────────┘   │
│      │                                       │
│  T   ├───────────────────────────────────────┤
│  h   │  Input Area                           │
│  r   │  ┌──────────────────────┐ ┌────────┐  │
│  e   │  │ Text input           │ │ Send   │  │
│  a   │  │ + File attachment    │ │        │  │
│  d   │  └──────────────────────┘ └────────┘  │
│  s   │  Model selector | Token count         │
├──────┴───────────────────────────────────────┤
│  Status Bar                                  │
└──────────────────────────────────────────────┘
```

### 1.3 主要コンポーネント

| コンポーネント | 説明 |
|:---------------|:-----|
| `ChatView` | メインのチャット画面 (メッセージ一覧 + 入力欄) |
| `Sidebar` | スレッド一覧、検索、ワークスペース切り替え |
| `MessageBubble` | 個別メッセージの描画 (テキスト, コード, 画像) |
| `WidgetRenderer` | AI 生成 HTML/JS の sandbox iframe 表示 |
| `ToolCallDisplay` | ツール実行の進捗表示 (Bash 出力、ファイル差分) |
| `SettingsModal` | 設定画面 (プロバイダー, スキル, プラグイン, メモリ) |
| `ThreadSearch` | 過去スレッドの全文検索 (FTS5) |
| `ProviderPanel` | AI プロバイダー管理 (キー設定, モデル選択) |
| `SkillsPanel` | スキル管理 (インストール, 有効化, 検索) |
| `MemoryPanel` | メモリ管理 (People, Vector Memory, 統計) |

---

## 2. WidgetRenderer (Generative UI)

### 2.1 概要

AI が `widgetRenderer` ツールを呼び出して生成した HTML/CSS/JS を、チャット画面内に安全に描画する。
ユーザーはウィジェット内のボタン操作で AI に逆操作 (send-prompt) を送れる。

### 2.2 セキュリティ (Sandbox)

```html
<iframe
  sandbox="allow-scripts allow-same-origin allow-popups"
  srcdoc="<AI生成HTML>"
  style="width: 100%; border: none;"
/>
```

- `allow-scripts`: JS 実行許可 (インタラクティブ UI 用)
- Node.js API / IPC は完全遮断 (Electron の nodeIntegration は iframe に不適用)
- ファイルシステムアクセス不可

### 2.3 双方向通信 (postMessage IPC)

#### Iframe → 親ウィンドウ

```javascript
// Widget 内のコード
window.parent.postMessage({
  type: 'widget-resize',
  height: document.body.scrollHeight
}, '*');

window.parent.postMessage({
  type: 'send-prompt',
  text: '承認しました。次のステップへ進んでください。'
}, '*');

window.parent.postMessage({
  type: 'open-link',
  url: 'https://example.com'
}, '*');
```

#### 親ウィンドウ (React) のイベントハンドラー

```typescript
const handleMessage = useCallback((e: MessageEvent) => {
  const d = e.data;
  if (!d || typeof d !== 'object') return;

  // 動的リサイズ
  if (d.type === 'widget-resize' && typeof d.height === 'number') {
    setHeight(Math.max(50, Math.min(d.height + 8, 4000)));
  }

  // 外部リンク
  if (d.type === 'open-link' && typeof d.url === 'string') {
    window.systemFile?.openExternal(d.url);
  }

  // チャットへのコールバック (革命的 UX)
  if (d.type === 'send-prompt' && typeof d.text === 'string' && d.text.trim()) {
    sendMessage?.(d.text.trim());
  }
}, [sendMessage]);
```

### 2.4 テーマ同期

AI が生成する HTML に、アプリのテーマカラー (CSS 変数) を自動注入:

```typescript
const themeCSS = `
  :root {
    --bg-primary: ${theme.bgPrimary};
    --text-primary: ${theme.textPrimary};
    --accent: ${theme.accent};
    /* ... */
  }
`;

// iframe の srcdoc に注入
const srcdoc = `
  <html>
  <head><style>${themeCSS}</style></head>
  <body>${aiGeneratedHTML}</body>
  </html>
`;
```

### 2.5 ストリーミングレンダリング

AI が HTML を生成中 (ストリーミング中) でも、途中の DOM を iframe に流し込みプレビュー表示:

```typescript
// isStreaming=true の間は更新を続ける
useEffect(() => {
  if (isStreaming && iframeRef.current) {
    iframeRef.current.srcdoc = currentHTML;
  }
}, [currentHTML, isStreaming]);
```

---

## 3. メッセージ表示の種類

| 種別 | 表示内容 |
|:-----|:---------|
| **テキスト** | Markdown レンダリング (コードハイライト付き) |
| **画像** | インライン画像表示 (生成画像、スクリーンショット) |
| **コードブロック** | シンタックスハイライト + コピーボタン |
| **ツール呼び出し** | ツール名 + 引数 + 実行結果の折りたたみ表示 |
| **ウィジェット** | WidgetRenderer による iframe 内 HTML/JS |
| **インフォグラフィック** | チャート (pieChart, barChart) / タイムライン / カード |
| **ファイル** | ダウンロード可能なファイルカード (PDF, Word, etc.) |
| **音声** | 再生可能なオーディオプレーヤー |

---

## 4. 設定画面 (Settings Modal)

### 4.1 タブ構成

| タブ | 内容 |
|:-----|:-----|
| **General** | テーマ, 言語, アップデート |
| **Providers** | AI プロバイダー追加/削除, API キー設定, モデル選択 |
| **Skills** | スキル一覧, インストール/削除, 有効化/無効化 |
| **Plugins** | プラグイン管理 |
| **Memory** | People 管理, Vector Memory 統計, メモリクリーンアップ |
| **MCP** | MCP サーバー接続管理 |

### 4.2 プロバイダー設定フロー

```
1. [+ Add Provider] ボタン
2. プロバイダー種別選択 (OpenAI / Anthropic / Ollama / Custom)
3. API キー入力
4. [Test Connection] で有効性確認
5. 利用可能モデルの自動フェッチ
6. デフォルトモデル選択
```

---

## 5. チャット入力の拡張機能

| 機能 | 説明 |
|:-----|:-----|
| **ファイル添付** | 画像, PDF, Word, Excel のドラッグ&ドロップ送信 |
| **音声入力** | マイクからの音声認識 |
| **モデル切り替え** | 入力欄横のセレクターでモデルを動的変更 |
| **トークンカウント** | 現在のコンテキスト消費量を表示 |
| **スレッド検索** | サイドバーからの FTS5 全文検索 |
