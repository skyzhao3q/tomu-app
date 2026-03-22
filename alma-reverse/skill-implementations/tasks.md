# Skill Implementation: `tasks`

## 💻 正体: `alma` CLI サブコマンド (Node.js/Bun)
このスキルはターミナルで `alma tasks` を実行した際、メインのCLIスクリプト内の以下のロジックを呼び出します。

### Implementation of `alma tasks`
```javascript
if (cmd === 'tasks') {
        const fs = await import('fs');
        const pathMod = await import('path');
        const tasksFile = pathMod.default.join(_os.homedir(), '.config', 'alma', 'tasks.json');

        const loadTasks = () => {
            try {
                if (fs.existsSync(tasksFile)) return JSON.parse(fs.readFileSync(tasksFile, 'utf-8'));
            } catch {
                /* ignore */
            }
            return { tasks: [] };
        };
        const saveTasks = data => {
            const dir = pathMod.default.dirname(tasksFile);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(tasksFile, JSON.stringify(data, null, 2), 'utf-8');
        };
        const genId = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

        const subcmd = args[1];

        if (!subcmd || subcmd === 'list') {
            const data = loadTasks();
            const filter = args[2]; // 'all', 'active', 'done' (default: active)
            const tasks = data.tasks.filter(t => {
                if (filter === 'all') return true;
                if (filter === 'done') return t.status === 'done';
                return t.status !== 'done'; // default: active
            });
            if (tasks.length === 0) {
                console.log(filter === 'done' ? 'No completed tasks.' : 'No active tasks.');
            } else {
                for (const t of tasks) {
                    const stepInfo = t.steps?.length ? ` [${t.currentStep || 0}/${t.steps.length}]` : '';
                    const statusIcon = { pending: '⏳', in_progress: '🔄', done: '✅', blocked: '🚫' }[t.status] || '❓';
                    console.log(`${statusIcon} ${t.id} | ${t.title}${stepInfo} (${t.status})`);
                    if (t.steps?.length && t.status !== 'done') {
                        t.steps.forEach((s, i) => {
                            const marker = i < (t.currentStep || 0) ? '  ✓' : i === (t.currentStep || 0) ? '  →' : '   ';
                            console.log(`${marker} ${i + 1}. ${s}`);
                        });
                    }
                }
            }
            return;
        }

        if (subcmd === 'add') {
            const title = args.slice(2).join(' ');
            if (!title) {
                console.error('Usage: alma tasks add <title>');
                process.exit(1);
            }
            const data = loadTasks();
            const task = {
                id: genId(),
                title,
                status: 'pending',
                steps: [],
                currentStep: 0,
                threadId: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            data.tasks.push(task);
            saveTasks(data);
            console.log(`Created task: ${task.id} — ${title}`);
            return;
        }

        if (subcmd === 'update') {
            const taskId = args[2];
            if (!taskId) {
                console.error('Usage: alma tasks update <id> [--status <s>] [--step <n>] [--title <t>] [--steps "s1,s2,s3"] [--thread <id>]');
                process.exit(1);
            }
            const data = loadTasks();
            const task = data.tasks.find(t => t.id === taskId);
            if (!task) {
                console.error(`Task not found: ${taskId}`);
                process.exit(1);
            }
            for (let i = 3; i < args.length; i++) {
                if (args[i] === '--status' && args[i + 1]) {
                    task.status = args[++i];
                } else if (args[i] === '--step' && args[i + 1]) {
                    task.currentStep = parseInt(args[++i], 10);
                } else if (args[i] === '--title' && args[i + 1]) {
                    task.title = args[++i];
                } else if (args[i] === '--steps' && args[i + 1]) {
                    task.steps = args[++i].split(',').map(s => s.trim());
                } else if (args[i] === '--thread' && args[i + 1]) {
                    task.threadId = args[++i];
                }
            }
            task.updatedAt = new Date().toISOString();
            saveTasks(data);
            console.log(`Updated task: ${task.id} — ${task.title} (${task.status})`);
            return;
        }

        if (subcmd === 'show') {
            const taskId = args[2];
            if (!taskId) {
                console.error('Usage: alma tasks show <id>');
                process.exit(1);
            }
            const data = loadTasks();
            const task = data.tasks.find(t => t.id === taskId);
            if (!task) {
                console.error(`Task not found: ${taskId}`);
                process.exit(1);
            }
            console.log(JSON.stringify(task, null, 2));
            return;
        }

        if (subcmd === 'done') {
            const taskId = args[2];
            if (!taskId) {
                console.error('Usage: alma tasks done <id>');
                process.exit(1);
            }
            const data = loadTasks();
            const task = data.tasks.find(t => t.id === taskId);
            if (!task) {
                console.error(`Task not found: ${taskId}`);
                process.exit(1);
            }
            task.status = 'done';
            task.updatedAt = new Date().toISOString();
            saveTasks(data);
            console.log(`✅ Completed: ${task.id} — ${task.title}`);
            return;
        }

        if (subcmd === 'delete') {
            const taskId = args[2];
            if (!taskId) {
                console.error('Usage: alma tasks delete <id>');
                process.exit(1);
            }
            const data = loadTasks();
            data.tasks = data.tasks.filter(t => t.id !== taskId);
            saveTasks(data);
            console.log(`Deleted task: ${taskId}`);
            return;
        }

        console.error('Usage: alma tasks <list|add|update|show|done|delete>');
        process.exit(1);
    }
```

> 🔍 **分析**: このコマンドはローカルのファイルシステム（JSONや設定ファイル等）を直接読み書きしています。

