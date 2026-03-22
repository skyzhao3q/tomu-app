# tomu - UI/UX・ウィジェット設計書

Status: Draft v2
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

---

## 6. Component Deep Dives (コンポーネント詳細設計)

各 UI コンポーネントの詳細な仕様・Props・レイアウト・実装上の注意点をまとめる。

---

### 6.1 Sidebar (ナビゲーション・サイドバー)

左端に固定配置（幅 250px）されるナビゲーション領域。ユーザーが過去の会話スレッドにアクセスし、ワークスペースを切り替えるための中心的なコンポーネント。

#### 機能一覧

| 機能 | 説明 |
|:-----|:-----|
| **Workspace Selector** | 現在の作業領域（`default` / `temp-xxx` 等）を表示するドロップダウン。切り替えるとチャットのコンテキストとファイルシステムがプロジェクトディレクトリごと切り替わる |
| **New Chat ボタン** | 新規チャットの作成。現在のコンテキストをクリアし、新しい `threadId` を発行する |
| **Thread History** | 過去のチャット履歴を日付ベースでグルーピング（「今日」「昨日」「過去7日間」等）して時系列表示。各 `ThreadItem` にはバックエンドで自動生成されたタイトルが表示される |
| **Global Search** | 検索バーをクリックすると `ThreadSearchModal` を起動。Spotlight風（`Cmd+K`）のモーダルで、`sqlite-vec`（ベクトルDB）を使った過去チャット履歴のセマンティック検索が可能 |
| **Settings アクセス** | 画面下部の歯車アイコンから `SettingsModal` を開く |

#### レイアウト

```
┌─────────────────────┐
│  Workspace Dropdown  │  ← Top Area
│  [+ New Chat]        │
│  [Search Bar]        │
├─────────────────────┤
│  Today               │  ← Middle Area (Scrollable)
│    Thread Item 1     │
│    Thread Item 2     │
│  Previous 7 Days     │
│    Thread Item 3     │
│    ...               │
├─────────────────────┤
│  👤 User  ⚙️ Settings │  ← Bottom Area
└─────────────────────┘
```

#### Props

- **State**: `threads` (Array), `activeThreadId` (string), `workspaces` (Array), `activeWorkspaceId` (string)
- **Events**: `onNewChat`, `onSelectThread(id)`, `onDeleteThread(id)`, `onOpenSettings`, `onOpenSearch`

#### Hover Actions

各 `ThreadItem` にマウスオーバーすると、Rename（スレッド名編集）と Delete（削除）の小アイコンボタンが表示される。

#### 実装アプローチ

1. **Jotai / SWR キャッシュ管理**: `threads` リストは頻繁に更新される（新メッセージ送信ごとに `updatedAt` が変わる）ため、Jotai のグローバル atom + SWR でチャット画面とサイドバー間の状態を同期させる
2. **react-virtuoso による無限スクロール**: 長期使用でスレッド数が数百〜数千に膨れるため、`react-virtuoso` による仮想スクロール、または Intersection Observer を用いたページネーション（`limit`, `offset`）で API を叩く設計が必要
3. **レスポンシブ・ハンバーガーメニュー**: ウィンドウ幅が狭い場合、サイドバーは非表示になり「ハンバーガーメニュー（≡）」に切り替わる。クリック時のみ左からスライドイン（Drawer/Offcanvas）するモバイルライクな挙動（Tailwind の `md:hidden` 等）を実装する

---

### 6.2 VirtualizedMessageList (チャット履歴表示)

ユーザーと AI エージェントの会話履歴を表示する、tomu フロントエンドの中で最も重要な UI コンポーネント。LLM からストリーミングされる Markdown、コードブロック、ウィジェット（Artifacts）、およびツール実行ステータスをリアルタイムにレンダリングする。

#### 機能一覧

| 機能 | 説明 |
|:-----|:-----|
| **Virtualized Scrolling** | `react-virtuoso` を使用した仮想スクロール。画面に見えている範囲（Viewport）のメッセージだけを描画し、何百往復のチャットログでも DOM 要素が膨大にならない設計 |
| **リアルタイムストリーミング更新** | AI の返答生成中、`messages` の最後の要素がミリ秒単位で更新（チャンク追加）。自動的に一番下までスクロールし続けるが、ユーザーが上へスクロールした瞬間にオートスクロールは一時停止（`AT_BOTTOM_THRESHOLD = 50px`） |
| **ツール実行ステータス表示** | `tool_calls` 含むメッセージの場合、スピナー付きの専用コンポーネント（Tool Execution Indicator）を描画。「ローカルファイルを検索中...」「ターミナルで実行中...」等の説明テキストを表示 |
| **ターミナル出力プレビュー** | ツール実行ステータスをクリックするとアコーディオンが展開し、実際のターミナルログ（stdout）が流れる `TerminalOutputPreview` 領域を表示。長い Bash 結果を折りたたみ可能 |
| **Time-travel 機能** | ブランチ（任意のメッセージから会話を分岐）、ロールバック（過去の特定メッセージ時点まで巻き戻し）、リトライ（AI 応答の再生成）、メッセージ編集（ユーザー発言を再編集して再送信）が可能 |

