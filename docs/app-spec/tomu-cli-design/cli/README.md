# Tomu CLI 開発ガイド for Coding Agents

このドキュメントは、`apps/cli/src/` に実装済みの **tomu CLI (`tomu` コマンド)** の開発・拡張を行うためのガイドです。

---

## 1. ディレクトリ構成

```
apps/cli/
├── package.json        # bin: { "tomu": "./src/index.ts" }
└── src/
    ├── index.ts        # エントリーポイント (Commander.js ルーター)
    ├── api.ts          # fetch ラッパー (Local API サーバーとの通信)
    └── commands/       # 各コマンドの実装
        ├── config.ts
        ├── memory.ts
        ├── providers.ts
        ├── threads.ts
        └── ...
```

---

## 2. Coding Agent への指示（Prompting Guide）

新しいサブコマンドを実装させる際は、以下のフォーマットでプロンプトを与えてください。

### 依頼プロンプトのテンプレート

```markdown
あなたは Tomu CLI を TypeScript で開発するエンジニアエージェントです。
今回は `tomu <command_name>` コマンドを実装してください。

実装にあたり、以下のファイルを `Read` ツールで読み込んでください:

- 既存の類似コマンド: `apps/cli/src/commands/<similar_command>.ts`
- API ラッパー: `apps/cli/src/api.ts`
- API エンドポイント一覧: `docs/app-spec/07_CLI_AND_API.md`

**実装のルール:**
1. CLI に複雑なビジネスロジックを持たせず、必ずローカル API を叩く Thin Wrapper として実装すること。
2. エラーハンドリング（API サーバーが落ちている場合など）を適切に行い、ユーザーにわかりやすく伝えること。
3. 出力はターミナルで読みやすいようにフォーマットすること。
```

---

## 3. 実装パターン

### 3.1 API 通信系コマンド

`config`, `memory`, `threads`, `provider` など、バックエンドの Express サーバー (`localhost:33001`) を `fetch` するだけのコマンド。`src/api.ts` の `apiFetch` ラッパーを経由して実装する。

```typescript
// src/commands/memory.ts
import { apiFetch } from '../api.js';

export async function handleMemorySearch(query: string) {
  const results = await apiFetch('POST', '/memories/search', { query, limit: 5 });
  if (!results.length) { console.log('No memories found.'); return; }
  results.forEach((mem: any, i: number) => {
    console.log(`\n[${i + 1}] ${mem.content}`);
  });
}
```

### 3.2 ローカルファイル操作系コマンド

`soul`, `user` など、API を叩かずに `~/.config/tomu/` 配下のファイルを直接読み書きするコマンド。

```typescript
import path from 'path';
import os from 'os';

const configDir = path.join(os.homedir(), '.config', 'tomu');
const soulPath = path.join(configDir, 'SOUL.md');
```

### 3.3 外部プロセス呼び出し系コマンド

`skill install` など、OS コマンドをバックグラウンドで実行するコマンド。

```typescript
import { execSync } from 'child_process';

execSync(`git clone --depth 1 ${repoUrl} ${destDir}`, { stdio: 'inherit' });
```

---

## 4. API エンドポイント一覧

実装対象のエンドポイントは `docs/app-spec/07_CLI_AND_API.md` の Section 4 を参照してください。CLI コマンドと API の対応は Section 3 (CLI to API Mapping) に記載されています。

---

## 5. テスト方法

```bash
# ローカルサーバーが起動している状態で実行
pnpm --filter @tomu/cli exec tsx src/index.ts <command>

# 例
pnpm --filter @tomu/cli exec tsx src/index.ts status
pnpm --filter @tomu/cli exec tsx src/index.ts memory list
```
