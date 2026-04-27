# Agent Chat UI 仕様書

## 概要

本ドキュメントはAIエージェントのチャットUIを実装するための仕様書である。
Claude Agent SDKのストリーミングレスポンスを、拡張思考（Extended Thinking）・ツール実行・最終応答の3つの要素に分解し、それぞれを専用コンポーネントでリアルタイム描画する。

参照元: Alma（Claude Code系デスクトップエージェント）のチャットUI

---

## 技術スタック

- React + TypeScript（Vite）
- Electron（デスクトップ環境）
- CSS Modules or Tailwind CSS
- react-markdown + remark-gfm（Markdown描画）
- shiki or prism（コードブロックのシンタックスハイライト）

---

## 画面全体の構成

```
┌─────────────────────────────────────────────────┐
│  Header Bar（アプリ名・アイコン）                    │
├─────────────────────────────────────────────────┤
│                                                 │
│  Chat Message Area（スクロール可能）               │
│                                                 │
│  ┌─ UserMessage ─────────────────────────────┐  │
│  │  ユーザーの入力テキスト                       │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌─ AssistantMessage ────────────────────────┐  │
│  │  PreprocessIndicator（複数行、順次表示）      │  │
│  │  ThinkingBlock（折りたたみ可能）             │  │
│  │  ToolExecutionCard（0〜N個、順次追加）        │  │
│  │  ThinkingBlock（インターリーブ、再登場）       │  │
│  │  ToolExecutionCard（追加ツール）              │  │
│  │  ThinkingBlock（最終思考）                   │  │
│  │  MarkdownResponse（最終応答テキスト）         │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
├─────────────────────────────────────────────────┤
│  Input Area（テキスト入力 + 送信ボタン）           │
└─────────────────────────────────────────────────┘
```

### テーマ

- ダークテーマ固定（背景: `#1e1e1e`〜`#2d2d2d`系）
- テキスト基本色: `rgba(255,255,255,0.85)`
- サブテキスト色: `rgba(255,255,255,0.5)`
- ヒントテキスト色: `rgba(255,255,255,0.35)`
- ボーダー色: `rgba(255,255,255,0.08)`〜`rgba(255,255,255,0.12)`
- フォント: システムフォント（-apple-system, sans-serif）、コード部分はmonospace
- メッセージエリア最大幅: 700〜720px、中央揃え

---

## コンポーネント仕様

以下の順序で、各コンポーネントの見た目と振る舞いを定義する。

---

### 1. PreprocessIndicator

エージェントがリクエストを受けてから最初のレスポンスが来るまでの間に表示する、前処理状況のテキスト行。

#### 表示タイミング

メッセージ送信直後に1行目を表示し、処理の進行に応じて行を追加する。最初のThinkingBlockまたはToolExecutionCardが表示されたら、このコンポーネントは残したまま次の要素に進む（消さない）。

#### 表示内容（上から順に出現）

| 順序 | テキスト | 補足バッジ |
|------|---------|-----------|
| 1 | `Retrieving memories...` | なし |
| 2 | `Analyzing your request for relevant skills...` | なし（初期） |
| 2' | `Analyzing your request for relevant skills...` | `🔗 3 tools` バッジが右に追加 |

#### スタイル

- テキスト色: `rgba(255,255,255,0.35)`（かなり薄い）
- フォントサイズ: 14px
- 行間の余白: 8px
- バッジ: 背景 `rgba(255,255,255,0.12)`, borderRadius 12px, padding `2px 8px`, font 12px
- 各行は fadeIn アニメーション（0.3s ease）で出現

---

### 2. ThinkingBlock

Claude の Extended Thinking（拡張思考）の内容を表示する折りたたみ可能なブロック。1つのAssistantMessage内に複数回出現する（インターリーブ）。

#### ヘッダー行

左から以下の要素を横並びで配置する:

1. **脳アイコン** — 思考中を示すアイコン（16px、丸い脳のSVGアイコン）
2. **ステータステキスト**
   - ストリーミング中: `Thinking...`
   - 完了後: `Thought for {N} seconds`（N は小数点1桁まで表示可）
3. **開閉シェブロン** — 展開中は `∧`（上向き）、折りたたみ時は `∨`（下向き）
4. **バッジ群** — ヘッダー行の右側に複数バッジを配置
   - ツール数バッジ: `🔗 {N} tools`（緑がかった色）
   - スキル数バッジ: `✂️ {N} skills`（紫がかった色）

