# Tomu CLI Specification

Status: Draft v2
Date: 2026-05-01
Source of truth reviewed: `apps/cli/src`

## 1. 目的と概要 (Overview)
`tomu` CLI は、デスクトップ AI エージェント（tomu）をターミナルから直接操作するためのコマンドライン・インターフェースです。
GUI（Reactアプリ）を開かなくても、ターミナルからAIとチャットしたり、設定を変更したり、自律エージェントのタスクを管理したりできる強力なツールを提供します。

- **役割**:
  - バックエンドのローカル API サーバー (`TOMU_API_URL` または `http://localhost:33001`) に対する HTTP クライアント (Thin Wrapper)。
  - 設定ファイル (`SOUL.md`, `config.json`) の直接読み書き。
  - OSネイティブのシェルコマンドや Python スクリプト (`uvx` 等) をバックグラウンドで呼び出すフロントコントローラー。

## 2. 機能要件 (Functional Requirements)

### 2.1 必須コマンド群 (Core Commands)
1. **`tomu status`**
   - ローカルのAPIサーバーが立ち上がっているか（プロセスが生きているか）をPingで確認し、ポート番号や稼働時間を表示する。
2. **`tomu config <get|set|list>`**
   - アプリ全体の環境設定 (`config.json`) をターミナルからCRUD操作する。
3. **`tomu provider <add|list|delete>`**
   - AIプロバイダー（OpenAI, Anthropic 等）の API キーを安全に登録・削除し、利用可能なモデル一覧を取得する。
4. **`tomu chat <list|history>`**
   - 過去のチャットスレッドの一覧を表示し、特定のIDの会話ログ（Markdown形式）をターミナルに出力する。
5. **`tomu memory <search|add|stats>`**
   - ローカル SQLite ベースのメモリストアにアクセスし、過去の記憶を意味検索（Semantic Search）したり、新しい事実を手動で追加する。

### 2.2 拡張機能・運用コマンド (Extension Commands)
1. **`tomu skill <list|search|install|update|uninstall>`**
   - `npx` や `git clone` を裏で呼び出し、コミュニティのスキル（Markdown拡張）を `~/.config/tomu/skills/` にインストール・管理する。
2. **`tomu soul`** / **`tomu user`**
   - 設定ディレクトリ内の `SOUL.md` (AIの人格) や `USER.md` (ユーザー情報) を標準エディタ (Vim / Nano / VSCode) で直接開いて編集モードにする。

## 3. アーキテクチャと実装方法 (Implementation Architecture)

`tomu` CLI は、GoやRustなどのコンパイル言語を使わず、**Node.js + tsx + Commander.js** で実装し、デスクトップアプリのソースツリーに含める（モノレポ構成）。

### 3.1 ディレクトリ構造 (Monorepo Integration)
```text
tomu-app/
├── apps/
│   ├── cli/
│   │   ├── package.json      # bin: { "tomu": "./bin/tomu.js" }
│   │   ├── src/
│   │   │   ├── index.ts      # エントリーポイント (Commander.js)
│   │   │   ├── api.ts        # fetch ラッパー (Local API サーバーとの通信)
│   │   │   └── commands/     # 各コマンドの実装 (chat.ts, config.ts, skill.ts)
│   │   └── package.json      # bin: { "tomu": "./src/index.ts" }
```

### 3.2 コア実装のパターン (The Thin Wrapper Pattern)
CLIに複雑なビジネスロジックを持たせてはいけません。**「CLIはAPIを叩いて結果を `console.log` するだけ」**という設計（Thin Wrapper）を徹底します。

```typescript
// src/api.ts
const BASE_URL = process.env.TOMU_API_URL || 'http://localhost:33001';

export async function apiFetch(method: string, endpoint: string, body?: any) {
  try {
    const response = await fetch(`${BASE_URL}/api${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("❌ API Server is not running or unreachable.");
    process.exit(1);
  }
}
```

```typescript
// src/commands/memory.ts
import { apiFetch } from '../api';

export async function handleMemorySearch(query: string) {
  console.log(`🔍 Searching memory for: "${query}"...`);
  const results = await apiFetch('POST', '/api/memories/search', { query, limit: 5 });
  
  if (results.length === 0) {
    console.log("No memories found.");
    return;
  }
  
  results.forEach((mem, index) => {
    console.log(`\n[${index + 1}] ID: ${mem.id}`);
    console.log(`${mem.content}`);
  });
}
```

### 3.3 外部プロセスの呼び出しパターン (`execSync`)
`tomu skill install` などのコマンドは、APIを叩かずに直接OSのコマンドを同期実行します。
```typescript
import { execSync } from 'child_process';
import path from 'path';

export function installSkill(repoUrl: string) {
  const skillsDir = path.join(process.env.HOME || '~', '.config', 'tomu', 'skills');
  const repoName = repoUrl.split('/').pop().replace('.git', '');
  
  console.log(`📥 Installing skill from ${repoUrl}...`);
  try {
    execSync(`git clone --depth 1 ${repoUrl} ${path.join(skillsDir, repoName)}`, { stdio: 'inherit' });
    console.log("✅ Skill installed successfully.");
  } catch (e) {
    console.error("❌ Installation failed.");
  }
}
```

## 4. 検証方法 (Testing & Validation)

CLIのテストは、「引数のパース」「API呼び出しのモック」「ファイルシステム操作のモック」の3レイヤーで行います。

1. **Unit Testing (コマンドのパースとロジック)**:
   - `Vitest` または `Jest` を使用。
   - `process.argv` をモックして `tomu memory search "test"` という入力が正しく `handleMemorySearch` 関数にルーティングされるかをテストする。
2. **API Mocking (通信テスト)**:
   - `nock` または `msw` を用いて `http://localhost:33001` へのリクエストをモックし、CLIが正しく JSON を受け取って標準出力 (`stdout`) に整形して書き出すかを検証する。
3. **E2E Testing (CLI 結合テスト)**:
   - 実際にローカルにダミーの Express サーバーを立ち上げた状態で、`pnpm --filter @tomu/cli test` を実行し、各コマンドが期待するエンドポイントを呼び出すことを検証する。
