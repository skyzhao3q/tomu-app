if (cmd === 'fatigue' || cmd === 'sleep' || cmd === 'wake' || cmd === 'rest') {
        const fatiguePath = _path.join(_os.homedir(), '.config', 'alma', 'fatigue.json');
        const fs = await import('fs');

        const loadState = () => {
            try {
                if (fs.existsSync(fatiguePath)) return JSON.parse(fs.readFileSync(fatiguePath, 'utf-8'));
            } catch {
                /* ignore */
            }
            return { fatigue: 0, messageCount: 0, lastMessageTime: Date.now(), lastRestTime: Date.now(), manualSleep: false, manualWake: false };
        };
        const saveState = s => {
            const dir = _path.dirname(fatiguePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(fatiguePath, JSON.stringify(s, null, 2));
        };

        if (cmd === 'sleep') {
            const state = loadState();
            state.manualSleep = true;
            state.manualWake = false;
            saveState(state);
            console.log('💤 Alma is now sleeping. She will be grumpy if disturbed.');
            return;
        }

        if (cmd === 'wake') {
            const state = loadState();
            state.manualSleep = false;
            state.manualWake = true;
            state.fatigue = Math.max(0, state.fatigue - 30);
            state.lastRestTime = Date.now();
            saveState(state);
            console.log('☀️ Alma is awake now!');
            return;
        }

        if (cmd === 'rest') {
            const state = loadState();
            state.fatigue = 0;
            state.messageCount = 0;
            state.lastRestTime = Date.now();
            state.manualSleep = false;
            state.manualWake = false;
            saveState(state);
            console.log('✨ Alma is fully rested!');
            return;
        }

        // cmd === 'fatigue' — show status
        const state = loadState();
        const now = Date.now();
        const minutesSinceLastMsg = (now - state.lastMessageTime) / 60000;
        const recovery = minutesSinceLastMsg * 0.8;
        const baseFatigue = Math.max(0, state.fatigue - recovery);
        const h = new Date().getHours();
        let timeBonus = 0;
        if (h >= 1 && h < 6) timeBonus = 30;
        else if (h >= 23 || h < 8) timeBonus = 15;
        else if (h >= 13 && h <= 14) timeBonus = 8;
        const effective = Math.min(100, Math.round(baseFatigue + timeBonus));
        let level = 'awake';
        if (state.manualSleep) level = 'sleeping (manual)';
        else if (state.manualWake && !(h >= 1 && h < 6)) level = 'awake (forced)';
        else if (effective >= 75) level = 'sleeping';
        else if (effective >= 50) level = 'sleepy';
        else if (effective >= 30) level = 'tired';
        console.log(`Fatigue: ${effective}/100 (${level})`);
        console.log(`Messages processed: ${state.messageCount}`);
        console.log(`Time bonus: +${timeBonus} (hour: ${h})`);
        console.log(`Base fatigue: ${Math.round(baseFatigue)} (after ${Math.round(minutesSinceLastMsg)}min recovery)`);
        if (state.manualSleep) console.log('Manual sleep: ON');
        if (state.manualWake) console.log('Manual wake: ON');
        return;
    }

