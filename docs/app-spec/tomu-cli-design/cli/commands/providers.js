if (cmd === 'providers' || cmd === 'provider') {
        const sub = args[1];

        // alma provider add <name> <type> [--api-key KEY] [--base-url URL] [--models m1,m2,...]
        if (sub === 'add' && args[2] && args[3]) {
            const name = args[2];
            // Normalize common type aliases
            const TYPE_ALIASES = { gemini: 'google', 'google-gemini': 'google', gpt: 'openai', claude: 'anthropic' };
            const type = TYPE_ALIASES[args[3].toLowerCase()] || args[3]; // openai, anthropic, google, openrouter, etc.
            const body = { name, type };
            // Parse optional flags
            for (let i = 4; i < args.length; i++) {
                if ((args[i] === '--api-key' || args[i] === '-k') && args[i + 1]) {
                    body.apiKey = args[++i];
                } else if ((args[i] === '--base-url' || args[i] === '-u') && args[i + 1]) {
                    body.baseURL = args[++i];
                } else if ((args[i] === '--models' || args[i] === '-m') && args[i + 1]) {
                    body.models = args[++i].split(',');
                }
            }
            // Auto-populate default models if not specified
            if (!body.models) {
                const defaultModels = {
                    google: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
                    anthropic: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414', 'claude-opus-4-20250514'],
                    openai: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'o3-mini'],
                    deepseek: ['deepseek-chat', 'deepseek-reasoner'],
                };
                if (defaultModels[type]) {
                    body.models = defaultModels[type];
                    console.log(`   Auto-populated ${body.models.length} default models for ${type}`);
                }
            }
            const result = await api('POST', '/api/providers', body);
            if (result && result.id) {
                console.log(`✅ Provider created: ${result.id} (${result.name})`);
                if (body.apiKey) console.log('   API key: set');
                if (body.baseURL) console.log(`   Base URL: ${body.baseURL}`);
                if (body.models) console.log(`   Models: ${body.models.join(', ')}`);
            } else {
                prettyPrint(result);
            }
            return;
        }

        // alma provider delete <id>
        if ((sub === 'delete' || sub === 'remove') && args[2]) {
            const result = await api('DELETE', `/api/providers/${args[2]}`);
            console.log(`✅ Provider deleted: ${args[2]}`);
            return;
        }

        // alma providers <id> models
        const providerId = sub;
        if (providerId && args[2] === 'models') {
            const models = await api('GET', `/api/providers/${providerId}/models`);
            if (Array.isArray(models)) {
                for (const m of models) {
                    const id = typeof m === 'string' ? m : m.id || m.name;
                    console.log(id);
                }
            } else {
                prettyPrint(models);
            }
            return;
        }

        const providers = await api('GET', '/api/providers');
        if (Array.isArray(providers)) {
            for (const p of providers) {
                console.log(`${p.id}  ${p.name || p.type || ''}  (${p.type || 'unknown'})`);
            }
        } else {
            prettyPrint(providers);
        }
        return;
    }

