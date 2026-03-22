# tomu - コアエンジン設計書

Status: Draft v1
Date: 2026-03-22

---

## 1. エージェントループ (Agentic Loop)

### 1.1 処理フロー

```
POST /api/chat/completions
    │
    ▼
┌──────────────────────┐
│  Phase 1:            │
│  Context Assembly    │
│  (プロンプト合成)      │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐     ┌───────────────┐
│  Phase 2:            │────▶│ LLM Provider  │
│  Inference           │◀────│ (External API) │
│  (LLM 推論)          │     └───────────────┘
└──────────┬───────────┘
           │
     ┌─────┴─────┐
     │           │
  text?      tool_calls?
     │           │
     ▼           ▼
  Return    ┌──────────────────────┐
  to        │  Phase 3:            │
  Client    │  Tool Execution      │
            │  (ツール実行)         │
            └──────────┬───────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │  Phase 4:            │
            │  Resolution          │
            │  (結果追加 → Phase 2) │
            └──────────────────────┘
```

### 1.2 疑似コード

```typescript
async function runAgentLoop(
  messages: Message[],
  workspaceId: string
): Promise<string> {
  const systemPrompt = await buildSystemPrompt(
    messages[messages.length - 1],
    workspaceId
  );
  const tools = getNativeToolSchemas();

  while (true) {
    const response = await llmProvider.createCompletion({
      system: systemPrompt,
      messages,
      tools,
      stream: true // SSE ストリーミング
    });

    if (response.hasToolCalls()) {
      for (const call of response.toolCalls) {
        let result: string;

        switch (call.name) {
          case 'Bash':
            result = await executeBash(call.args.command, workspaceId);
            break;
          case 'Read':
            result = await readFile(call.args.file_path);
            break;
          case 'Write':
            result = await writeFile(call.args.file_path, call.args.content);
            break;
          case 'Task':
            result = await spawnSubAgent(call.args);
            break;
          case 'TaskOutput':
            result = await getTaskOutput(call.args.task_id, call.args.block);
            break;
          default:
            result = await executeGenericTool(call.name, call.args);
        }

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: sanitizeSecrets(result)
        });
      }
    } else {
      // 最終テキスト応答
      return response.text;
    }
  }
}
```

---

## 2. コンテキスト合成エンジン (Context Synthesizer)

### 2.1 合成パイプライン

```typescript
async function buildSystemPrompt(
  lastMessage: Message,
  workspaceId: string
): Promise<string> {
  // 1. ベース命令 (ハードコード)
  const basePrompt = loadBaseInstructions();

  // 2. Identity (物理ファイル)
  const soul = await readFile('~/.config/tomu/SOUL.md');
  const user = await readFile('~/.config/tomu/USER.md');

  // 3. 長期記憶
  const longTermMemory = await readFile('~/.config/tomu/MEMORY.md');
  const today = formatDate(new Date());
  const yesterday = formatDate(addDays(new Date(), -1));
  const dailyToday = await readFileSafe(`~/.config/tomu/memory/${today}.md`);
  const dailyYesterday = await readFileSafe(`~/.config/tomu/memory/${yesterday}.md`);

  // 4. RAG (ベクトル検索)
  const query = extractText(lastMessage);
  const ragResults = await vectorDB.search(query, { limit: 5 });

  // 5. Skills マッチング
  const matchedSkills = await skillManager.matchSkills(query);

  // 6. ツール定義
  const toolSchemas = getNativeToolSchemas();

  // 7. 合成
  return `
${basePrompt}

## Identity
${soul}

## User
${user}

## Long-term Memory
${longTermMemory}
${dailyToday ? `\n### Today (${today})\n${dailyToday}` : ''}
${dailyYesterday ? `\n### Yesterday (${yesterday})\n${dailyYesterday}` : ''}

## Background Context (RAG)
${ragResults.map(r => r.content).join('\n---\n')}

## Active Skills
${matchedSkills.map(s => s.instructions).join('\n---\n')}
  `.trim();
}
```

