# tomu - 依存パッケージ一覧

Status: Draft v1
Date: 2026-03-22
Source: alma v0.0.721 reverse engineering

---

## 1. コアフレームワーク & サーバー

| パッケージ | バージョン | 用途 |
|:-----------|:-----------|:-----|
| `electron` | ^7.4.0 | デスクトップ外殻 |
| `electron-updater` | ^6.6.2 | 自動アップデート |
| `express` | ^5.1.0 | ローカル API サーバー |
| `ws` | ^8.18.3 | WebSocket |

## 2. AI / LLM SDK

| パッケージ | バージョン | 用途 |
|:-----------|:-----------|:-----|
| `ai` | ^6.0.105 | Vercel AI SDK (統合レイヤー) |
| `@ai-sdk/anthropic` | ^3.0.50 | Anthropic アダプター |
| `@ai-sdk/openai` | ^3.0.37 | OpenAI アダプター |
| `@ai-sdk/google` | ^3.0.34 | Google Gemini アダプター |
| `@ai-sdk/azure` | ^3.0.38 | Azure OpenAI アダプター |
| `@ai-sdk/deepseek` | ^2.0.21 | DeepSeek アダプター |
| `@ai-sdk/openai-compatible` | ^2.0.31 | OpenAI 互換 (Ollama 等) |
| `openai` | ^6.25.0 | OpenAI SDK (直接) |
| `@anthropic-ai/sandbox-runtime` | ^0.0.30 | Anthropic サンドボックス |
| `@modelcontextprotocol/sdk` | ^1.24.3 | MCP プロトコル |

## 3. データベース & 検索

| パッケージ | バージョン | 用途 |
|:-----------|:-----------|:-----|
| `better-sqlite3` | ^12.2.0 | SQLite ドライバー |
| `sqlite-vec` | 0.1.7-alpha.2 | ベクトル検索拡張 |
| `drizzle-orm` | ^0.44.4 | ORM (型安全クエリ) |

## 4. ターミナル & システム

| パッケージ | バージョン | 用途 |
|:-----------|:-----------|:-----|
| `node-pty` | 1.1.0-beta43 | 疑似ターミナル |
| `node-gyp-build` | ^4.8.4 | ネイティブモジュールビルド |
| `fast-glob` | ^3.3.3 | ファイルパターン検索 |

## 5. ブラウザ自動化

| パッケージ | バージョン | 用途 |
|:-----------|:-----------|:-----|
| `playwright` | ^1.57.0 | ヘッドレスブラウザ |

## 6. UI フレームワーク (React)

| パッケージ | バージョン | 用途 |
|:-----------|:-----------|:-----|
| `@radix-ui/react-context-menu` | ^2.2.16 | コンテキストメニュー |
| `@tanstack/react-virtual` | ^3.13.12 | 仮想スクロール |
| `@uiw/react-codemirror` | ^4.25.4 | コードエディター |
| `emoji-picker-react` | ^4.16.1 | 絵文字ピッカー |
| `framer-motion` | ^12.23.26 | アニメーション |
| `react-markdown` | ^10.1.0 | Markdown レンダリング |
| `react-pdf` | ^10.2.0 | PDF 表示 |
| `sonner` | ^2.0.7 | トースト通知 |
| `react-tooltip` | ^5.30.0 | ツールチップ |
| `react-zoom-pan-pinch` | ^3.7.0 | 画像ズーム |

## 7. ファイルパーサー

| パッケージ | バージョン | 用途 |
|:-----------|:-----------|:-----|
| `gray-matter` | - | YAML Frontmatter パース |
| `mammoth` | ^1.11.0 | Word → HTML |
| `xlsx` | ^0.18.5 | Excel パース |
| `turndown` | - | HTML → Markdown |
| `@mozilla/readability` | ^0.6.0 | Web ページ簡略化 |
| `diff` | ^8.0.2 | テキスト差分 |
| `yaml` | ^2.8.2 | YAML パース |
| `zod` | ^4.3.5 | スキーマバリデーション |

## 8. AI / ML ユーティリティ

| パッケージ | バージョン | 用途 |
|:-----------|:-----------|:-----|
| `@huggingface/transformers` | ^3.8.1 | ローカル ML モデル |
| `@fugood/whisper.node` | ^1.0.11 | ローカル音声認識 |
| `jieba-wasm` | ^2.4.0 | 中国語形態素解析 |

## 9. ビジュアライゼーション

| パッケージ | バージョン | 用途 |
|:-----------|:-----------|:-----|
| `@antv/infographic` | ^0.2.6 | インフォグラフィック |
| `@codemirror/*` | ^6.x | コードエディター |

## 10. 外部連携

| パッケージ | バージョン | 用途 |
|:-----------|:-----------|:-----|
| `discord.js` | ^14.25.1 | Discord Bot |

## 11. ビルド & エラー追跡

| パッケージ | バージョン | 用途 |
|:-----------|:-----------|:-----|
| `esbuild` | ^0.27.2 | バンドラー |
| `@sentry/electron` | - | Electron エラー追跡 |
| `@sentry/react` | - | React エラー追跡 |

## 12. バンドルバイナリ (vendor/)

| バイナリ | 用途 |
|:---------|:-----|
| `bun` | CLI ランタイム, パッケージマネージャー |
| `ripgrep (rg)` | 高速ファイル内容検索 |
| `uv` | Python パッケージマネージャー |
