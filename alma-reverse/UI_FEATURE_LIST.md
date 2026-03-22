# Alma (Protan) ユーザー視点 UI 機能一覧

このドキュメントでは、アプリをリバースエンジニアリングして得られたReactコンポーネント（`/out/renderer/`）の構造に基づき、ユーザーの画面（UI）から見た機能一覧をスクリーン単位で解説します。

---

## 1. 🖥️ メイン画面 & サイドバー (Main Layout & Sidebar)
アプリを起動したときのベースとなる画面枠とナビゲーション機能です。

### 構成要素と処理概要
| UI要素名 (コンポーネント推測) | 種類 | 処理の概要・画面遷移 |
| :--- | :--- | :--- |
| **New Chat ボタン** | Button | 現在のコンテキストをクリアし、真っ新なチャットスレッド（`temp-xxx` ワークスペース）を新規作成する。 |
| **Workspace Selector** | Dropdown | 現在作業中のワークスペース（`default` や特定のプロジェクトフォルダ）を切り替える。コンテキストが完全に分離される。 |
| **Thread Search (検索バー)** | TextBox / Modal | 過去のチャット履歴を検索するモーダル（`ThreadSearchModal`）を展開する。バックエンドの `sqlite-vec`（ベクトル検索）と連動。 |
| **Thread List (履歴リスト)** | List Item | 過去の会話（`ThreadItem2`）が一覧表示される。クリックすると右側の Chat Area に該当スレッドの履歴がロードされる。 |
| **Settings (歯車アイコン)** | Button | アプリ全体の設定を行う**Global Settings Modal**をオーバーレイ表示する。 |

---

## 2. 💬 チャットインターフェース (Chat Area)
ユーザーがLLM（Alma）と直接対話するメインの領域です。

### 構成要素と処理概要
| UI要素名 (コンポーネント推測) | 種類 | 処理の概要・画面遷移 |
| :--- | :--- | :--- |
| **Thread Title** | Header Text | 現在の会話のタイトル。LLMが裏側で自動生成（`/api/chat/generate-title`）し、必要に応じてユーザーが手動編集できる。 |
| **Model & Provider Selector** | Dropdown | そのスレッドで使用するAIプロバイダー（OpenAI, Anthropic等）とモデル（gpt-4o, claude-3.5等）を動的に切り替える。 |
| **Chat Input (入力欄)** | TextArea | ユーザーがプロンプトを入力するメインエリア。複数行入力対応。 |
| **Attach (添付) ボタン** | Button | 画像、PDF、コードファイルなどをアップロードしてコンテキストに追加する。 |
| **Mic (音声入力) ボタン** | Button | ローカルのWhisper機能（`WhisperSettings` 関連）を使って、ユーザーの音声をテキストに文字起こしする。 |
| **Send / Stop ボタン** | Button | チャットを送信する。生成中は「Stop」に切り替わり、LLMのストリーミング出力を強制停止できる。 |
| **Message Card (吹き出し)** | UI Block | AIのMarkdown出力、コードブロック、テーブル、図解（Infographic）をリッチにレンダリングする。 |
| **Tool Execution Indicator** | Status UI | AIが裏で `Bash` や `WebSearch` などのツールを使用している際、「検索中...」「コマンド実行中」といったステータスをリアルタイム表示する。 |
| **Play TTS ボタン** | Action Icon | メッセージの横にあり、クリックするとローカルのPythonエンジンを利用してAIの返答を音声で読み上げる。 |
| **Fatigue / Emotion Indicator** | Status UI | Almaの現在の「疲労度」や「感情」のステータスを視覚的に表示する（元気、疲れている、睡眠中など）。 |

---

## 3. 🎨 Artifacts & Workspace パネル (プレビュー・作業領域)
コードのプレビューや、マルチタスク（Taskエージェント）の進行状況を確認するための拡張パネルです。

### 構成要素と処理概要
| UI要素名 (コンポーネント推測) | 種類 | 処理の概要・画面遷移 |
| :--- | :--- | :--- |
| **Artifact Toggle** | Button | チャット画面の右側（または分割画面）に Artifact Panel を展開・格納する。 |
| **Code / Preview Tabs** | Tab Menu | AIが生成したウィジェット（`widgetRenderer`）やグラフ（`pieChart`）の「ソースコード」と「実際の描画結果（HTML/SVG）」を切り替えて表示する。 |
| **Workspace Files Picker** | File Tree | 現在のワークスペース内に存在するファイルツリーを表示・選択できる。 |
| **Diff Viewer** | Split View | サブエージェント（`coder`）がコードを修正した際、変更前と変更後の差分（Diff）をハイライト表示する。 |

---

## 4. ⚙️ グローバル設定モーダル (Settings Modal)
アプリの「脳」や「拡張機能」を管理するための巨大な設定画面です。多岐にわたるタブが存在します。

### 主要なタブと構成要素
| タブ・カテゴリ名 | 設定要素・処理の概要 |
| :--- | :--- |
| **General / UI / Theme** | アプリの言語設定、起動時の挙動、ダーク/ライトテーマの切り替え、フォントサイズの変更。 |
| **Providers & Models** | 各AIプロバイダー（OpenAI, Anthropic, Gemini, OpenRouter, Ollama等）の APIキーを入力 し、利用可能な最新モデルのリストを取得（Fetch）する。 |
| **Memory & People** | `sqlite-vec` のベクトル検索設定や、ユーザー自身・他人の構造化プロファイル（名前、趣味、SNS IDなど）を管理する。 |
| **Skills & Plugins** | Markdownで書かれた「スキル」の管理や、MCP（Model Context Protocol）サーバーへの接続設定を行う。GitHub等からのスキル検索も可能。 |
| **Integrations (Bots)** | `TelegramSettings`, `DiscordSettings`, `FeishuSettings` などを通じてBotトークンを入力し、Almaを外部のチャットアプリに常駐させる設定。 |
| **Advanced (System)** | `ChromeRelaySettings`（現在開いているブラウザタブへの直接干渉設定）、WebSearchのエンジン選択、ローカルTTSモデルのダウンロード管理など。 |
| **Data & Usage** | チャット履歴のエクスポート/インポートや、APIの利用料金・トークン消費量の統計グラフ（`SimpleBarChart`）を表示する。 |
