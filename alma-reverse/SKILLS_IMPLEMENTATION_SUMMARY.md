# Skills (拡張機能) の実装・正体一覧

Alma のすべての SKILL の裏側（正体）を解析しました。それぞれの SKILL が「CLI コマンド（Node.js）」なのか、「API ラッパー」なのか、「外部スクリプト」なのかを判定しています。

- **`browser`**: Node.js (Bun) CLI Command
- **`discord`**: Node.js (Bun) CLI Command
- **`file-manager`**: Pure Prompt Engineering (No specific backend code)
- **`image-gen`**: Local API Wrapper (HTTP Request to localhost)
- **`memory-management`**: Local File System Operator (Node.js `fs`)
- **`music-gen`**: Local API Wrapper (HTTP Request to localhost)
- **`music-listener`**: Pure Prompt Engineering (No specific backend code)
- **`notebook`**: Pure Prompt Engineering (No specific backend code)
- **`plan-mode`**: Pure Prompt Engineering (No specific backend code)
- **`reactions`**: Pure Prompt Engineering (No specific backend code)
- **`scheduler`**: Local API Wrapper (HTTP Request to localhost)
- **`screenshot`**: Pure Prompt Engineering (No specific backend code)
- **`self-management`**: Local API Wrapper (HTTP Request to localhost)
- **`self-reflection`**: Local File System Operator (Node.js `fs`)
- **`selfie`**: Local API Wrapper (HTTP Request to localhost)
- **`send-file`**: Node.js (Bun) CLI Command
- **`skill-hub`**: Pure Prompt Engineering (No specific backend code)
- **`skill-search`**: Pure Prompt Engineering (No specific backend code)
- **`system-info`**: Pure Prompt Engineering (No specific backend code)
- **`tasks`**: Local File System Operator (Node.js `fs`)
- **`telegram`**: Local API Wrapper (HTTP Request to localhost)
- **`thread-management`**: Node.js (Bun) CLI Command
- **`todo`**: Pure Prompt Engineering (No specific backend code)
- **`travel`**: Local File System Operator (Node.js `fs`)
- **`twitter-media`**: Node.js (Bun) CLI Command
- **`video-reader`**: Local API Wrapper (HTTP Request to localhost)
- **`voice`**: Local API Wrapper (HTTP Request to localhost)
- **`web-fetch`**: Pure Prompt Engineering (No specific backend code)
- **`web-search`**: Node.js (Bun) CLI Command
- **`xiaohongshu-cli`**: External Wrapper Script (Python / Bash etc.)
