if (cmd === 'skill' && (args[1] === 'search' || args[1] === 'find') && args[2]) {
        const query = args.slice(2).join(' ');
        const { execSync } = await import('child_process');
        const runner = getPackageRunner();
        if (!runner) {
            console.error('Error: No package runner found. Install Node.js (npx) or Bun (bunx).');
            return;
        }
        try {
            execSync(`${runner} skills find ${JSON.stringify(query)}`, { stdio: 'inherit' });
        } catch (e) {
            console.error('Search failed:', e.message);
        }
        return;
    }

if (cmd === 'skill' && (args[1] === 'list' || !args[1])) {
        const skills = await api('GET', '/api/skills');
        if (Array.isArray(skills)) {
            for (const s of skills) {
                console.log(`${s.name || s.id}  [${s.source || 'unknown'}]  ${s.description || ''}`);
            }
        } else {
            prettyPrint(skills);
        }
        return;
    }

if (cmd === 'skill' && args[1] === 'install' && args[2]) {
        const source = args[2];
        const { execSync } = await import('child_process');
        const os = await import('os');
        const path = await import('path');
        const skillsDir = path.join(_os.homedir(), '.config', 'alma', 'skills');

        // If source looks like owner/repo@skill (skills.sh format), use skills CLI
        if (source.includes('@') || source.match(/^[\w-]+\/[\w-]+$/)) {
            const runner = getPackageRunner();
            console.log(`Installing skill from skills.sh: ${source}...`);
            try {
                if (!runner) throw new Error('No package runner');
                execSync(`${runner} skills add ${JSON.stringify(source)} -g -y`, { stdio: 'inherit', cwd: skillsDir });
                console.log(`✅ Installed: ${source}`);
            } catch (e) {
                // Fallback to git clone for non-skills.sh repos
                console.log('skills.sh install failed, trying git clone...');
                try {
                    const gitUrl = source.startsWith('http') ? source : `https://github.com/${source}`;
                    const repoName = source.split('/').pop().split('@')[0].replace('.git', '');
                    execSync(`git clone --depth 1 ${gitUrl} ${path.join(skillsDir, repoName)}`, { stdio: 'inherit' });
                    console.log(`✅ Installed via git: ${repoName}`);
                } catch (e2) {
                    console.error('Install failed:', e2.message);
                }
            }
        } else {
            // Direct git URL or other format
            console.log(`Installing skill from: ${source}...`);
            try {
                const gitUrl = source.startsWith('http') ? source : `https://github.com/${source}`;
                const repoName = source.split('/').pop().replace('.git', '');
                execSync(`git clone --depth 1 ${gitUrl} ${path.join(skillsDir, repoName)}`, { stdio: 'inherit' });
                console.log(`✅ Installed: ${repoName}`);
            } catch (e) {
                console.error('Install failed:', e.message);
            }
        }
        return;
    }

if (cmd === 'skill' && args[1] === 'update') {
        const { execSync } = await import('child_process');
        const runner = getPackageRunner();
        if (!runner) {
            console.error('Error: No package runner found. Install Node.js (npx) or Bun (bunx).');
            return;
        }
        console.log('Checking for skill updates...');
        try {
            execSync(`${runner} skills check`, { stdio: 'inherit' });
            execSync(`${runner} skills update`, { stdio: 'inherit' });
            console.log('✅ Skills updated.');
        } catch (e) {
            console.error('Update failed:', e.message);
        }
        return;
    }

if (cmd === 'skill' && args[1] === 'uninstall' && args[2]) {
        const os = await import('os');
        const path = await import('path');
        const fs = await import('fs');
        const skillPath = path.join(_os.homedir(), '.config', 'alma', 'skills', args[2]);
        if (fs.existsSync(skillPath)) {
            fs.rmSync(skillPath, { recursive: true });
            console.log(`✅ Uninstalled: ${args[2]}`);
        } else {
            console.error(`Skill not found: ${args[2]}`);
        }
        return;
    }

