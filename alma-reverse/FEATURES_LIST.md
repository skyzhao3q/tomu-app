# Alma (Protan) 完全機能一覧表

このドキュメントでは、アプリ「Alma（Protan）」のバイナリおよびソースコードの解析から判明した、全機能（フロントエンド、バックエンド、エージェント機能）をカテゴライズして一覧表にまとめました。

---

## 1. 🤖 自律型 AI エージェント機能 (Core Agent Features)

Almaの最大の強みである、ただのチャットボットを超えた「自律的・能動的な」機能群です。

| 機能名 | 説明 | 関連技術 / スキル |
| :--- | :--- | :--- |
| **Multi-Agent (Task委譲)** | 重いタスク（コーディング等）をバックグラウンドの「サブエージェント（coder, plan等）」に委譲し、並行作業を行う。 | `Task` ツール, `TaskOutput` |
| **Terminal Automation** | バックグラウンドで隠しターミナル（Bash）を維持し、コマンド実行や環境変数の保持、ストリーミング出力を対話的に行う。 | `node-pty`, `Bash` ツール |
| **Fatigue (疲労度) システム** | ユーザーと話すたびにエージェントの「疲労度」が蓄積し、返答のテンションが変化したり、睡眠（\`alma sleep\`）をとったりする人間らしいシミュレーション。 | `fatigueService.js`, `alma emotion` |
| **File System Manipulation** | ユーザーのPC内のファイルを検索、読み取り、作成、置換（sed的動作）する。 | `Read`, `Write`, `Edit`, `Glob`, `Grep` |
| **Self-Evolution (自己進化)** | 未知のタスクに直面した際、解決策をスクリプトや新しい Markdown（SKILL.md）として保存し、次回から使えるようにする。 | `skill-search`, `skill-hub` |

## 2. 🧠 記憶とコンテキスト管理 (Memory & Identity)

AIのハルシネーション（幻覚）を防ぎ、一貫した人格と関係性を築くための機能群です。

| 機能名 | 説明 | 関連技術 / ファイル |
| :--- | :--- | :--- |
| **Dual Memory Architecture** | 「確実な事実（プロファイル）」と「曖昧な会話履歴（ベクトル）」を物理ファイルとデータベースで分けて管理する設計。 | `SOUL.md`, `USER.md`, `sqlite-vec` |
| **Semantic RAG (ベクトル検索)** | 過去の膨大な雑談や出来事から、現在の会話に近い「意味（ベクトル）」を持つ記憶を自動で抽出しプロンプトに注入する。 | `sqlite-vec` (1536次元), `memory_embeddings` |
| **People Profiles** | チャット相手の「年齢・趣味・SNSのID」など、絶対に間違えてはいけない個人情報を独立したMarkdownファイルとして永続化する。 | `~/.config/alma/people/<name>.md` |
| **Daily Notes & Long-term** | その日の出来事（今日・昨日）や長期的に重要な文脈をファイルに書き出し、毎回のプロンプトに必ず含める。 | `MEMORY.md`, `memory/YYYY-MM-DD.md` |

## 3. 💬 チャット・コミュニケーション (Chat & UI)

React と Vite で構築されたフロントエンド（UI）が提供する、リッチな会話体験機能です。

| 機能名 | 説明 | 関連技術 / スキル |
| :--- | :--- | :--- |
| **Local API Proxy** | ユーザーの画面から直接OpenAI等のAPIを叩くのではなく、ローカルのNode.jsサーバーをプロキシとして経由し、セキュリティと文脈注入を担保する。 | Express.js, `POST /proxy/...` |
| **Interactive Widgets** | AIがチャット画面内に「円グラフ」や「インタラクティブなHTML/SVGウィジェット」を直接レンダリングし、視覚的に説明する。 | `widgetRenderer`, `pieChart`, `barChart` |
| **Infographic Rendering** | 複雑なプロセスや階層構造を、美しい図解（タイムライン、組織図、カード等）に変換して表示する。 | `infographic` ツール |
| **Thread Management** | プロジェクトや話題ごとにコンテキスト（スレッド）を分離・保存し、過去のスレッドを検索・再開できる。 | `thread-management`, `.alma-snapshots/history.json` |
| **Multi-Provider Support** | OpenAI, Anthropic, Gemini, OpenRouter, Ollama (ローカルモデル) など、複数のLLMを切り替えて使用できる。 | `alma providers` CLI |

## 4. 🌐 外部連携・ブラウザ操作 (Browser & External Integration)

AlmaがPCの枠を飛び越え、Webブラウザや他のアプリと連携するための機能群です。

| 機能名 | 説明 | 関連技術 / スキル |
| :--- | :--- | :--- |
| **Browser Automation** | AIが裏でヘッドレスブラウザを立ち上げ、Webサイトのクリックや文字入力、スクレイピングを自動で行う。 | Playwright, `BrowserOpen`, `BrowserClick` |
| **Chrome Relay** | ユーザーが実際に開いているChromeブラウザのタブを読み取ったり、スクロールしたり、フォームに入力したりする。 | `ChromeRelay...` ツール群 |
| **SNS & Chatbot Integration** | Telegram、DiscordなどのBotとして常駐し、外部プラットフォームからAlmaと会話・操作できる。 | `telegram`, `discord` スキル |
| **Web Fetch & Search** | JSレンダリングが必要なWebページの内容を取得してMarkdown化したり、Google等で最新情報を検索する。 | `WebSearch`, `WebFetch` |
| **Local TTS (音声合成)** | Pythonで書かれたローカルの音声合成エンジンを使い、Almaの言葉を音声ファイルにして送信する。 | `tts/` ディレクトリ, `voice` スキル |

## 5. 🛠️ 開発者・システム管理 (System & Utilities)

プログラマーやパワーユーザー向けの高度な自動化機能です。

| 機能名 | 説明 | 関連技術 / スキル |
| :--- | :--- | :--- |
| **CLI Control (`alma`)** | ターミナルから `alma` コマンドを叩くことで、設定の変更やチャット履歴の確認、プロバイダーの追加などが行える。 | Bun, `cli/alma` |
| **MCP (Model Context Protocol)** | 外部のMCPサーバー（データベースやAPIなど）と接続し、AIに新しいツール（コンテキスト）を動的に提供する。 | `@modelcontextprotocol/sdk` |
| **File & System Management** | PC内のファイル整理、リネーム、圧縮解凍、またメモリやディスク使用量の監視を行う。 | `file-manager`, `system-info` |
| **Cron & Scheduling** | バックグラウンドで `cron` のように定期的なタスクやリマインダーを実行する。 | `scheduler`, `tasks` スキル |