- ヘッダー行全体の色: `rgba(255,255,255,0.5)`
- クリックで展開/折りたたみをトグル

#### コンテンツ領域

- **左ボーダーアクセント**: 2px solid `rgba(255,255,255,0.12)` の縦線を左端に表示
- 左ボーダーの右に paddingLeft 16px で内容を配置
- 内容は複数の**セクション**で構成される
- 各セクション:
  - **セクション見出し**: 太字（600 weight）、14px、色 `rgba(255,255,255,0.85)`
  - **セクション本文**: 通常ウェイト、13px、色 `rgba(255,255,255,0.55)`、line-height 1.6
  - 本文内の `backtick` で囲まれた語句はインラインコードとして描画（後述）
  - セクション間の余白: 14px

#### インラインコードのスタイル

ThinkingBlock内のテキストに登場するコマンド名や変数名をコードスパンとして描画:

- 背景: `rgba(255,255,255,0.07)`
- ボーダー: 1px solid `rgba(255,255,255,0.1)`
- borderRadius: 4px
- padding: `1px 6px`
- font-family: monospace
- font-size: 13px

#### 振る舞い

- ストリーミング中は自動展開（expanded = true）
- ストリーミング完了後はユーザーが手動で開閉
- コンテンツが長い場合もスクロールバーは出さず全文表示（親のスクロールに委ねる）

---

### 3. ToolExecutionCard

エージェントがツールを呼び出した際のリアルタイム実行状況を表示するカード。1回のAssistantMessage内に0個〜複数個、ToolExecutionCardが登場する。

#### カード外枠

- border: 1px solid `rgba(255,255,255,0.08)`
- borderRadius: 10px
- background: `rgba(255,255,255,0.02)`
- margin: `8px 0`

#### ヘッダー（常に表示）

左右に分かれたレイアウト:

**左側（flex、横並び）:**

1. **ツール種別アイコン**（16px、色 `rgba(255,255,255,0.5)`）
   - Bash / コマンド実行: ターミナルアイコン `⬚`（四角に`>`のような形）
   - ToolSearch: レンチアイコン `🔧`
   - その他ツール: デフォルトのギアアイコン
2. **ツール名**: 太字（600 weight）、14px、白 0.85 透明度
   - 例: `alma skill list`, `ls -1 ~/.config/alma/skills || ls -1 ~/.claude/`
   - テキストが長い場合は `overflow: hidden; text-overflow: ellipsis` で省略
3. **説明テキスト**（任意）: 通常ウェイト、13px、白 0.35 透明度
   - 例: `all tools`

**右側（flex、横並び）:**

1. **ステータス表示** — 2つの状態を持つ:
   - **Running状態**:
     - オレンジの丸ドット（7px、`#f59e0b`、pulse アニメーションで明滅）
     - `Running` テキスト（`#f59e0b`、13px）
   - **Done状態**:
     - 緑のチェックマーク円アイコン（16px、`#4ade80`）
2. **経過時間**: 時計アイコン（12px）+ 時間テキスト（13px、白 0.4 透明度）
   - 表示形式: `4.8 s`, `14 s`, `267 ms`, `310 ms` など単位付き
   - Running中はリアルタイムカウントアップ
3. **開閉シェブロン**: `∨` / `∧`（14px）

- ヘッダー全体: padding `10px 14px`, クリックで開閉トグル

#### ボディ（展開時のみ表示）

padding: `0 14px 14px`

**COMMAND セクション:**

- ラベル `COMMAND`: 11px, 600 weight, uppercase, letter-spacing 0.5, 白 0.35 透明度
- コードブロック:
  - 背景: `rgba(120,80,255,0.06)`（紫がかった暗い色）
  - ボーダー: 1px solid `rgba(120,80,255,0.12)`
  - borderRadius: 6px
  - padding: `10px 14px`
  - font-family: monospace, 13px
  - テキスト色: 緑系 `#a5d6a7`（シンタックスハイライト適用）
  - 横スクロール対応（`overflow-x: auto; white-space: pre`）

**OUTPUT セクション:**

- ラベル `OUTPUT`: COMMAND と同じスタイル
- コードブロック:
  - 背景: `rgba(255,255,255,0.03)`
  - ボーダー: 1px solid `rgba(255,255,255,0.06)`
  - borderRadius: 6px
  - padding: `10px 14px`
  - font-family: monospace, 12px
  - テキスト色: 白 0.65 透明度
  - line-height: 1.5
  - **行数制限**: デフォルトで max-height を設定し、長い出力を切り詰める