### 2.2 Skill マッチングロジック

ユーザー入力に関連するスキルだけを動的にプロンプトへ注入:

1. **キーワードマッチ**: スキルの `name` / `description` とユーザー入力を比較
2. **セマンティックマッチ** (オプション): ベクトル類似度による高度なマッチング
3. **手動トリガー**: ユーザーがスキル名を明示的に指定した場合は強制注入

---

## 3. ツール実行エンジン (Tool Execution)

### 3.1 Bash ツール (node-pty)

```typescript
class BashExecutor {
  private ptys: Map<string, IPty> = new Map();

  async execute(command: string, workspaceId: string, timeout = 120000): Promise<string> {
    let pty = this.ptys.get(workspaceId);
    if (!pty) {
      pty = spawn('bash', [], {
        cwd: getWorkspacePath(workspaceId),
        cols: 200,
        rows: 50
      });
      this.ptys.set(workspaceId, pty);
    }

    return new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => {
        pty.kill('SIGINT');  // タイムアウト時は強制停止
        resolve(output + '\n[TIMEOUT]');
      }, timeout);

      const handler = pty.onData((data) => {
        output += data;
        if (isCommandComplete(output)) {
          clearTimeout(timer);
          handler.dispose();
          resolve(output);
        }
      });

      pty.write(command + '\n');
    });
  }
}
```

### 3.2 ファイル操作ツール

```typescript
// Read: ファイル読み取り (行番号付き)
async function toolRead(args: { file_path: string; offset?: number; limit?: number }): Promise<string> {
  const content = await fs.readFile(args.file_path, 'utf-8');
  const lines = content.split('\n');
  const start = args.offset || 0;
  const end = args.limit ? start + args.limit : lines.length;
  return lines.slice(start, end)
    .map((line, i) => `${String(start + i + 1).padStart(6)}│${line}`)
    .join('\n');
}

// Write: ファイル書き込み
async function toolWrite(args: { file_path: string; content: string }): Promise<string> {
  await fs.writeFile(args.file_path, args.content, 'utf-8');
  return `File written: ${args.file_path}`;
}

// Edit: テキスト置換
async function toolEdit(args: { file_path: string; old_string: string; new_string: string }): Promise<string> {
  const content = await fs.readFile(args.file_path, 'utf-8');
  if (!content.includes(args.old_string)) {
    throw new Error('old_string not found in file');
  }
  const updated = content.replace(args.old_string, args.new_string);
  await fs.writeFile(args.file_path, updated, 'utf-8');
  return `File edited: ${args.file_path}`;
}

// Glob: パターン検索
async function toolGlob(args: { pattern: string; path?: string }): Promise<string> {
  const files = await glob(args.pattern, { cwd: args.path || process.cwd() });
  return files.join('\n');
}

// Grep: コンテンツ検索 (ripgrep)
async function toolGrep(args: { pattern: string; path?: string; type?: string }): Promise<string> {
  const rgArgs = ['--json', args.pattern];
  if (args.path) rgArgs.push(args.path);
  if (args.type) rgArgs.push('--type', args.type);
  const result = execSync(`rg ${rgArgs.join(' ')}`);
  return result.toString();
}
```

---

## 4. サブエージェント管理 (Task Orchestrator)

### 4.1 タスク起動

```typescript
const activeTasks: Map<string, TaskState> = new Map();

async function spawnSubAgent(args: {
  subagent_type: string;
  prompt: string;
  run_in_background?: boolean;
}): Promise<string> {
  const taskId = crypto.randomUUID();
  const agentDef = getSubAgentDefinition(args.subagent_type);

  activeTasks.set(taskId, {
    status: 'started',
    output: null,
    type: args.subagent_type
  });

  // バックグラウンドで非同期実行
  runSubAgentLoop(taskId, agentDef, args.prompt).catch(err => {
    activeTasks.get(taskId)!.status = 'failed';
    activeTasks.get(taskId)!.output = err.message;
  });

  return JSON.stringify({ status: 'started', task_id: taskId });
}
```

