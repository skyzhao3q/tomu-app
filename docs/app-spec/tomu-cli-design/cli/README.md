# Tomu CLI (Protan) 開発ガイド for Coding Agents

このディレクトリ (\`alma-prj/alma-src/cli/\`) には、AlmaのオリジナルCLI (\`alma\` コマンド) の難読化されたソースコードを**コマンド（機能）ごとに完全に分割・抽出した生データ**が格納されています。

AI（Coder Agent 等）が **「Tomu CLI (\`tomu\` コマンド)」** を一から開発・再構築する際、このディレクトリ内のソースコードをリファレンス（正解のロジック）として活用してください。

---

## 1. 📂 ディレクトリ構成と役割

| フォルダ/ファイル | 役割と活用方法 |
| :--- | :--- |
| **\`index.js\`** | CLI のエントリーポイント。引数のパース（\`process.argv.slice(2)\`）と、各コマンドへのルーティングの初期ロジックが書かれています。これを参考に、Commander.js や yargs 等を用いたモダンなCLIルーターを設計してください。 |
| **\`commands/*.js\`** | \`status\`, \`config\`, \`chat\`, \`skill\` など全45種類のサブコマンドの生の実行ブロックです。**「このコマンドはどういうAPIエンドポイントを叩いているか」「何のファイルを書き換えているか」の完全な答え**がここにあります。 |
| **\`utils/api.js\`** | ローカルAPI（Expressサーバー: \`http://localhost:23001\`）と通信するための \`fetch\` ラッパーです。CLIにビジネスロジックを持たせず、このラッパー経由でバックエンドに処理を委譲する Thin Wrapper パターンの実装例として使ってください。 |

---

## 2. 🤖 Coding Agent への指示（Prompting Guide）

AI（Coder Agent）に \`tomu\` CLI の特定のコマンド（例: \`tomu memory\`）を実装させる際は、以下のフォーマットでプロンプトを与えると最も正確でバグのないコードが生成されます。

### 📝 依頼プロンプトのテンプレート
```markdown
あなたは Tomu CLI を TypeScript で開発するエンジニアエージェントです。
今回は `tomu <command_name>` コマンドを実装してください。

実装にあたり、Almaのオリジナルコードである以下のファイルを `Read` ツールで読み込み、そこで行われている「API呼び出し」や「ファイル操作」のロジックを完全に移植（TypeScript化）してください。

- オリジナルロジック: `alma-prj/alma-src/cli/commands/<command_name>.js`
- 通信ユーティリティ: `alma-prj/alma-src/cli/utils/api.js` (参考用)

**【実装のルール】**
1. CLIコマンド自体に複雑な検索アルゴリズム等は持たせず、必ずローカルAPI（Express）を叩く Thin Wrapper として実装すること。
2. エラーハンドリング（APIサーバーが落ちている場合など）を適切に行い、`console.error` でユーザーにわかりやすく伝えること。
3. 出力はターミナルで読みやすいようにフォーマット（色付け等）すること。
```

---

## 3. 実装時の注意点 (Implementation Focus)

### 3.1 🌐 API 通信系コマンドの移植
- **例**: \`config.js\`, \`memory.js\`, \`threads.js\`, \`provider.js\`
- これらはUIと同じように、バックエンドの Express サーバー (\`localhost:23001\`) を \`fetch\` するだけです。抽出されたコードを見て、「どの URL パスに、どんな Method と Body でリクエストを送っているか」を正確に TypeScript で型定義して移植してください。

### 3.2 📂 ローカルファイル操作系コマンドの移植
- **例**: \`soul.js\`, \`user.js\`, \`travel.js\`
- これらはAPIを叩かず、CLI が直接 Node.js の \`fs\` モジュールを使って \`~/.config/tomu/\` 配下のファイル（Markdown や JSON）を読み書きしています。
- Coder Agent に移植させる際は、ファイルのパス解決 (`path.join(os.homedir(), '.config', 'tomu', ...)`) を正しく模倣させてください。

### 3.3 💻 OS・シェル実行系コマンドの移植
- **例**: \`selfie.js\`, \`skill.js\`
- これらは \`child_process.execSync\` や \`spawn\` を用いて、外部のPythonスクリプトや \`npx\` コマンドをバックグラウンドで実行しています。
- Coder Agent に移植させる際は、プロセスの実行結果（stdout/stderr）が正しくターミナルに表示されるよう、\`stdio: 'inherit'\` などのオプションを維持させてください。