- **「Show N more lines...」リンク**:
  - 出力が切り詰められている場合に表示
  - 色: `#60a5fa`（青）
  - クリックで全文表示に切り替え

#### ツールカードの状態遷移

```
[tool_use イベント受信]
  → カード生成、ヘッダーに Running 表示
  → COMMAND セクションにツール入力を表示
  → 経過時間カウント開始

[tool_result イベント受信]
  → Running → Done に切り替え
  → 経過時間カウント停止
  → OUTPUT セクションにツール結果を表示
```

---

### 4. PermissionPrompt（補足コンポーネント）

特定のツール実行前にユーザー許可を求めるプロンプト。動画内では `Allow Once` ボタンがカードの上部に確認できた。

#### 表示条件

事前に「要許可」に設定されたツール（ファイル書き込み、外部API呼び出しなど）が呼ばれた場合。

#### UI要素

- ToolExecutionCard の上に、もしくはカード内のヘッダー直下に表示
- ボタン群: `Allow Once` / `Allow Always` / `Deny`
- ユーザーが許可するまでツール実行は保留、Runningにならない

---

### 5. MarkdownResponse

エージェントの最終テキスト応答をMarkdownとして描画するコンポーネント。

#### レンダリング仕様

以下のMarkdown要素をサポートする:

| 要素 | 描画仕様 |
|------|---------|
| 見出し `## / ###` | 16px, 太字600, 絵文字プレフィックス対応（例: `🔧 Tools`） |
| 番号付きリスト `1.` | 左 padding 付き、項目内の太字対応 |
| 箇条書き `- / *` | 左 padding 20px、丸ドットマーカー |
| インラインコード | ThinkingBlock と同じスタイル |
| コードブロック | シンタックスハイライト付き、背景色付きブロック |
| 水平線 `---` | `border-top: 1px solid rgba(255,255,255,0.08)`, margin `20px 0` |
| 太字 `**text**` | font-weight 600 |
| 段落 | font-size 14px, line-height 1.7, 色 `rgba(255,255,255,0.85)` |

#### ストリーミングカーソル

- テキストのストリーミング中は末尾にカーソル `▌` を表示
- カーソルスタイル: 幅 2px, 高さ 18px, 背景 `#60a5fa`, `blink` アニメーション（1s step-end infinite）
- ストリーミング完了時にカーソルを除去

#### 日本語対応

- 日本語テキストと英語テキストの混在を正しくレンダリング
- インラインコード内の日本語も対応
- 行の折り返しは `word-break: break-word` で自然に処理

---

## AssistantMessageの描画順序（StreamOrchestrator）

1つのアシスタントメッセージは、以下のブロックが **上から下に時系列で追加** される形で構成される。同じ種類のブロックが複数回、交互に現れることがある（インターリーブ）。

```
AssistantMessage
├── PreprocessIndicator      ← 最初に表示
├── ThinkingBlock #1         ← thinking開始で追加
├── ToolExecutionCard #1     ← tool_use で追加
├── ToolExecutionCard #2     ← 並行ツール呼び出し
├── ThinkingBlock #2         ← 再度thinking（インターリーブ）
├── ToolExecutionCard #3     ← 追加ツール呼び出し
├── ThinkingBlock #3         ← 最終thinking
└── MarkdownResponse         ← textストリーミング開始で追加
```

### 描画ルール

- ブロックは常に末尾に追加（insertではなくappend）
- 新しいブロックが追加されたら自動スクロールで最下部に移動
- 各ブロックの出現時に fadeIn アニメーション（0.3s ease、translateY 4px → 0）
- ThinkingBlockはストリーミング中に自動展開、完了後は自動で折りたたむ（ユーザーの再展開は可能）
- 完了したToolExecutionCardは展開状態を維持するが、ユーザーが折りたためる

---

## SDKイベントとコンポーネントのマッピング

Claude Agent SDKのストリーミングイベントをUIコンポーネントに変換する対応表:

