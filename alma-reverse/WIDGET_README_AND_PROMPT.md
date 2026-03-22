# `widgetReadme` Tool & UI Generation Prompts

Alma (Protan) がチャット画面に美しい HTML/SVG ウィジェットを生成する際、AIが参照するデザインガイドラインとプロンプトの仕組みについて解説します。

## 1. `widgetReadme` とは何か？
`widgetReadme` は、AIが `widgetRenderer` ツールを使って実際にコード（HTML/CSS/JS）を書く前に**必ず1回だけ呼び出すように設計されたツール**です。

### 📌 目的 (Purpose)
AIに何も教えずにHTMLを書かせると、「ダサい配色（原色の赤や青）」「時代遅れのレイアウト」を作ってしまいます。
`widgetReadme` は、AIに対して「このアプリ（Alma）で美しく見えるUIコンポーネントの作り方（CSSパターン、カラーパレット、余白のルール）」を教えるための**デザインガイドライン（CSS仕様書）を返すツール**です。

---

## 2. `widgetRenderer` ツールのシステムプロンプト (Schema)
抽出したソースコードから、`widgetRenderer` の `description`（AI向けの指示書）の全容が明らかになりました。

```text
description:
"Render an interactive HTML/SVG visualization in the chat.
IMPORTANT: Call widgetReadme once before your first widgetRenderer call to load design guidelines.

Use this tool when the user asks you to visualize, diagram, illustrate, or explain something visually.
Great for: algorithm visualizations, architecture diagrams, flowcharts, interactive simulations, math plots, data dashboards, step-by-step animations, and any visual explanation.

The HTML runs in a sandboxed iframe with theming support. Always prefer this over describing visuals in text."
```

### 🎨 HTML生成時にAIへ強制される CSS パターンとルール
AIが `html` パラメータを生成する際、以下の詳細な制約と使用可能なCSS変数が与えられています（これもソースコードから抽出されたプロンプトです）。

```text
"Self-contained HTML fragment (no DOCTYPE/html/head/body tags). Style inline or with <style>.
The widget renders inside the app with the SAME theme.
Use these CSS variables for seamless look:

[Colors]
var(--foreground), var(--background), var(--muted), var(--muted-foreground),
var(--primary), var(--primary-foreground), var(--secondary), var(--secondary-foreground),
var(--border), var(--card), var(--card-foreground), var(--destructive),
var(--accent), var(--input), var(--ring)

[Charts]
var(--chart-1) through var(--chart-5)

[Layout]
var(--radius) for border-radius
var(--font-sans), var(--font-mono)

[Pre-styled elements (すでにスタイルが当たっているタグ)]
button, input, select, textarea, table, code, pre, .card, .badge, .badge.primary, hr

[CDN libraries allowed]
cdnjs.cloudflare.com, esm.sh, cdn.jsdelivr.net, unpkg.com

[Behavior]
Scripts run ONLY after streaming completes, so interactive controls work correctly."
```

---

## 3. `widgetReadme` の呼び出しと「デザインモジュール」
`widgetReadme` を呼び出す際、AIは自分がこれから作りたいUIの「種類（モジュール）」を指定します。

**【モジュールの種類 (Modules)】**
- `art`: イラストやアートワーク用
- `mockup`: UIモックアップやワイヤーフレーム用
- `interactive`: ユーザーが操作できるシミュレーション用
- `chart`: チャートやグラフ描画用
- `diagram`: アーキテクチャ図やフローチャート用

このツールが呼ばれると、メインプロセスは要求されたモジュールに応じた詳細な **Design Philosophy（デザイン哲学）** や、具体的なCSSコンポーネント（例えば「カードの書き方」「ボタンの書き方」のコードスニペット）をAIに返却します。

## 4. Protan 開発への応用 (The Magic of UI Generation)
この設計が素晴らしいのは、**「フロントエンド側に大量のReactコンポーネントを事前に用意する必要がない」** という点です。

プロタンを作る際は、フロントエンドに Tailwind CSS や Shadcn UI のような基本のCSS変数を定義しておきます。
そして、AI側に「このアプリでは `var(--primary)` や `.card` クラスが使えるから、それでHTMLを組み立ててね」と教えるプロンプト（`widgetRenderer` の Schema）を用意するだけで、AIは勝手にフロントエンドのテーマに完璧に馴染んだ、美しいインタラクティブUIを無限に生成してくれます。