### 4.2 サブエージェント実行ループ

```typescript
async function runSubAgentLoop(
  taskId: string,
  agentDef: SubAgentDefinition,
  prompt: string
): Promise<void> {
  const messages: Message[] = [{ role: 'user', content: prompt }];
  const task = activeTasks.get(taskId)!;
  task.status = 'running';

  while (true) {
    const response = await llmProvider.createCompletion({
      system: agentDef.systemPrompt,
      messages,
      tools: agentDef.allowedTools.map(getToolSchema)
    });

    if (response.hasToolCalls()) {
      for (const call of response.toolCalls) {
        // サブエージェント権限内のツールのみ実行
        if (!agentDef.allowedTools.includes(call.name)) {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: `Error: Tool "${call.name}" is not allowed for this agent type.`
          });
          continue;
        }
        const result = await executeGenericTool(call.name, call.args);
        messages.push({ role: 'tool', tool_call_id: call.id, content: result });
      }
    } else {
      task.status = 'completed';
      task.output = response.text;
      return;
    }
  }
}
```

### 4.3 TaskOutput (結果取得)

```typescript
async function getTaskOutput(
  taskId: string,
  block: boolean = false
): Promise<string> {
  const task = activeTasks.get(taskId);
  if (!task) return JSON.stringify({ error: 'Task not found' });

  if (block && task.status === 'running') {
    // ブロッキング: 完了まで待機
    await waitForCompletion(taskId);
  }

  return JSON.stringify({
    status: task.status,
    output: task.output
  });
}
```

---

## 5. LLM プロキシレイヤー (Provider Adapter)

### 5.1 プロバイダーアダプターインターフェース

```typescript
interface LLMProvider {
  createCompletion(request: CompletionRequest): Promise<CompletionResponse>;
  streamCompletion(request: CompletionRequest): AsyncIterable<StreamChunk>;
  getModels(): Promise<Model[]>;
  testConnection(): Promise<boolean>;
}

interface CompletionRequest {
  system: string;
  messages: Message[];
  tools?: ToolSchema[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}
```

### 5.2 プロキシルーティング

```typescript
// プロバイダーの API 形式差を吸収
app.post('/proxy/:providerId/v1/messages', async (req, res) => {
  const provider = await getProvider(req.params.providerId);

  // 1. コンテキスト注入 (SOUL.md 等をシステムプロンプトに追加)
  const enrichedRequest = await enrichWithContext(req.body);

  // 2. プロバイダー別の API 呼び出し
  const adapter = getAdapter(provider.type);
  const response = await adapter.proxy(enrichedRequest, provider);

  // 3. ストリーミング応答の転送 (SSE)
  if (req.body.stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    for await (const chunk of response) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    res.end();
  } else {
    res.json(response);
  }
});
```

---

## 6. セキュリティ

### 6.1 シークレットサニタイゼーション

```typescript
function sanitizeSecrets(content: string): string {
  // API キーパターンの検出とリダクション
  return content
    .replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-***REDACTED***')
    .replace(/key-[a-zA-Z0-9]{20,}/g, 'key-***REDACTED***')
    .replace(/(?:password|secret|token)\s*[:=]\s*[^\s]+/gi, '$1=***REDACTED***');
}
```

### 6.2 ファイルシステム境界

```typescript
function validatePath(targetPath: string, workspacePath: string): boolean {
  const resolved = path.resolve(targetPath);
  // ワークスペースパス内、またはホームディレクトリ内のみ許可
  return resolved.startsWith(workspacePath) ||
         resolved.startsWith(os.homedir());
}
```

### 6.3 プロセスタイムアウト

- Bash ツール: デフォルト 120 秒でタイムアウト (SIGINT 送信)
- サブエージェント: 最大ループ回数の制限
- node-pty: サーバーライフサイクルにバインド (サーバー停止時に全プロセス終了)
