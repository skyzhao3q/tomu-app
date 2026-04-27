# AI エージェントのために CLI でブラウザを操作する agent-browser

AI エージェントにより効果的にタスクを実行させるためには、適切なフィードバックループを構築することが重要です。特にフロントエンドの開発においては、ブラウザ上での動作確認が欠かせません。しかし AI エージェントは通常ブラウザを直接操作する能力を持っていないので、ツールを提供して AI エージェントがブラウザを操作できるようにする必要があります。

AI エージェントにブラウザを操作させるツールとして [Playwright MCP](https://github.com/microsoft/playwright-mcp) や [ChromeDevTools/chrome-devtools-mcp: Chrome DevTools for coding agents](https://github.com/ChromeDevTools/chrome-devtools-mcp) が主に知られています。しかし MCP ツールはツールの定義がコンテキストを多く消費してしまったり、ナビゲーションやクリック、フォーム入力など目的の結果を達成するまでの中間操作のコンテキストがすべて AI のコンテキストウィンドウに含まれてしまうという課題があります。

Vercel が開発した [agent-browser](https://github.com/vercel-labs/agent-browser) は CLI でブラウザを操作するツールであり、AI エージェントに使われることを目的に設計されています。agent-browser を使うと、AI エージェントは CLI コマンドを通じてブラウザを操作できるようになり、Playwright MCP と比較してコンテキスト消費を抑えつつブラウザ操作が可能になると言われています。

https://x.com/ctatedev/status/2010400005887082907

この記事では agent-browser のインストール方法、基本的な使い方について紹介します。

## agent-browser をインストール

agent-browser は npm パッケージとして提供されているため、npm を使ってインストールできます。

```bash
npm install -g agent-browser
```

agent-browser は内部で Playwright を使ってブラウザを操作します。そのため以下のコマンドで chromium ブラウザをインストールしておく必要があります。

```bash
agent-browser install
```

## agent-browser の基本的な使い方

agent-browser はコマンドラインから `agent-browser <コマンド>` の形式で使用します。まずは `open` コマンドを使ってブラウザで指定した URL を開いてみましょう。

```bash
agent-browser open https://azukiazusa.dev

✓ azukiazusaのテックブログ2
  https://azukiazusa.dev/
```

`open` コマンドを実行すると、Playwright がバックグラウンドで起動し、指定した URL を開きます。ブラウザのウィンドウは表示されませんが、内部的にはブラウザが操作されています。`close` コマンドを呼び出すまでターミナルのセッションで行われるすべてのブラウザ操作はこのブラウザインスタンスに対して行われます。

`snapshot` コマンドを使うと、現在のブラウザのアクセシビリティツリーを取得できます。アクセシビリティツリーはブラウザ上の要素の階層構造を表しており、要素の種類やテキスト内容、属性情報などが含まれます。アクセシビリティツリーはスクリーンショットを取得して画像の情報を読み取るよりも効率的にブラウザの状態を把握できるという利点があります。

```bash
agent-browser snapshot

- document:
  - banner:
    - link "azukiazusa.dev" [ref=e1]:
      - /url: /
    - navigation:
      - list:
        - listitem:
          - link "blog" [ref=e2]:
            - /url: /blog
        - listitem:
          - link "about" [ref=e3]:
            - /url: /about
        - listitem:
          - link "talks" [ref=e4]:
            - /url: /talks
        - listitem:
          - link "recap" [ref=e5]:
            - /url: /recap
  - main:
    - heading "Hey, I'm azukiazusa 👋" [ref=e11] [level=1]
    - paragraph: 週に1回 Web 開発に関する記事をお届けします。フロントエンドに関する分野の記事が中心です。
```

その他要素の取得・ボタンクリック・スクリーンショット取得・ページのテキスト取得など様々なコマンドが用意されています。

```bash
# 指定したセレクタの要素をクリック
agent-browser click @e2
# ページ全体のスクリーンショットを取得
agent-browser screenshot page.png
# 指定したセレクタの要素のテキストを取得
agent-browser get text @e1
# アクセシブルな方法で要素を取得してクリック
agent-browser find role link click --name "about"
# ブラウザを閉じる
agent-browser close
```

## AI エージェントからの利用

AI エージェントから agent-browser を利用するには、`agent-browser` コマンドの使用方法を教えるとよいでしょう。`AGENT.md` や `CLAUDE.md` といったドキュメントファイルを作成し、agent-browser のコマンド一覧や使用例を記載しておくと、AI エージェントが適切にコマンドを選択してブラウザを操作しやすくなります。

Claude Code を使用している場合には[エージェントスキル](https://code.claude.com/docs/ja/skills)機能を使って agent-browser のコマンドをスキルとして登録するのも良いでしょう。エージェントスキルは Claude Code に特定の操作方法を教えるマークダウンファイルです。`AGENT.md` や `CLAUDE.md` に記載した内容は常に AI のシステムプロンプトに含まれるのに対して、エージェントスキルは必要に応じて呼び出されるため、コンテキストウィンドウの節約に役立ちます。

エージェントスキルのためにテンプレートも用意されており、以下のコマンドで agent-browser 用のエージェントスキルを生成できます。

```bash
mkdir -p .claude/skills/agent-browser
curl -o .claude/skills/agent-browser/SKILL.md \
  https://raw.githubusercontent.com/vercel-labs/agent-browser/main/skills/agent-browser/SKILL.md
```

<details>
<summary>`SKILL.md` の内容</summary>

````markdown
---
name: agent-browser
description: Automates browser interactions for web testing, form filling, screenshots, and data extraction. Use when the user needs to navigate websites, interact with web pages, fill forms, take screenshots, test web applications, or extract information from web pages.
---

# Browser Automation with agent-browser

## Quick start

```bash
agent-browser open <url>        # Navigate to page
agent-browser snapshot -i       # Get interactive elements with refs
agent-browser click @e1         # Click element by ref
agent-browser fill @e2 "text"   # Fill input by ref
agent-browser close             # Close browser
```

## Core workflow

1. Navigate: `agent-browser open <url>`
2. Snapshot: `agent-browser snapshot -i` (returns elements with refs like `@e1`, `@e2`)
3. Interact using refs from the snapshot
4. Re-snapshot after navigation or significant DOM changes

## Commands

### Navigation

```bash
agent-browser open <url>      # Navigate to URL
agent-browser back            # Go back
agent-browser forward         # Go forward
agent-browser reload          # Reload page
agent-browser close           # Close browser
```

### Snapshot (page analysis)

```bash
agent-browser snapshot        # Full accessibility tree
agent-browser snapshot -i     # Interactive elements only (recommended)
agent-browser snapshot -c     # Compact output
agent-browser snapshot -d 3   # Limit depth to 3
```

### Interactions (use @refs from snapshot)

```bash
agent-browser click @e1           # Click
agent-browser dblclick @e1        # Double-click
agent-browser fill @e2 "text"     # Clear and type
agent-browser type @e2 "text"     # Type without clearing
agent-browser press Enter         # Press key
agent-browser press Control+a     # Key combination
agent-browser hover @e1           # Hover
agent-browser check @e1           # Check checkbox
agent-browser uncheck @e1         # Uncheck checkbox
agent-browser select @e1 "value"  # Select dropdown
agent-browser scroll down 500     # Scroll page
agent-browser scrollintoview @e1  # Scroll element into view
```

### Get information

```bash
agent-browser get text @e1        # Get element text
agent-browser get value @e1       # Get input value
agent-browser get title           # Get page title
agent-browser get url             # Get current URL
```

### Screenshots

```bash
agent-browser screenshot          # Screenshot to stdout
agent-browser screenshot path.png # Save to file
agent-browser screenshot --full   # Full page
```

### Wait

```bash
agent-browser wait @e1                     # Wait for element
agent-browser wait 2000                    # Wait milliseconds
agent-browser wait --text "Success"        # Wait for text
agent-browser wait --load networkidle      # Wait for network idle
```

### Semantic locators (alternative to refs)

```bash
agent-browser find role button click --name "Submit"
agent-browser find text "Sign In" click
agent-browser find label "Email" fill "user@test.com"
```

## Example: Form submission

```bash
agent-browser open https://example.com/form
agent-browser snapshot -i
# Output shows: textbox "Email" [ref=e1], textbox "Password" [ref=e2], button "Submit" [ref=e3]

agent-browser fill @e1 "user@example.com"
agent-browser fill @e2 "password123"
agent-browser click @e3
agent-browser wait --load networkidle
agent-browser snapshot -i  # Check result
```

## Example: Authentication with saved state

```bash
# Login once
agent-browser open https://app.example.com/login
agent-browser snapshot -i
agent-browser fill @e1 "username"
agent-browser fill @e2 "password"
agent-browser click @e3
agent-browser wait --url "**/dashboard"
agent-browser state save auth.json

# Later sessions: load saved state
agent-browser state load auth.json
agent-browser open https://app.example.com/dashboard
```

## Sessions (parallel browsers)

```bash
agent-browser --session test1 open site-a.com
agent-browser --session test2 open site-b.com
agent-browser session list
```

## JSON output (for parsing)

Add `--json` for machine-readable output:

```bash
agent-browser snapshot -i --json
agent-browser get text @e1 --json
```

## Debugging

```bash
agent-browser open example.com --headed  # Show browser window
agent-browser console                    # View console messages
agent-browser errors                     # View page errors
```
````

</details>

Claude Code から `agent-browser` コマンドを実行してもらうようにフロントエンドを開発してもらいましょう。`/agent-browser` コマンドで特定のスキルを使用してもらいつつ、タスクを行ってもらえます。

```bash
/agent-browser タスク/カラムの削除機能を実装してください

- カンバンボードのカラムに削除ボタンを追加
- 削除ボタンをクリックすると確認ダイアログを表示
- 確認ダイアログで「はい」を選択するとカラムを削除
- 削除後、カンバンボードを更新して反映

```

開発後の動作確認のために `agent-browser` を使ってブラウザ上での動作確認を行おうとしている様子が確認できます。

![](https://images.ctfassets.net/in6v9lxmm5c8/4JAoYyH6saX6lOZVleHaYg/0c7ce95643e3123cc2980787ede32771/%C3%A3__%C3%A3__%C3%A3_%C2%AA%C3%A3__%C3%A3__%C3%A3__%C3%A3__%C3%A3__%C3%A3___2026-01-12_16.14.48.png)

![](https://images.ctfassets.net/in6v9lxmm5c8/dBbgkNfNT2ACO5tiHnoJl/76c4add63c07ebe05281b14a3f012dbb/%C3%A3__%C3%A3__%C3%A3_%C2%AA%C3%A3__%C3%A3__%C3%A3__%C3%A3__%C3%A3__%C3%A3___2026-01-12_16.21.42.png)

比較用に Playwright MCP を使って同様のタスクを依頼してみましょう。

```bash
claude mcp add playwright npx @playwright/mcp@latest
```

```sh
タスク/カラムの削除機能を実装してください

- カンバンボードのカラムに削除ボタンを追加
- 削除ボタンをクリックすると確認ダイアログを表示
- 確認ダイアログで「はい」を選択するとカラムを削除
- 削除後、カンバンボードを更新して反映
- Playwright MCP を使ってブラウザ上で動作確認を行う
```

`agent-browser` では click などのアクションを実行した場合 `Done` とだけ返ってきますが、Playwright MCP ではアクションのたびに新たなページの状態が返却されるという違いがあります。そのためか `agent-browser` の場合には操作の都度 `snapshot` コマンドを呼び出してページの状態を把握して操作が増えているという印象がありました。

また `agent-browser` は要素のクリックによく失敗していたのに対して、Playwright MCP の方は比較的安定してクリック操作が成功していました。`agent-browser` は `Bash(agent-browser click @e8)` のように要素を指定してクリックするのに対して、Playwright MCP は `playwright - Click (MCP)(element: "キャンセルボタン", ref: "e120")` のようにセレクタを直接指定してクリックするため、要素の特定がより正確に行われている可能性があります。ただしこのあたりの精度の問題は `SKILL.md` の内容を改善することで向上する可能性もあります。

## まとめ

- agent-browser は CLI でブラウザを操作するためのツールであり、AI エージェントにブラウザ操作能力を提供するために設計されている
- agent-browser は Playwright MCP と比較してコンテキスト消費を抑えつつブラウザ操作が可能になると言われている
- AI エージェントに agent-browser を使ってもらうには、使用方法を記載したドキュメントやエージェントスキルを用意するとよい

## 参考

- [vercel-labs/agent-browser: Browser automation CLI for AI agents](https://github.com/vercel-labs/agent-browser)
  