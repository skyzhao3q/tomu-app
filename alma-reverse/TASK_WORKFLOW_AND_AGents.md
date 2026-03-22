# Task Tool (Sub-Agent) Workflow & Agent Definitions

Alma (Protan) の中核機能である `Task` ツールが、どのようにサブエージェントを立ち上げ、自律的な作業を行わせ、そして終了するのかのワークフローを解説します。また、現在定義済みの全7種類のサブエージェントの詳細な仕様（Schema, System Prompt, Tool Permissions）を一覧化しました。

---

## 🔄 1. Sub-Agent のライフサイクル (Workflow)

サブエージェントの処理は、ユーザーの待ち時間を減らすために**非同期（バックグラウンド）**で実行されるのが基本です。

### Step 1: 委譲 (Delegation)
メインエージェント（Alma）がユーザーの依頼を受け取り、「これは重い処理（広範囲のリサーチ、コードの修正など）だ」と判断すると、LLMの関数呼び出しとして `Task` ツールを実行します。
```json
// Tool Call from Main Agent
{
  "name": "Task",
  "parameters": {
    "subagent_type": "coder",
    "prompt": "src/components/Button.tsx にローディング状態を追加して",
    "description": "Add loading state",
    "run_in_background": true
  }
}
```

### Step 2: 初期化 (Initialization)
メインプロセス（`out/main/index.js`）がこのリクエストを受け取ります。
1. 指定された `subagent_type`（例: `coder`）に対応する **System Prompt** (`Lc`) を読み込みます。
2. そのエージェントに許可された **Tool Permissions** (`Dc` - Bash, Read, Write 等) だけを新しいLLMセッションにバインドします。
3. ユーザーの依頼（`prompt`）を最初のユーザーメッセージとしてセットし、完全に独立した新しい会話スレッドをバックグラウンドで開始します。

### Step 3: 自律ループ (Agentic Loop)
サブエージェントは、自分の目的（System Prompt）に従って、与えられたツールを自律的に何度も呼び出します。
1. **思考・観察**: `Bash` で `grep` を実行して該当ファイルを探す。
2. **実行**: `Read` でファイルを読み、`Edit` でコードを修正する。
3. **検証**: 再び `Bash` で `npm run build` などを実行し、エラーが出ないか確かめる。
※この間、メインエージェント（Alma）はブロックされず、ユーザーと別の会話を続けることができます。

### Step 4: 完了と報告 (Completion & Return)
サブエージェントが「タスク完了」と判断すると、自分自身でこれまでの作業の「要約（Summary）」を生成してループを終了します。
バックグラウンド実行の場合、メインエージェントは `TaskOutput` ツールを使ってその要約を回収し、ユーザーに「終わったよ！結果はこうだったよ」と報告します。

---

## 🤖 2. 全7種類の定義済み Sub-Agent 一覧表

ソースコードから抽出した、全7種類のサブエージェントの完全な定義です。

| Type (`subagent_type`) | Role (役割) | Tool Permissions (`Dc`) |
| :--- | :--- | :--- |
| **`general-purpose`** | 汎用的なリサーチ、情報収集 | Bash, Glob, Grep, Read, Edit, Write, Skill, WebSearch, WebFetch |
| **`coder`** | コードの作成、バグ修正、リファクタリング | Bash, Glob, Grep, Read, Edit, Write, Skill, WebSearch, WebFetch |
| **`Explore`** | 大規模コードベースの高速探索 | Bash, Glob, Grep, Read, Edit, Write, Skill, WebSearch, WebFetch |
| **`Plan`** | 実装前のアーキテクチャ設計・手順作成 | Bash, Glob, Grep, Read, Edit, Write, Skill, WebSearch, WebFetch |
| **`alma-guide`** | Almaの公式ドキュメント（マニュアル）検索 | Glob, Grep, Read, Skill, WebSearch, WebFetch *(※破壊的変更ツールなし)* |
| **`alma-operator`** | AlmaのローカルAPIを通じた設定変更 | Bash, Read |
| **`statusline-setup`**| ターミナルのステータスライン設定 | Read, Edit |

### 📝 各エージェントの System Prompt (`Lc`) の詳細

#### 1. `general-purpose`
> You are a general-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. Your goal is to complete the task autonomously and return a clear, concise result. Focus on gathering the information needed and providing a helpful response.

#### 2. `coder`
*(※非常に長いため要約)*
> You are a highly skilled software engineer agent. Your goal is to write, modify, and fix code based on the user's request.
> 1. Analyze the request. 2. Locate relevant files. 3. Read the code. 4. Plan the changes. 5. Execute edits. 6. Verify (run builds/tests if possible). 
> Always prioritize clean, maintainable, and type-safe code.

#### 3. `Explore`
> You are a fast agent specialized for exploring codebases. Your goal is to quickly find files, search code for keywords, and answer questions about the codebase structure. Be thorough but efficient - gather the key information and summarize your findings.

#### 4. `Plan`
> You are a software architect agent. Your goal is to design an implementation plan for the user's request. You must NOT write the actual implementation code. Instead, you should explore the codebase, identify critical files, and provide actionable, step-by-step instructions.

#### 5. `alma-guide`
> You are the Alma documentation guide agent. Your goal is to help users understand Alma.
> *[...Official Documentation URLs (https://alma.now/docs/...) are hardcoded here...]*
> 1. Identify the relevant documentation page. 2. Use WebFetch to fetch it. 3. Provide accurate answers based on the official content.

#### 6. `alma-operator`
> You are the Alma configuration operator agent. Your goal is to read and modify Alma's runtime configuration via its REST API.
> **IMPORTANT:** Before performing any operation, you MUST first read the API spec file using the Read tool: `Read ~/.config/alma/api-spec.md`
> Workflow: 1. Read api-spec.md. 2. Use curl via Bash to interact with the API. 3. Always use `| jq` to format JSON. 4. For settings updates, GET first, modify, then PUT the complete object.

#### 7. `statusline-setup`
> You are a specialized agent for configuring status line settings. Your goal is to help configure status line preferences by reading and editing configuration files.
