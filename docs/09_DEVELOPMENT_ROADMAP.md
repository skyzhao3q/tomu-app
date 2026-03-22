# tomu - 開発ロードマップ

Status: Draft v1
Date: 2026-03-22

---

## 設計原則

- **API ファースト**: バックエンドを先行し、API が安定してから UI を被せる
- **段階的構築**: 各フェーズのマイルストーンで動作検証可能な状態を保つ
- **最小限のスコープ**: 各フェーズでは必要最小限の機能のみ実装する

---

## Phase 1: 基礎インフラ (Local API Hub)

### 目標
curl/Postman から AI とチャットできる状態

### 実装内容
1. Express.js サーバー起動 (port 23001)
2. SQLite データベース初期化 (providers テーブル)
3. プロバイダー登録 API (`/api/providers` CRUD)
4. API キー暗号化・保存
5. LLM プロキシ (OpenAI `/v1/chat/completions` パススルー)
6. LLM プロキシ (Anthropic `/v1/messages` パススルー)
7. SSE ストリーミング対応

### 依存パッケージ
```
express, better-sqlite3, openai, @anthropic-ai/sdk
```

### 検証方法
```bash
curl -X POST http://localhost:23001/api/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "hello"}]}'
```

---

## Phase 2: エージェントの心臓部 (Context Synthesis)

### 目標
SOUL.md/USER.md の人格が反映された応答を返す

### 実装内容
1. `~/.config/tomu/` ディレクトリ構造の初期化
2. SOUL.md / USER.md ファイルの読み込み
3. Base Instructions (ハードコード)
4. Context Synthesizer の実装
5. 言語自動追従ルールの適用
6. プロンプト合成パイプライン

### 検証方法
- 日本語で話しかけると日本語で返答する
- SOUL.md の性格が応答に反映される

---

## Phase 3: 手足の獲得 (Agentic Loop + Native Tools)

### 目標
ターミナルから指示 → AI が自律的にファイル操作

### 実装内容
1. Tool JSON Schema 定義 (Bash, Read, Write, Edit, Glob, Grep)
2. tool_calls のインターセプトループ (while 構文)
3. node-pty による Bash ツール実装
4. ファイル操作ツール (Read, Write, Edit)
5. 検索ツール (Glob, Grep - ripgrep)
6. タイムアウト制御 (SIGINT)
7. シークレットサニタイゼーション

### 依存パッケージ
```
node-pty, glob, (bundled ripgrep binary)
```

### 検証方法
```bash
# AI に「このディレクトリのファイル一覧を教えて」と指示
# → AI が Bash(ls -la) を自律的に実行して結果を返す
```

---

## Phase 4: 拡張性 (Skills + Sub-Agents)

### 目標
Skills による無限拡張 + バックグラウンドタスク

### 実装内容
1. Skills ローダー (SKILL.md パース: gray-matter)
2. Skill マッチングロジック (キーワード/セマンティック)
3. Skill 管理 API (`/api/skills` CRUD)
4. Task ツール実装 (サブエージェント起動)
5. TaskOutput ツール実装 (結果取得)
6. サブエージェント定義 (coder, Explore, Plan)
7. サブエージェント権限制御
8. バンドルスキルの初期セット作成

### 依存パッケージ
```
gray-matter
```

---

## Phase 5: 記憶の永続化 (Vector DB + RAG)

### 目標
過去の会話を文脈として自動活用

### 実装内容
1. sqlite-vec 拡張のセットアップ
2. memories + memory_embeddings テーブル
3. Embedding API 呼び出し (OpenAI text-embedding-3-small)
4. ベクトル類似度検索 (`/api/memories/search`)
5. Memory CRUD API
6. Hidden Prompt: 記憶自動抽出
7. Hidden Prompt: 記憶クリーンアップ
8. Hidden Prompt: スレッドタイトル自動生成
9. Daily Notes (MEMORY.md + YYYY-MM-DD.md) の自動読み込み
10. People Profiles 管理 API
11. FTS5 全文検索インデックス

