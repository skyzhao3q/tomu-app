# Alma (Protan) Tools & Skills Architecture

このドキュメントでは、エージェントが外界と通信するための「手足」となる **Native Tools** と、それを拡張する **Skills** の実装・アーキテクチャの違いについて解説します。

## 🛠️ 1. Native Tools (ネイティブ・ツール)
Native Tools は、アプリのメインプロセス (`out/main/index.js`) 内に直接ハードコードされている、Node.jsベースのコア機能です。
これらは LLM の `function_calling` (または `tool_use`) として直接スキーマが登録され、実行時にはメインプロセスがネイティブな権限で処理を行います。

### 主要な Native Tools
- **`Bash`**: `node-pty` を介してバックグラウンドのシェルを操作する。
- **`Read` / `Write` / `Edit`**: `fs` モジュールを使ったセキュアなファイル操作。
- **`Task`**: 重いタスクやコーディングを並列処理するための「サブエージェント（Coder, Explore等）」を起動するツール。
- **`BrowserOpen` / `BrowserClick` / `BrowserEval`**: Playwright等を介してChromeや内蔵ブラウザを直接操作するツール。

## 🌟 2. Skills (スキル・システム)
Skills は、Alma 最大の発明とも言える**「動的プロンプト・インジェクション型」の拡張機能**です。
バックエンドのコードを一切書き換えることなく、テキストファイル(`SKILL.md`)を追加するだけで新しい能力をエージェントに学習させることができます。

### `SKILL.md` の構造
スキルディレクトリ (例: `bundled-skills/memory-management/SKILL.md`) は以下のような構造になっています：

```yaml
---
name: memory-management
description: Search and manage Alma's memory...
allowed-tools:
  - Bash
  - Read
---
```

```markdown
# Memory Management Skill
Alma has a built-in memory system with semantic search.
Use the `alma` CLI to interact with it:
  - `alma memory search <query>`
  - `alma memory add <content>`
```

### なぜこの設計なのか？ (The Philosophy)
1. **No-Code Extension**: ユーザーは TypeScript/Node.js を知らなくても、Markdown で「コマンドの使い方」を教えるだけで、エージェントに新しいツール（例えば独自のPythonスクリプトなど）を使わせることができます。
2. **Skill-First Architecture**: ユーザーからの入力があると、システムはまず `description` をベクトル検索し、最も適した `SKILL.md` をプロンプトに動的インジェクション（RAG）します。これにより、コンテキストウィンドウ（トークン制限）を圧迫せずに無限の機能を搭載できます。
3. **Chain of Actions**: スキル自体は「実行コード」を持たず、AIモデルに **「この機能を使うには `Bash` ツールを使ってこのコマンドを叩け」** と指示するだけのマニュアルです。これが驚くほど柔軟に機能します。

## 🔄 3. 実行フローの比較
- **Toolの実行**: AI `{"name": "Read", "file": "..."}` ➔ Node.js が実行 ➔ 結果を返す
- **Skillの実行**: ユーザーが質問 ➔ システムが `SKILL.md` をプロンプトに挿入 ➔ AIが読み方を理解 ➔ AIが `{"name": "Bash", "command": "alma memory search..."}` を生成 ➔ Node.js が実行