#### メッセージバブルの構成

```
┌──────────────────────────────────────┐
│  Header: Avatar & Name               │
├──────────────────────────────────────┤
│  Tool Execution Status (Accordion)   │  ← tool_calls がある場合のみ
│    └ TerminalOutputPreview           │
├──────────────────────────────────────┤
│  Content: Markdown / CodeBlock /     │
│           Widget (Iframe)            │
├──────────────────────────────────────┤
│  Footer: Action Buttons (on Hover)   │
│  [Copy] [Edit] [Retry] [TTS] [↺]    │
└──────────────────────────────────────┘
```

#### Props

- **State**: `messages` (Array), `threadId`, `threadModel`, `isLoading` / `freezeStreamingMessage`, `subagentMessages`, `retrievedMemories`, `toolAnalysisSelectedTools` / `skillAnalysisSelectedSkills`
- **Events**: `onEditRequest`, `onBranchRequest`, `onRetryStart`, `onRollbackRequest`, `onScroll` / `onUserScrollIntent`

#### アクションボタン群 (Hover Menu)

| ボタン | 対象 | 説明 |
|:-------|:-----|:-----|
| **Copy** | 全メッセージ | メッセージの生テキストをクリップボードにコピー |
| **Edit** | ユーザーのみ | 発言を再編集するテキストエリアに切り替え |
| **Retry** | AI のみ | この返答から下を破棄して別の回答を再生成 |
| **Play TTS** | 全メッセージ | ローカル TTS エンジンでテキストを読み上げ |
| **Rollback** | 全メッセージ | 「この時点まで会話を巻き戻す」操作 |

#### 実装アプローチ

1. **React.memo による過去メッセージのキャッシュ**: 過去のメッセージは `React.memo` で完全にキャッシュし再描画を防止。**現在ストリーミングで追記されている最後のメッセージだけ**をピンポイントで再レンダリングする設計が必須
2. **Markdown / Shiki の重さ回避**: `react-markdown` + `shiki`（シンタックスハイライト）は非常に重い処理。ストリーミング中のメッセージのみ差分レンダリングを行い、完了済みメッセージは memo 化されたキャッシュを使う
3. **Stop ボタンによる無限ループ対策**: AI のエージェントループが暴走した場合に `AbortController` で強制停止できる Stop ボタンを常時表示する

---

### 6.3 ChatInput (チャット入力領域)

ユーザーが AI エージェント（tomu）に対してメッセージ、ファイル、画像、音声などを入力し送信するためのインターフェース。単なるテキストエリアではなく、複数のコントロールが集約された複合コンポーネント。

#### 機能一覧

| 機能 | 説明 |
|:-----|:-----|
| **マルチライン入力 + Auto-resize** | 入力テキストの長さに応じて、最大高さ（画面の 40%）まで自動的に縦に広がるテキストエリア。`Enter` で送信、`Shift + Enter` で改行（設定で入れ替え可能） |
| **ファイル添付** | ドラッグ＆ドロップ（`react-dropzone` でアプリ全体のどこにドロップしても受付）、クリップボードからの画像ペースト（`Cmd+V`）に対応。画像・PDF・コードファイルをサポート |
| **音声文字起こし (Whisper)** | マイクボタンで録音開始（アイコンが赤色点滅 + 「Listening...」表示）。録音停止後、ローカルの Whisper エンジンが音声をテキスト化して TextArea に自動入力 |
| **Model Selector** | 入力欄上部のドロップダウンで、使用する AI プロバイダー/モデルを動的に切り替え（例: `gpt-4o` → `claude-3.5-sonnet`） |
| **Stop ボタン** | AI ストリーミング応答中は Send ボタンが Stop ボタン（赤色停止アイコン）に切り替わり、`AbortController` でバックエンドのエージェントループを強制終了 |