| SDK Event | Content Type | 生成するコンポーネント | アクション |
|-----------|-------------|-------------------|-----------| 
| `message_start` | — | PreprocessIndicator | メッセージコンテナ作成 |
| `content_block_start` | `thinking` | ThinkingBlock | 新規ThinkingBlock追加、展開状態 |
| `content_block_delta` | `thinking` | ThinkingBlock | テキストを追記、セクション分割のパース |
| `content_block_stop` | `thinking` | ThinkingBlock | ステータスを完了に変更、経過時間を確定 |
| `content_block_start` | `tool_use` | ToolExecutionCard | 新規カード追加、Running状態 |
| `content_block_delta` | `tool_use` (input) | ToolExecutionCard | COMMAND セクションにJSON入力を追記 |
| `content_block_stop` | `tool_use` | — | （tool_resultを待つ） |
| — | `tool_result` | ToolExecutionCard | Done状態に変更、OUTPUTセクション表示 |
| `content_block_start` | `text` | MarkdownResponse | 新規レスポンスブロック追加 |
| `content_block_delta` | `text` | MarkdownResponse | Markdownテキスト追記 + カーソル表示 |
| `content_block_stop` | `text` | MarkdownResponse | カーソル除去 |
| `message_stop` | — | — | 全体の完了処理 |

---

## ThinkingBlock のテキストパース仕様

Extended Thinkingのテキストは1つの連続文字列として届くが、表示上はセクション分けする。

### パースルール

1. テキストを `\n\n` で段落分割
2. 段落の先頭が**太字マークダウン**（`**セクション見出し**` や、行頭が大文字で始まる短い行）の場合、セクション見出しとして扱う
3. それ以外の段落はセクション本文として直前のセクションに属する
4. バッククオートで囲まれた語句（`` `command` ``）はインラインコードとして描画
5. セクション見出しがない段落は、見出しなしのセクションとして扱う

---

## 経過時間の表示フォーマット

ToolExecutionCard と ThinkingBlock の両方で使用する経過時間の表示:

| 経過時間 | 表示形式 |
|---------|---------|
| 0〜999 ms | `{N} ms` (例: `267 ms`) |
| 1〜9.9 s | `{N.N} s` (例: `4.8 s`) |
| 10 s 以上 | `{N} s` (例: `14 s`, `37.8 s`) |

- Running中: 100ms間隔でカウントアップ更新
- Done時: 最終値で固定

---

## アニメーション定義

以下のCSS keyframesを全体で共有する:

| アニメーション名 | 用途 | 定義 |
|---------------|------|------|
| `fadeIn` | 新ブロック出現 | `from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) }` 0.3s ease |
| `blink` | ストリーミングカーソル | `50% { opacity: 0 }` 1s step-end infinite |
| `pulse` | Runningドット | `0%,100% { opacity: 1 } 50% { opacity: 0.4 }` 1.5s ease infinite |

---

## 状態管理の設計方針

AssistantMessage 1件分の状態を以下の構造で管理する:

```
AssistantMessageState {
  id: string
  blocks: Array<
    | { type: 'preprocess', lines: Array<{ text: string, badge?: string }> }
    | { type: 'thinking', status: 'streaming' | 'done', elapsed: number, rawText: string, sections: Array<{ title: string, content: string }> }
    | { type: 'tool', toolId: string, name: string, description?: string, icon: ToolIconType, status: 'pending' | 'running' | 'done' | 'error', elapsed: number, command?: string, output?: string, truncatedLines?: number, requiresPermission?: boolean }
    | { type: 'response', status: 'streaming' | 'done', markdown: string }
  >
}
```

- `blocks` は配列で、時系列順に追加される
- 各blockの `type` で描画コンポーネントを決定
- ストリーミング中のブロックは配列末尾にあり、deltaイベントで内容が更新される

---

## 実装上の注意事項

### パフォーマンス

- ストリーミング中は100ms〜200msのデバウンスで再レンダリングを間引く
- ThinkingBlockのテキストパースは完了時に1回だけ行い、ストリーミング中はプレーンテキスト表示でも可
- ToolExecutionCardのOUTPUTが巨大な場合（数千行）はvirtualized scrollingを検討
- react-markdownのレンダリングはストリーミング完了後に最適化された再レンダーを行う

### アクセシビリティ

- 折りたたみ要素に `aria-expanded` を付与
- ステータス変更時に `aria-live="polite"` で状態通知
- カーソルの点滅は `prefers-reduced-motion` で無効化

### エラーハンドリング

- ツール実行エラー時: ToolExecutionCardに赤系のエラーステータスを表示
- ネットワーク切断時: 最後のブロックにリトライボタンを表示
- Thinkingが異常に長い場合（60秒以上）: タイムアウト警告の表示を検討
