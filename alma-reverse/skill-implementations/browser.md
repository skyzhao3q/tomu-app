# Skill Implementation: `browser`

## 💻 正体: `alma` CLI サブコマンド (Node.js/Bun)
このスキルはターミナルで `alma browser` を実行した際、メインのCLIスクリプト内の以下のロジックを呼び出します。

### Implementation of `alma browser`
```javascript
if (cmd === 'browser') {
        const subcmd = args[1];

        if (!subcmd || subcmd === 'help') {
            console.log(`alma browser — control Chrome via Chrome Relay

  alma browser status                   Connection status
  alma browser tabs                     List open tabs
  alma browser open [url]               Open new tab
  alma browser goto <tabId> <url>       Navigate tab to URL
  alma browser click <tabId> <selector> Click element
  alma browser type <tabId> <sel> <text> [--enter]  Type text
  alma browser screenshot [tabId]       Take screenshot
  alma browser read <tabId>             Read page as markdown
  alma browser read-dom <tabId>         List interactive elements
  alma browser eval <tabId> <code>      Run JavaScript
  alma browser scroll <tabId> <up|down> [amount]  Scroll
  alma browser back <tabId>             Go back
  alma browser forward <tabId>          Go forward`);
            return;
        }

        if (subcmd === 'status') {
            const data = await api('GET', '/api/chrome-relay/status');
            prettyPrint(data);
            return;
        }

        if (subcmd === 'tabs') {
            const data = await api('POST', '/api/chrome-relay/tabs');
            if (data.tabs && data.tabs.length === 0) {
                console.log('No tabs found.');
            } else if (data.tabs) {
                for (const t of data.tabs) {
                    console.log(`  [${t.id}] ${t.title}`);
                    console.log(`       ${t.url}`);
                }
            } else {
                prettyPrint(data);
            }
            return;
        }

        if (subcmd === 'open') {
            const url = args[2];
            const data = await api('POST', '/api/chrome-relay/tabs/create', url ? { url } : {});
            console.log(`Tab created: [${data.id}] ${data.title || ''}`);
            if (data.url) console.log(`  ${data.url}`);
            return;
        }

        if (subcmd === 'goto') {
            const tabId = parseInt(args[2], 10);
            const url = args[3];
            if (!tabId || !url) {
                console.error('Usage: alma browser goto <tabId> <url>');
                process.exit(1);
            }
            const data = await api('POST', '/api/chrome-relay/navigate', { tabId, url });
            console.log(`Navigated: ${data.title || ''}`);
            if (data.url) console.log(`  ${data.url}`);
            return;
        }

        if (subcmd === 'click') {
            const tabId = parseInt(args[2], 10);
            const selector = args[3];
            if (!tabId || !selector) {
                console.error('Usage: alma browser click <tabId> <selector>');
                process.exit(1);
            }
            const data = await api('POST', '/api/chrome-relay/click', { tabId, selector });
            if (data.success) console.log('Clicked.');
            else console.error('Click failed:', data.error || 'unknown error');
            return;
        }

        if (subcmd === 'type') {
            const tabId = parseInt(args[2], 10);
            const selector = args[3];
            const text = args[4];
            const pressEnter = args.includes('--enter');
            if (!tabId || !selector || !text) {
                console.error('Usage: alma browser type <tabId> <selector> <text> [--enter]');
                process.exit(1);
            }
            const data = await api('POST', '/api/chrome-relay/type', { tabId, selector, text, pressEnter });
            if (data.success) console.log('Typed.');
            else console.error('Type failed:', data.error || 'unknown error');
            return;
        }

        if (subcmd === 'screenshot') {
            const tabId = args[2] ? parseInt(args[2], 10) : undefined;
            const data = await api('POST', '/api/chrome-relay/screenshot', tabId ? { tabId } : {});
            if (data.path) {
                console.log(data.path);
            } else {
                console.error('Screenshot failed:', data.error || 'unknown error');
                process.exit(1);
            }
            return;
        }

        if (subcmd === 'read') {
            const tabId = parseInt(args[2], 10);
            if (!tabId) {
                console.error('Usage: alma browser read <tabId>');
                process.exit(1);
            }
            const data = await api('POST', '/api/chrome-relay/read', { tabId });
            if (data.title) console.log(`# ${data.title}\n`);
            if (data.url) console.log(`URL: ${data.url}\n`);
            if (data.markdown) console.log(data.markdown);
            if (data.truncated) console.log('\n(content truncated)');
            return;
        }

        if (subcmd === 'read-dom') {
            const tabId = parseInt(args[2], 10);
            if (!tabId) {
                console.error('Usage: alma browser read-dom <tabId>');
                process.exit(1);
            }
            const data = await api('POST', '/api/chrome-relay/read-dom', { tabId });
            prettyPrint(data);
            return;
        }

        if (subcmd === 'eval') {
            const tabId = parseInt(args[2], 10);
            const code = args.slice(3).join(' ');
            if (!tabId || !code) {
                console.error('Usage: alma browser eval <tabId> <code>');
                process.exit(1);
            }
            const data = await api('POST', '/api/chrome-relay/eval', { tabId, code });
            if (data.error) console.error('Error:', data.error);
            else if (data.result !== undefined) console.log(data.result);
            return;
        }

        if (subcmd === 'scroll') {
            const tabId = parseInt(args[2], 10);
            const direction = args[3];
            const amount = args[4] ? parseInt(args[4], 10) : undefined;
            if (!tabId || !direction || !['up', 'down'].includes(direction)) {
                console.error('Usage: alma browser scroll <tabId> <up|down> [amount]');
                process.exit(1);
            }
            const body = { tabId, direction };
            if (amount) body.amount = amount;
            const data = await api('POST', '/api/chrome-relay/scroll', body);
            if (data.success) console.log('Scrolled ' + direction + '.');
            return;
        }

        if (subcmd === 'back') {
            const tabId = parseInt(args[2], 10);
            if (!tabId) {
                console.error('Usage: alma browser back <tabId>');
                process.exit(1);
            }
            const data = await api('POST', '/api/chrome-relay/back', { tabId });
            if (data.success) console.log('Went back.');
            return;
        }

        if (subcmd === 'forward') {
            const tabId = parseInt(args[2], 10);
            if (!tabId) {
                console.error('Usage: alma browser forward <tabId>');
                process.exit(1);
            }
            const data = await api('POST', '/api/chrome-relay/forward', { tabId });
            if (data.success) console.log('Went forward.');
            return;
        }

        console.error(`Unknown browser subcommand: ${subcmd}. Run 'alma browser help' for usage.`);
        process.exit(1);
    }
```