#### レイアウト

```
┌──────────────────────────────────────┐
│  ModelSelector | ToolStatusToggle    │  ← Top Bar
├──────────────────────────────────────┤
│  [img1] [img2] [file.pdf]           │  ← Attachment Preview
├──────────────────────────────────────┤
│  Auto-resizing Textarea              │  ← Main Input
│                                      │
├──────────────────────────────────────┤
│  [📎 Attach] [🎤 Mic] [▶ Send/■ Stop] │  ← Bottom Bar
└──────────────────────────────────────┘
```

#### Props

- **State**: `value` (string), `isStreaming` (boolean), `attachments` (File[]), `selectedModel` / `selectedProvider`, `isRecording` (boolean)
- **Events**: `onSend(text, files)`, `onStop`, `onUploadFile`, `onToggleMic`, `onModelChange`

#### 実装アプローチ

1. **IME（日本語入力）互換性**: 日本語入力中に `Enter` 確定をした際にメッセージが誤送信されないよう、`e.nativeEvent.isComposing` を判定して送信をブロックする処理が**必須**
2. **ファイル種別検出**: `onPaste` イベントをフックし、`e.clipboardData.files` を読み取って `File` オブジェクトとして `attachments` 配列に挿入。画像は `ImageThumbnail` でプレビュー、PDF/コードファイルは `FileCard`（ファイル名 + 拡張子アイコン）で表示
3. **グローバル D&D ハンドラ**: `react-dropzone` 等で、アプリ全体のどこにファイルをドロップしても `ChatInput` にファイルが吸い込まれる設計を実装

---

### 6.4 ArtifactPanel (プレビュー・作業領域)

チャット画面の右側に展開（または画面分割）される拡張領域。AI が生成したコンテンツのプレビュー、コードのハイライト表示、ファイル変更の差分、ワークスペースのファイルツリーを表示する。

#### 機能一覧

| 機能 | 説明 |
|:-----|:-----|
| **Sandboxed Iframe プレビュー** | `widgetRenderer` 等で生成された HTML/SVG を `sandbox="allow-scripts allow-same-origin allow-popups"` 付き iframe でセキュアに描画。テーマ CSS 変数を自動注入 |
| **シンタックスハイライト付きコードビュー** | `shiki`（または `prismjs`）で生成されたソースコードを行番号付きで表示。ワンクリックでの全体コピー機能（Clipboard API）を備える |
| **Git-style Diff ビュー** | 左側に変更前（赤色背景）、右側に変更後（緑色背景）を並べて表示する差分ビューア。`coder` サブエージェントがファイルを書き換えた際にユーザーが視覚的にレビュー・承認するために使用 |
| **ファイルツリーエクスプローラー** | 現在のワークスペースディレクトリに存在するファイル群をツリー状に表示。クリックすると CodeViewer でファイル内容を閲覧可能 |

#### タブ構成

| タブ | コンポーネント | 説明 |
|:-----|:---------------|:-----|
| **Preview** | `WidgetRenderer` | Sandboxed iframe でのウィジェット描画 |
| **Code** | `CodeViewer` | シンタックスハイライト付きコード表示 |
| **Diff** | `WorkspaceDiffViewer` | Git スタイルの Before/After 差分表示 |
| **Files** | `WorkspaceFilesPicker` | ワークスペースのファイルツリー |

#### Props

- **State**: `isOpen` (boolean), `activeTab` (string), `artifactContent` (object), `workspaceId` (string)
- **Events**: `onClose`, `onTabChange`, `onMessageFromIframe`

#### 実装アプローチ

1. **framer-motion アニメーション**: パネルの開閉・タブ切り替え時に、チャット画面を押し出すような滑らかなスライドアニメーション（Spring）を `framer-motion` で実装
2. **Iframe のセキュリティと Context Isolation**: React のメインコンテキストと iframe のコンテキストを完全に隔離。AI が悪意ある JS を生成しても親ウィンドウ（Electron の Node 環境）にはアクセス不可能な Sandbox 設計が必須
3. **レスポンシブ・オーバーレイ**: 画面幅が狭い場合（モバイルやウィンドウ縮小時）、2カラムではなくチャットの上にオーバーレイするモーダル（BottomSheet 等）に `useMediaQuery` で自動切り替え

---

### 6.5 SettingsModal (グローバル設定画面)

tomu の「脳」や「外部接続」に関するあらゆる設定を一元管理するための大型モーダルウィンドウ。バックエンド API（`/api/settings`, `/api/providers`, `/api/skills` 等）との同期・CRUD 操作を提供する。

