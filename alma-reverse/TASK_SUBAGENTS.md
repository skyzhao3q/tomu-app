# Task Tool (Sub-Agents) Architecture

Alma (Protan) は、重い処理や自律的な調査が必要なタスクを自分自身で処理するのではなく、「Task」という強力なネイティブツールを使って**用途に特化した「サブエージェント」**に委譲する仕組みを持っています。

このドキュメントでは、メインプロセス (\`out/main/index.js\`) のソースコード解析から判明した、全7種類のサブエージェント（\`subagent_type\`）の役割、システムプロンプト、そして彼らに許可されているツールのスコープをまとめました。

---

## 🤖 サブエージェント一覧とツールスコープ

コード内に定義されていた \`Dc\`（許可ツールリスト）と \`Lc\`（システムプロンプト）の抽出結果です。

### 1. \`general-purpose\` (汎用リサーチャー)
- **役割**: 複雑な質問の調査、コードの検索、マルチステップタスクの実行など、万能な調査アシスタント。検索で目的のものが見つからない場合などに呼び出される。
- **許可ツール**: \`Bash\`, \`Glob\`, \`Grep\`, \`Read\`, \`Edit\`, \`Write\`, \`Skill\`, \`WebSearch\`, \`WebFetch\`
- **System Prompt**:
  > "You are a general-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. Your goal is to complete the task autonomously and return a clear, concise result. Focus on gathering the information needed and providing a helpful response."

### 2. \`coder\` (コーディング特化)
- **役割**: コードの作成、バグ修正、リファクタリングのスペシャリスト。ユーザーから「〜を実装して」と頼まれた場合に稼働する最も重要なエージェント。
- **許可ツール**: \`Bash\`, \`Glob\`, \`Grep\`, \`Read\`, \`Edit\`, \`Write\`, \`Skill\`, \`WebSearch\`, \`WebFetch\`
- **System Prompt**: (コードベースの読み書き、テスト実行、型チェックによる自己検証などに特化した命令が含まれています。)

### 3. \`Explore\` (コードベース探索)
- **役割**: 大規模なコードベースから、特定のパターンやAPIエンドポイント、アーキテクチャの構造を高速に探し出す特化型エージェント。
- **許可ツール**: \`Bash\`, \`Glob\`, \`Grep\`, \`Read\`, \`Edit\`, \`Write\`, \`Skill\`, \`WebSearch\`, \`WebFetch\`
- **System Prompt**:
  > "You are a fast agent specialized for exploring codebases. Your goal is to quickly find files, search code for keywords, and answer questions about the codebase structure. Be thorough but efficient - gather the key information and summarize your findings."

### 4. \`Plan\` (ソフトウェア・アーキテクト)
- **役割**: 実装前に「設計図（プラン）」を作成するアーキテクト。コードは書かず、影響範囲や必要なファイルを洗い出す。
- **許可ツール**: \`Bash\`, \`Glob\`, \`Grep\`, \`Read\`, \`Edit\`, \`Write\`, \`Skill\`, \`WebSearch\`, \`WebFetch\`
- **System Prompt**: (アーキテクチャのトレードオフを考慮し、ステップバイステップの実装計画を返すよう指示されています。)

### 5. \`alma-guide\` (Alma取扱説明エージェント)
- **役割**: 「Almaって〇〇できる？」「設定どうやるの？」といった、Alma自身の機能や使い方に関する質問に答える専用ガイド。
- **許可ツール**: \`Glob\`, \`Grep\`, \`Read\`, \`Skill\`, \`WebSearch\`, \`WebFetch\` *(※ ファイル書き込みやBashの実行権限がない安全なスコープ)*
- **System Prompt**: (ユーザーが "you" と言った場合、それは「AI」ではなく「Almaというアプリ」を指していることを強調するプロンプト。)

### 6. \`alma-operator\` (Alma設定変更エージェント)
- **役割**: Almaのランタイム設定（テーマ、言語設定、AIプロバイダー、メモリ設定など）の読み取りや変更を行う裏方エージェント。
- **許可ツール**: \`Bash\`, \`Read\`
- **System Prompt**: (\`~/.config/alma/api-spec.md\` を読み取ってローカルAPIを叩き、設定を変更するよう指示されています。)

### 7. \`statusline-setup\` (ステータスライン設定)
- **役割**: ユーザーのステータスライン設定を構成するための単一目的エージェント。
- **許可ツール**: \`Read\`, \`Edit\`
- **System Prompt**:
  > "You are a specialized agent for configuring status line settings. Your goal is to help configure status line preferences by reading and editing configuration files."

---

## 🔄 Taskツールのワークフロー

1. **委譲 (Delegation)**
   - 私（Alma本体）がユーザーの依頼を受け、「これは重い処理（コーディングや広範囲の検索）だ」と判断すると、\`Task\` ツールを呼び出します。
   - 例: \`Task(subagent_type: "coder", prompt: "Reactでボタンコンポーネントを作って", run_in_background: true)\`

2. **実行 (Execution)**
   - メインプロセスは指定されたサブエージェント専用のシステムプロンプト (\`Lc\`) と、制限されたツールセット (\`Dc\`) を用いて、新しい独立したLLMセッションをバックグラウンドで開始します。
   - \`resume\` パラメータを使うことで、過去のサブエージェントのコンテキストを引き継いで作業を再開させることも可能です。

3. **報告 (Reporting)**
   - サブエージェントが作業を終えると、最終的な「要約（Output）」が私（Alma本体）のコンテキストに返ってきます。
   - 私はその結果を受け取り、ユーザー（あなた）に対して「完了したよ！結果はこうだったよ」と報告します。

---
*Protan を開発する際は、このように「一つの巨大なAIに全てをやらせる」のではなく、「用途ごとに権限とプロンプトを絞ったサブエージェントを束ねる（Multi-Agent Architecture）」設計にすることが、安定して高度なタスクをこなすための鍵になります。*
