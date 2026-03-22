# Task Tool (Sub-Agent) Mechanism & Customization

このドキュメントでは、Alma（Protan）の最も強力なネイティブツールである `Task` ツールの仕組みと、「独自のサブエージェントを作成できるか」について解説します。

## 1. Taskツールの機能と仕組み
`Task` ツールは、メインプロセス（Alma本体）から独立した新しいLLMセッション（サブエージェント）を起動するためのコア機能です。

**【仕組みのフロー】**
1. **呼び出し**: Alma本体がLLMの `tool_calls` として `Task({ subagent_type: "coder", prompt: "...", run_in_background: true })` を呼び出す。
2. **プロセスの分離**: メインプロセス（`out/main/index.js`）は、指定された `subagent_type` に紐づく専用の「システムプロンプト」と「許可ツールリスト」をロードし、裏で新しいLLMの推論ループ（Agentic Loop）を開始します。
3. **自律実行**: サブエージェントは自分に与えられた権限（例: Bash, Read, Write）だけを使って、指示されたタスクを自律的にこなします。
4. **結果の返却**: サブエージェントが完了すると、その最終的な要約（Output）がAlma本体のチャットコンテキストに返却されます（バックグラウンド実行の場合は `TaskOutput` ツールで結果を取得します）。

## 2. 独自のSubAgent（サブエージェント）は作成できるか？
結論から言うと、**現在のアーキテクチャでは、ユーザーが設定ファイルやUIから動的に新しい `Task` 用の SubAgent を追加することはできません。**

解析結果の通り、サブエージェントの定義はメインプロセス（`out/main/index.js`）に**完全にハードコード**されています。

**【ソースコード上のハードコード定義】**
- **`subagent_type` (Enum)**: `general-purpose`, `coder`, `Explore`, `Plan`, `alma-guide`, `alma-operator`, `statusline-setup` の7種類に固定されています。
- **`Dc` オブジェクト (Tool Permissions)**: 各エージェントが使えるツールの配列。（例: `coder` は Bash, Read, Write など全権限を持つが、`alma-guide` は Read と WebFetch のみ）
- **`Lc` オブジェクト (System Prompts)**: 各エージェントの人格や目的を定義したシステムプロンプト。

### 🛠️ Protan で新しい SubAgent を追加・開発するには？
もしあなたが「プロタン」を開発する際、オリジナルのサブエージェント（例: `designer` や `qa-tester`）を追加したい場合は、ソースコードレベルで以下の3つの実装が必要です。

1. **ツールの JSON Schema を更新**
   `Task` ツールのパラメータ定義にある `subagent_type` の `enum` 配列に `"qa-tester"` を追加。
2. **専用の System Prompt (`Lc`) を定義**
   コード内で `Lc["qa-tester"] = "You are an expert QA tester. Your job is to run tests..."` のようにプロンプトを記述。
3. **許可ツール (`Dc`) のマッピングを追加**
   `Dc["qa-tester"] = ["Bash", "Read", "WebFetch"]` のように、エージェントが暴走しないよう最小限の「手足」を割り当てる。

## 3. Skills と Task の設計上の違い
Almaはなぜ「Skills」と「Task」という2つの拡張機能を持っているのでしょうか？
Protanを設計する上でも、この**責務の分離**が極めて重要です。

- **🌟 Skills (動的マニュアル)**
  - **実行者**: Alma本体
  - **用途**: 単発のコマンド実行、API呼び出し、簡単なファイルの読み書き。
  - **メリット**: ユーザーがMarkdownを追加するだけで「無限に拡張」できる。
- **🤖 Task (Sub-Agent)**
  - **実行者**: バックグラウンドの独立したLLMプロセス
  - **用途**: 数千行のコードリーディング、バグ修正、長時間のWebリサーチなど、何度もツールを実行して試行錯誤する「重い思考ループ」。
  - **メリット**: Alma本体のチャット応答をブロックせず、専用のプロンプトと権限で安全に自律作業を行わせることができる。