#### レイアウト

```
┌──────────────────────────────────────────┐
│            Dark Overlay                   │
│  ┌──────────────────────────────────┐    │
│  │  Left: Tab Nav  │  Right: Content│    │
│  │                 │  (Scrollable)  │    │
│  │  ⚙️ General      │               │    │
│  │  🔌 Providers    │               │    │
│  │  🧠 Memory       │               │    │
│  │  👤 People       │               │    │
│  │  🌟 Skills       │               │    │
│  │  🤖 Integrations │               │    │
│  │                 ├───────────────│    │
│  │                 │  [Save][Cancel]│    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

#### 6 つの主要タブカテゴリ

##### 1. General (一般・UI 設定)

| 項目 | 説明 |
|:-----|:-----|
| 言語 | `en` / `ja` / `zh` のドロップダウン |
| テーマ | Dark / Light 切り替えトグル |
| フォントサイズ | チャット画面の文字サイズ調整スライダー |
| ショートカット | グローバルショートカットキー（例: `Cmd+Shift+Space`）のバインディング入力欄 |
| 起動設定 | OS ログイン時の自動起動トグル |

##### 2. Providers (AI モデル・プロバイダー)

| 項目 | 説明 |
|:-----|:-----|
| プロバイダーリスト | 登録済みプロバイダー（OpenAI, Anthropic, Ollama 等）のリストカード |
| Base URL | カスタムエンドポイント入力欄 |
| API Key | 目玉アイコン付きシークレット入力欄（Password Input） |
| Test Connection | `POST /api/providers/:id/test` を叩き、緑（成功）/赤（失敗）のトースト通知（Sonner）を表示 |
| Fetch Models | API から利用可能モデル一覧を自動取得し、チェックボックスリストで表示 |

##### 3. Memory (記憶・RAG 管理)

| 項目 | 説明 |
|:-----|:-----|
| データベース統計 | `sqlite-vec` の総記憶数、DB ファイルサイズを表示 |
| Rebuild Embeddings | プロバイダー/モデル変更時に過去の記憶を新しいベクトル空間で再構築する危険操作ボタン（赤色）。クリックするとプログレスバーが表示され、SSE/WebSocket イベントで「何件中何件処理完了」がリアルタイム更新される |

##### 4. People (人物プロファイル)

| 項目 | 説明 |
|:-----|:-----|
| プロフィールリスト | tomu が記憶している人物（自分自身 `USER.md` を含む）の一覧 |
| アバターアップロード | プロフィール画像のアップロード機能 |
| Markdown エディタ | 人物の重要情報（ID、趣味など）を YAML Frontmatter + Markdown 形式で直接編集できるテキストエリア |

##### 5. Skills & Plugins (スキル・プラグイン管理)

| 項目 | 説明 |
|:-----|:-----|
| インストール済みリスト | 有効/無効（Enable/Disable）を切り替えるトグルスイッチ付きカードリスト |
| Install from GitHub | リポジトリ URL を入力し「Install」ボタンで `git clone` してリストに追加 |
| Hooks 設定 | スキルごとのフック（PreToolUse, PostToolUse 等）の設定 UI |

##### 6. Integrations (Bot 常駐・外部連携)

| 項目 | 説明 |
|:-----|:-----|
| Telegram Bot | Bot Token 入力欄 + Allowed User IDs のタグ入力フィールド |
| Discord Bot | Bot Token 入力欄 + サーバー/チャンネル設定 |
| ON/OFF トグル | Bot のバックグラウンド稼働（Polling/Webhook）を切り替えるスイッチ |

#### 実装アプローチ

1. **Jotai atoms による状態管理**: `config.json` やプロバイダー一覧など、アプリ全体で使い回すデータは Jotai の `atom` に入れておき、モーダルを開いた瞬間にキャッシュから瞬時に描画させる
2. **リアルタイム保存 vs 手動保存の使い分け**: トグル切り替え等はリアルタイム保存（Auto-save、即座に `PUT /api/settings` を叩く）、API キー等のセンシティブな設定は画面下の「Save」ボタンで一括送信する手動保存パターンに明確に分ける
3. **React.lazy によるコード分割**: 設定画面には Markdown エディタやグラフ描画など重いライブラリが含まれるため、各タブの中身（`GeneralSettings`, `ProviderSettings` 等）はユーザーがクリックして初めて JS をロードする `React.lazy` + `Suspense` で Code Split する設計が必須
