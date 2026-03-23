if (cmd === "memory") {
  const subcmd = args[1];

  if (subcmd === "list" || !subcmd) {
    const memories = await api("GET", "/api/memories");
    if (Array.isArray(memories)) {
      if (memories.length === 0) {
        console.log("No memories.");
        return;
      }
      for (const m of memories) {
        console.log(`${m.id}  ${truncate(m.content || m.text || "", 70)}`);
      }
      console.log(`\n(${memories.length} memories)`);
    } else {
      prettyPrint(memories);
    }
    return;
  }

  if (subcmd === "search") {
    const query = args.slice(2).join(" ");
    if (!query) {
      console.error("Usage: alma memory search <query>");
      process.exit(1);
    }
    const response = await api("POST", "/api/memories/search", { query });
    const results = Array.isArray(response)
      ? response
      : response?.results || [];
    if (results.length > 0) {
      for (const m of results) {
        const score =
          m.score != null ? ` (${(m.score * 100).toFixed(0)}%)` : "";
        console.log(
          `${m.id}  ${truncate(m.content || m.text || "", 60)}${score}`,
        );
      }
    } else {
      console.log("No matching memories.");
    }
    return;
  }

  if (subcmd === "add") {
    const content = args.slice(2).join(" ");
    if (!content) {
      console.error("Usage: alma memory add <content>");
      process.exit(1);
    }
    const mem = await api("POST", "/api/memories", { content });
    console.log(`✅ Memory added: ${mem.id || "(ok)"}`);
    return;
  }

  if (subcmd === "delete") {
    const id = args[2];
    if (!id) {
      console.error("Usage: alma memory delete <id>");
      process.exit(1);
    }
    await api("DELETE", `/api/memories/${id}`);
    console.log(`✅ Memory deleted: ${id}`);
    return;
  }

  if (subcmd === "stats") {
    const stats = await api("GET", "/api/memories/stats");
    prettyPrint(stats);
    return;
  }

  if (subcmd === "grep") {
    const query = args.slice(2).join(" ");
    if (!query) {
      console.error("Usage: alma memory grep <keyword>");
      process.exit(1);
    }
    // Search through archived thread markdown files
    const settings = await api("GET", "/api/settings");
    const workspacePath =
      settings?.workspace?.path ||
      _path.join(
        _os.homedir(),
        "Library",
        "Application Support",
        "alma",
        "workspaces",
        "default",
      );
    const threadsDir = _path.join(workspacePath, "threads");
    if (!_fs.existsSync(threadsDir)) {
      console.log(
        "No thread archives yet. Archives are created automatically every 5 minutes.",
      );
      return;
    }
    const files = _fs.readdirSync(threadsDir).filter((f) => f.endsWith(".md"));
    const results = [];
    for (const file of files) {
      const content = _fs.readFileSync(_path.join(threadsDir, file), "utf-8");
      const lines = content.split("\n");
      const matches = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(query.toLowerCase())) {
          matches.push({
            line: i + 1,
            text: lines[i].trim().substring(0, 120),
          });
        }
      }
      if (matches.length > 0) {
        // Extract metadata from frontmatter
        const titleMatch = content.match(/^title:\s*"?(.+?)"?\s*$/m);
        const dateMatch = content.match(/^createdAt:\s*(.+)$/m);
        const title = titleMatch ? titleMatch[1] : file;
        const date = dateMatch ? dateMatch[1].substring(0, 10) : "";
        results.push({ file, title, date, matches });
      }
    }
    if (results.length === 0) {
      console.log(
        `No matches for "${query}" in ${files.length} archived threads.`,
      );
    } else {
      let totalMatches = 0;
      for (const r of results) {
        console.log(`\n📄 ${r.title} (${r.date})`);
        for (const m of r.matches.slice(0, 5)) {
          console.log(`   L${m.line}: ${m.text}`);
          totalMatches++;
        }
        if (r.matches.length > 5) {
          console.log(`   ... and ${r.matches.length - 5} more matches`);
          totalMatches += r.matches.length - 5;
        }
      }
      console.log(`\n${totalMatches} matches in ${results.length} thread(s)`);
    }
    return;
  }

  if (subcmd === "archive") {
    // Force archive all threads now
    const resp = await api("POST", "/api/threads/archive");
    console.log(resp?.message || "✅ Archive triggered");
    return;
  }

  console.error(
    "Usage: alma memory <list|search|add|delete|grep|stats|archive>",
  );
  process.exit(1);
}
if (cmd === 'memory') {
        const subcmd = args[1];

        if (subcmd === 'list' || !subcmd) {
            const memories = await api('GET', '/api/memories');
            if (Array.isArray(memories)) {
                if (memories.length === 0) {
                    console.log('No memories.');
                    return;
                }
                for (const m of memories) {
                    console.log(`${m.id}  ${truncate(m.content || m.text || '', 70)}`);
                }
                console.log(`\n(${memories.length} memories)`);
            } else {
                prettyPrint(memories);
            }
            return;
        }

        if (subcmd === 'search') {
            const query = args.slice(2).join(' ');
            if (!query) {
                console.error('Usage: alma memory search <query>');
                process.exit(1);
            }
            const response = await api('POST', '/api/memories/search', { query });
            const results = Array.isArray(response) ? response : response?.results || [];
            if (results.length > 0) {
                for (const m of results) {
                    const score = m.score != null ? ` (${(m.score * 100).toFixed(0)}%)` : '';
                    console.log(`${m.id}  ${truncate(m.content || m.text || '', 60)}${score}`);
                }
            } else {
                console.log('No matching memories.');
            }
            return;
        }

        if (subcmd === 'add') {
            const content = args.slice(2).join(' ');
            if (!content) {
                console.error('Usage: alma memory add <content>');
                process.exit(1);
            }
            const mem = await api('POST', '/api/memories', { content });
            console.log(`✅ Memory added: ${mem.id || '(ok)'}`);
            return;
        }

        if (subcmd === 'delete') {
            const id = args[2];
            if (!id) {
                console.error('Usage: alma memory delete <id>');
                process.exit(1);
            }
            await api('DELETE', `/api/memories/${id}`);
            console.log(`✅ Memory deleted: ${id}`);
            return;
        }

        if (subcmd === 'stats') {
            const stats = await api('GET', '/api/memories/stats');
            prettyPrint(stats);
            return;
        }

        if (subcmd === 'grep') {
            const query = args.slice(2).join(' ');
            if (!query) {
                console.error('Usage: alma memory grep <keyword>');
                process.exit(1);
            }
            // Search through archived thread markdown files
            const settings = await api('GET', '/api/settings');
            const workspacePath = settings?.workspace?.path || _path.join(_os.homedir(), 'Library', 'Application Support', 'alma', 'workspaces', 'default');
            const threadsDir = _path.join(workspacePath, 'threads');
            if (!_fs.existsSync(threadsDir)) {
                console.log('No thread archives yet. Archives are created automatically every 5 minutes.');
                return;
            }
            const files = _fs.readdirSync(threadsDir).filter(f => f.endsWith('.md'));
            const results = [];
            for (const file of files) {
                const content = _fs.readFileSync(_path.join(threadsDir, file), 'utf-8');
                const lines = content.split('\n');
                const matches = [];
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].toLowerCase().includes(query.toLowerCase())) {
                        matches.push({ line: i + 1, text: lines[i].trim().substring(0, 120) });
                    }
                }
                if (matches.length > 0) {
                    // Extract metadata from frontmatter
                    const titleMatch = content.match(/^title:\s*"?(.+?)"?\s*$/m);
                    const dateMatch = content.match(/^createdAt:\s*(.+)$/m);
                    const title = titleMatch ? titleMatch[1] : file;
                    const date = dateMatch ? dateMatch[1].substring(0, 10) : '';
                    results.push({ file, title, date, matches });
                }
            }
            if (results.length === 0) {
                console.log(`No matches for "${query}" in ${files.length} archived threads.`);
            } else {
                let totalMatches = 0;
                for (const r of results) {
                    console.log(`\n📄 ${r.title} (${r.date})`);
                    for (const m of r.matches.slice(0, 5)) {
                        console.log(`   L${m.line}: ${m.text}`);
                        totalMatches++;
                    }
                    if (r.matches.length > 5) {
                        console.log(`   ... and ${r.matches.length - 5} more matches`);
                        totalMatches += r.matches.length - 5;
                    }
                }
                console.log(`\n${totalMatches} matches in ${results.length} thread(s)`);
            }
            return;
        }

        if (subcmd === 'archive') {
            // Force archive all threads now
            const resp = await api('POST', '/api/threads/archive');
            console.log(resp?.message || '✅ Archive triggered');
            return;
        }

        console.error('Usage: alma memory <list|search|add|delete|grep|stats|archive>');
        process.exit(1);
    }