### 依存パッケージ
```
sqlite-vec (native extension)
```

---

## Phase 6: フロントエンド (React + Electron)

### 目標
完全なデスクトップ AI エージェントアプリ

### 実装内容

#### 6a: React チャット UI
1. Vite + React プロジェクトセットアップ
2. jotai による状態管理
3. チャット画面 (SSE ストリーミング表示)
4. Markdown レンダリング (コードハイライト)
5. ツール実行表示 (折りたたみ)
6. サイドバー (スレッド一覧)
7. 入力欄 (テキスト + ファイル添付)
8. モデルセレクター

#### 6b: 設定・管理 UI
9. 設定モーダル (プロバイダー, スキル, プラグイン)
10. メモリ管理画面
11. People 管理画面
12. スレッド検索 (FTS5)
13. トークン使用量表示

#### 6c: WidgetRenderer (Generative UI)
14. Sandbox iframe ベースコンポーネント
15. postMessage IPC (widget-resize, send-prompt, open-link)
16. テーマ同期
17. ストリーミングレンダリング

#### 6d: Electron パッケージング
18. メインプロセス (Express サーバー統合)
19. プリロードスクリプト (IPC ブリッジ)
20. ビルド・パッケージング (esbuild)
21. 自動アップデート

### 依存パッケージ
```
react, react-dom, vite, tailwindcss, @radix-ui/*, jotai, swr,
i18next, react-i18next, electron, esbuild,
@sentry/electron, @sentry/react
```

---

## Phase 7: 外部連携 (オプション)

### 実装内容
1. Playwright ブラウザ自動化 (BrowserOpen, BrowserClick 等)
2. Chrome Relay (Chrome 拡張 + API)
3. WebFetch (Turndown による Markdown 変換)
4. WebSearch (検索エンジン API)
5. TTS (Python 音声合成)
6. Telegram Bot 連携
7. Discord Bot 連携
8. Plugin システム
9. MCP サーバー連携

---

## Phase 8: 追加機能 (オプション)

### 実装内容
1. 疲労度システム
2. スケジューラー (cron)
3. CLI コマンド (`tomu`)
4. infographic / chart ツール
5. Git コミットメッセージ自動生成
6. 自己進化 (Skill 自動作成)

---

## 依存関係図

```
Phase 1 (API Hub)
    ↓
Phase 2 (Context)
    ↓
Phase 3 (Agentic Loop) ← ここで「自律エージェントの心臓」完成
    ↓
Phase 4 (Skills + Tasks) ─────────────┐
    ↓                                  │
Phase 5 (Memory + RAG)                │
    ↓                                  │
Phase 6 (Frontend + Electron) ◀───────┘ (並行開発可)
    ↓
Phase 7 (外部連携) ← 独立して並行開発可
Phase 8 (追加機能) ← 独立して並行開発可
```

---

## 主要な npm パッケージ一覧

| パッケージ | 用途 |
|:-----------|:-----|
| `express` | ローカル API サーバー |
| `ws` | WebSocket |
| `better-sqlite3` | SQLite |
| `sqlite-vec` | ベクトル検索拡張 |
| `node-pty` | 疑似ターミナル |
| `openai` | OpenAI SDK |
| `@anthropic-ai/sdk` | Anthropic SDK |
| `@modelcontextprotocol/sdk` | MCP |
| `gray-matter` | YAML Frontmatter パース |
| `turndown` | HTML → Markdown 変換 |
| `playwright` | ブラウザ自動化 |
| `mammoth` | Word ファイルパース |
| `xlsx` | Excel ファイルパース |
| `react-pdf` | PDF パース |
| `electron` | デスクトップ外殻 |
| `esbuild` | バンドラー |
| `bun` | CLI ランタイム |
| `jotai` | React 状態管理 |
| `swr` | データフェッチ |
| `tailwindcss` | CSS フレームワーク |
| `@radix-ui/*` | UI コンポーネント |
| `i18next` | 国際化 |
| `@sentry/electron` | エラー追跡 |
