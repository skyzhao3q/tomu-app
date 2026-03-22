# Protan (Alma Clone) Full Monorepo Directory Structure

このドキュメントでは、プロタンを本格的なデスクトップAIエージェントとして開発するために必要な、**完全版のモノレポ（Monorepo）ディレクトリ構造テンプレート**を定義します。

ビルド済みバイナリ（`app.asar`）の中身やリソースディレクトリ（`Resources/`）、さらにスケーラブルなElectron/Reactアプリケーションの設計思想（Viewerの分離、Sharedパッケージ、Vendorバイナリの管理等）を完全に統合した、最も深く広い全体構造です。

---

## 🏗️ 1. モノレポ・ルート構造 (Root Structure)

プロジェクト全体は、`apps`（実行可能なアプリケーション）、`packages`（再利用可能なモジュール）、`resources`（非コードアセット）、`vendor`（外部バイナリ）の4つの柱で構成されます。

```text
protan-monorepo/
├── package.json               # モノレポルート設定 (Bun Workspaces)
├── bun.lockb                  # 依存関係ロックファイル
├── tsconfig.base.json         # ベースとなる TypeScript 設定
├── turbo.json                 # Turborepo などのビルドキャッシュ設定 (推奨)
│
├── apps/                      # 独立して実行・ビルドされるアプリケーション群
│   ├── desktop/               # Electron 外殻 (メインプロセス + プリロード)
│   ├── viewer/                # Reactフロントエンド (レンダラー SPA)
│   └── cli/                   # ターミナル用 CLI (bunx で実行)
│
├── packages/                  # 各アプリからインポートされる共通モジュール群
│   ├── core/                  # エージェント・プロンプト・DBなどのバックエンドロジック
│   ├── shared/                # 型定義、IPC通信のスキーマ
│   └── ui/                    # 共通 React コンポーネント (Design System)
│
├── resources/                 # アプリにバンドルされるアセットや設定ファイル
│   ├── bundled-skills/        # Markdownで書かれた初期搭載スキル群
│   ├── chrome-extension/      # Chrome Relay 用のブラウザ拡張機能
│   └── tts/                   # Python製のローカル音声合成スクリプト
│
└── vendor/                    # サードパーティのコンパイル済みバイナリ等
    ├── bun/                   # ローカル環境実行用の Bun バイナリ
    ├── uv/                    # Python パッケージマネージャ
    └── ripgrep/               # 超高速検索用の rg バイナリ
```

---

## 💻 2. Apps ディレクトリの詳細 (Applications)

### 2.1 `apps/desktop/` (Electron Shell & API Hub)
Electron のバックエンドとして機能し、ローカルAPIハブを立ち上げます。

```text
apps/desktop/
├── src/
│   ├── main/                  # Electron Main Process (Node.js)
│   │   ├── index.ts           # アプリ起動、Express APIサーバー (localhost:23001) の起動
│   │   ├── ipc.ts             # IPCハンドラー (Viewer との通信)
│   │   ├── server/            # Express ルーティング (/api/chat, /api/providers 等)
│   │   ├── proxy/             # LLM API へのプロキシ転送・ストリーミング処理
│   │   ├── window.ts          # BrowserWindow の管理・生成
│   │   └── auto-update.ts     # electron-updater 処理
│   └── preload/               # セキュリティのための Context Bridge
│       └── index.ts           # window.electronAPI の露出
├── electron-builder.yml       # DMG / EXE パッケージング設定
└── package.json
```

### 2.2 `apps/viewer/` (React Frontend SPA)
ユーザーが操作する UI 部分。Electronのレンダラーとして読み込まれますが、独立したViteプロジェクトとして開発します。

