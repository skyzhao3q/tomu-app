# Module: File System Manipulation (FS Service)

## 1. 機能概要 (Overview)
File System Manipulation モジュールは、Alma (Protan) がユーザーのローカルディスクにあるファイルやディレクトリを安全かつ効率的に「読み・書き・検索・置換」するためのコアサービスです。
LLM が `Read`, `Write`, `Edit`, `Glob`, `Grep` といったネイティブツールを呼び出した際に、このモジュールがOSの `fs` API や外部バイナリ（`ripgrep`等）をフックして実際の処理を行います。

- **役割**:
  - `fs.promises` を用いたファイルの安全なCRUD操作。
  - 数万行ある巨大ファイルを読む際の「ページネーション（Truncation / Offset / Limit）」処理。
  - 正規表現を用いた「コードの局所的な置換（`Edit`）」の実装。
  - `fast-glob` や `ripgrep` を用いた「超高速なディレクトリ探索」の提供。
  - ワークスペース (`temp-xxx`) ディレクトリの隔離とスナップショットの管理。

## 2. 担当する機能要件と Tool Schemas (Functional Requirements)

### 📄 `Read` (ファイルの読み込み)
- **概要**: 指定されたパスのファイルを読み込み、文字列としてLLMに返します。
- **ハードル (Context Window の爆発)**: ログファイルや巨大なソースコードをそのまま読み込むと、LLMのトークン上限を一瞬で超過します。
- **実装 (Alma の解決策)**: 
  - `Read` ツールには `limit` (最大行数) と `offset` (開始行数) パラメータが実装されており、デフォルトで「最大2000行 または 50KB まで」という強制Truncate（切り捨て）が組み込まれています。
  - LLMが続きを読みたい場合は、`offset: 2001` でもう一度ツールを呼ばせる仕組みです。

### ✏️ `Write` / `Edit` (ファイルの作成・置換)
- **`Write`**: 指定されたパスにファイルを完全新規作成、または丸ごと上書きします（`fs.writeFileSync`）。
- **`Edit`**: （※最重要機能）既存ファイルの「特定の部分だけ」を書き換えるためのツール。
  - パラメータ: `file_path`, `old_string`, `new_string`, `replace_all`
  - AIに「ファイル全体を再生成させる」と時間がかかりすぎるため、**「置換したい元のコードブロック（数行）」と「新しいコードブロック」を完全一致または正規表現で探索し、その部分だけを入れ替える**という、高速かつ低コストなアプローチを採用しています。

### 🔍 `Glob` / `Grep` (ファイル検索)
- **`Glob`**: `src/**/*.ts` のようなパターンでディレクトリツリーを走査し、マッチする「ファイル名の一覧」を返します。
- **`Grep`**: Rust製の `ripgrep (rg)` バイナリを `child_process.spawn` して、数万のファイルの中から特定の文字列が含まれる「行とその前後のコンテキスト（`-A`, `-B`）」を瞬時に返します。

## 3. Workflow & DataFlow

```mermaid
sequenceDiagram
    participant LLM
    participant Agent as Agent Loop
    participant FS as File System Service
    participant OS as macOS (Disk)

    LLM-->>Agent: {"name": "Edit", "file_path": "src/App.tsx", "old_string": "const a = 1;", "new_string": "const a = 2;"}
    
    Agent->>FS: handleEdit(workspaceId, "src/App.tsx", "const a = 1;", "const a = 2;")
    
    FS->>OS: fs.readFileSync("src/App.tsx")
    OS-->>FS: Full File Content String
    
    FS->>FS: Replace "old_string" with "new_string"
    
    alt 成功 (Match found)
        FS->>OS: fs.writeFileSync("src/App.tsx", New Content)
        FS-->>Agent: "Successfully replaced 1 occurrence."
    else 失敗 (No Match)
        FS-->>Agent: "Error: old_string not found. Make sure you match the exact indentation."
    end
    
    Agent->>LLM: Append Tool Result to Context
```

## 4. Workspace Isolation (ワークスペースの隔離)
Alma (Protan) の安全設計の要として、AIのファイル操作は「Workspace (作業領域)」の概念によって厳密に管理されます。

- **`temp-xxx`**: チャットを始めるたびに発行される固有のフォルダ ID。AIが `Write` などで作成するファイルは、原則としてこの隔離されたディレクトリ内に保存されます。
- **Path Resolution**: `Read("index.ts")` と指定された場合、裏側では `path.resolve(workspacePath, "index.ts")` が呼ばれ、パス・トラバーサル（`../../../etc/passwd` など）を防ぐセキュリティ機構が必要です。

## 5. Protan 開発への実装アプローチ (Implementation Focus)

このモジュールを実装する際、LLM特有の「AIの不器用さ」をカバーするための工夫（Error Handling & Feedback）が極めて重要です。

### 🚧 1. `Edit` ツールの「完全一致」問題
AIはインデント（スペースの数）や改行コード（LF/CRLF）を間違えることが多く、`old_string` が実際のファイルの中身と完全に一致せず、置換エラーになることが頻発します。
- **解決策 (Self-Correction)**:
  エラーが起きた際、単に「エラーです」と返すのではなく、**「Error: `old_string` が見つかりません。現在のファイルの10行目〜20行目は以下の通りです。正確なインデントで再試行してください」**と、AIがミスに気づいて自己修復できるような親切なエラーメッセージを返すロジックが不可欠です。

### 💾 2. スナップショット (Rollback) 機構
AIが間違えて重要なコードを破壊してしまった時のために、`Write` や `Edit` が呼ばれる直前に `fs.copyFile` などを用いて、ワークスペース内に `.alma-snapshots/` という隠しバックアップを作成する設計（Gitのような差分管理）を必ず組み込んでください。