```text
apps/viewer/
├── src/
│   ├── main.tsx               # React DOM レンダリング・エントリー
│   ├── pages/                 # 各画面コンポーネント
│   │   ├── ChatPage.tsx       # メインチャット画面
│   │   └── SettingsPage.tsx   # グローバル設定モーダル
│   ├── components/            # UI機能ごとのパーツ
│   │   ├── chat/              # MessageList, ChatInput, ModelSelector
│   │   ├── artifact/          # ArtifactPanel, WidgetRenderer, DiffViewer
│   │   ├── sidebar/           # ThreadList, WorkspaceSelector
│   │   └── settings/          # MemorySettings, ProviderSettings 等の各タブ
│   ├── hooks/                 # カスタム React Hooks (例: useAgent, useThread)
│   ├── store/                 # Jotai による状態管理 (atoms)
│   ├── styles/                # Tailwind CSS / グローバルスタイル
│   └── i18n/                  # 多言語化ファイル (locales/en.json, ja.json)
├── index.html                 # アプリの骨組み
├── vite.config.ts             # フロントエンドのビルド設定
└── package.json
```

### 2.3 `apps/cli/` (Command Line Interface)
ターミナルから `protan` (または `alma`) コマンドを叩いた際の処理。

```text
apps/cli/
├── src/
│   ├── index.ts               # CLI のルーター (引数解析)
│   ├── api-client.ts          # http://localhost:23001 への Fetch ラッパー
│   └── commands/              # サブコマンドの実装
│       ├── chat.ts            # 履歴の表示等
│       ├── skill.ts           # npx skills / git clone によるスキル管理
│       └── config.ts          # 設定の読み書き
└── package.json
```

---

## 📦 3. Packages ディレクトリの詳細 (Shared Modules)

ビジネスロジックや型定義を `packages/` に抽出することで、`desktop`, `viewer`, `cli` の全てでコードを再利用（DRY）します。

### 3.1 `packages/core/` (Agent Engine)
システムの頭脳。Expressサーバーから呼び出されるロジック。

```text
packages/core/
├── src/
│   ├── agent/                 # Agentic Loop, Task (SubAgent) オーケストレーション
│   ├── memory/                # sqlite-vec ベクトル検索、RAG実装
│   ├── context/               # SOUL.md, USER.md, SKILL.md の動的プロンプト合成
│   ├── tools/                 # Native Tools (Bash, Read, Write, node-pty)
│   └── fatigue/               # 疲労度 (Fatigue)・感情ステートのシミュレーション
└── package.json
```

### 3.2 `packages/shared/` (Types & Constants)
プロセス間で共有する型や定数。

```text
packages/shared/
├── src/
│   ├── types/                 # Issue, Thread, Message, Provider などの TypeScript 型定義
│   ├── ipc-channels.ts        # IPC 通信のチャンネル名定数 (例: 'AGENT_RUN')
│   └── config-schema.ts       # Zod などを用いた設定ファイル (config.json) のスキーマ定義
└── package.json
```

### 3.3 `packages/ui/` (Design System)
チャット画面や設定画面で使われる、汎用的なUIコンポーネント。

```text
packages/ui/
├── src/
│   ├── components/            # Button, Input, Modal, Dropdown (Radix UI ベース)
│   ├── theme.ts               # CSS 変数マッピング (Light/Dark モード対応)
│   └── utils/                 # cn() などの Tailwind クラス結合ユーティリティ
└── package.json
```

---

## 4. 命名規則・実装のベストプラクティス

1. **Viewer の完全分離**:
   - `apps/viewer/` は完全に独立したWebアプリとして動くように作ります。これにより、Electron特有のバグに悩まされることなく、ブラウザ上でUIデザイン（Vite HMR）を高速に行うことができます。
2. **Vendor バイナリの同梱**:
   - `vendor/` に `node-pty` や `ripgrep`, `bun` を置くことで、ユーザーのPC環境に依存しない「ポータブル」なアプリケーションになります。
3. **Shared Packages の活用**:
   - `desktop`（APIサーバー）と `viewer`（フロントエンド）の間で JSON のやり取りをする際、`packages/shared` に型（Types）を置くことで、APIの変更時にフロントエンド側でも型エラーが出るようになり、堅牢な開発が可能です。
