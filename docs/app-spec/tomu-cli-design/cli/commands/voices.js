if (cmd === "voices") {
  const settings = await api("GET", "/api/settings");
  const provider = settings?.tts?.provider || "elevenlabs";
  const apiKey = settings?.tts?.apiKey;
  const currentVoiceId = settings?.tts?.voiceId;

  if (provider === "elevenlabs") {
    if (!apiKey) {
      console.error(
        "❌ No ElevenLabs API key configured. Set it with: alma config set tts.apiKey <key>",
      );
      process.exit(1);
    }
    try {
      const resp = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": apiKey },
      });
      const data = await resp.json();
      const voices = data.voices || [];
      if (voices.length === 0) {
        console.log("No voices found.");
        return;
      }
      console.log(`Available ElevenLabs voices (${voices.length} total):\n`);
      for (const v of voices) {
        const labels = v.labels || {};
        const lang = labels.language || "?";
        const gender = labels.gender || "?";
        const accent = labels.accent || "";
        const desc = labels.descriptive || "";
        const current = v.voice_id === currentVoiceId ? " ← current" : "";
        console.log(
          `  ${v.voice_id}  ${v.name}  [${lang}/${gender}] ${accent} ${desc}${current}`,
        );
      }
      console.log(`\nTo change voice: alma config set tts.voiceId <voice_id>`);
    } catch (err) {
      console.error("❌ Failed to fetch voices:", err.message);
      process.exit(1);
    }
  } else if (provider === "openai") {
    console.log("OpenAI TTS voices: alloy, echo, fable, onyx, nova, shimmer");
    console.log(`Current: ${currentVoiceId || "(not set)"}`);
    console.log("\nTo change: alma config set tts.voiceId <voice_name>");
  } else if (provider === "local" || provider === "qwen") {
    console.log("Local Qwen3-TTS voices:\n");
    const localVoices = [
      { id: "Chelsie", lang: "en", gender: "female", desc: "warm, clear" },
      { id: "Aidan", lang: "en", gender: "male", desc: "deep, steady" },
      { id: "Serena", lang: "en", gender: "female", desc: "cute, lively" },
      { id: "Vivian", lang: "zh", gender: "female", desc: "温柔, 自然" },
      { id: "Ono_anna", lang: "ja", gender: "female", desc: "Japanese" },
      { id: "Sohee", lang: "ko", gender: "female", desc: "Korean" },
      { id: "Uncle_fu", lang: "zh", gender: "male", desc: "成熟, 稳重" },
      { id: "Ryan", lang: "en", gender: "male", desc: "deep" },
      { id: "Aiden", lang: "en", gender: "male", desc: "young" },
      { id: "Eric", lang: "en", gender: "male", desc: "professional" },
      { id: "Dylan", lang: "en", gender: "male", desc: "casual" },
    ];
    for (const v of localVoices) {
      const current =
        v.id.toLowerCase() === (currentVoiceId || "").toLowerCase()
          ? " ← current"
          : "";
      console.log(
        `  ${v.id.padEnd(12)} [${v.lang}/${v.gender}] ${v.desc}${current}`,
      );
    }
    console.log(`\nTo change: alma config set tts.voiceId <voice_name>`);
    console.log(
      "Note: Qwen3-TTS supports any voice name. These are the pre-tested ones.",
    );
  } else {
    console.log(`Unknown TTS provider: ${provider}`);
    console.log("Supported providers: local, openai, elevenlabs");
  }
  return;
}
if (cmd === 'voices') {
        const settings = await api('GET', '/api/settings');
        const provider = settings?.tts?.provider || 'elevenlabs';
        const apiKey = settings?.tts?.apiKey;
        const currentVoiceId = settings?.tts?.voiceId;

        if (provider === 'elevenlabs') {
            if (!apiKey) {
                console.error('❌ No ElevenLabs API key configured. Set it with: alma config set tts.apiKey <key>');
                process.exit(1);
            }
            try {
                const resp = await fetch('https://api.elevenlabs.io/v1/voices', {
                    headers: { 'xi-api-key': apiKey },
                });
                const data = await resp.json();
                const voices = data.voices || [];
                if (voices.length === 0) {
                    console.log('No voices found.');
                    return;
                }
                console.log(`Available ElevenLabs voices (${voices.length} total):\n`);
                for (const v of voices) {
                    const labels = v.labels || {};
                    const lang = labels.language || '?';
                    const gender = labels.gender || '?';
                    const accent = labels.accent || '';
                    const desc = labels.descriptive || '';
                    const current = v.voice_id === currentVoiceId ? ' ← current' : '';
                    console.log(`  ${v.voice_id}  ${v.name}  [${lang}/${gender}] ${accent} ${desc}${current}`);
                }
                console.log(`\nTo change voice: alma config set tts.voiceId <voice_id>`);
            } catch (err) {
                console.error('❌ Failed to fetch voices:', err.message);
                process.exit(1);
            }
        } else if (provider === 'openai') {
            console.log('OpenAI TTS voices: alloy, echo, fable, onyx, nova, shimmer');
            console.log(`Current: ${currentVoiceId || '(not set)'}`);
            console.log('\nTo change: alma config set tts.voiceId <voice_name>');
        } else if (provider === 'local' || provider === 'qwen') {
            console.log('Local Qwen3-TTS voices:\n');
            const localVoices = [
                { id: 'Chelsie', lang: 'en', gender: 'female', desc: 'warm, clear' },
                { id: 'Aidan', lang: 'en', gender: 'male', desc: 'deep, steady' },
                { id: 'Serena', lang: 'en', gender: 'female', desc: 'cute, lively' },
                { id: 'Vivian', lang: 'zh', gender: 'female', desc: '温柔, 自然' },
                { id: 'Ono_anna', lang: 'ja', gender: 'female', desc: 'Japanese' },
                { id: 'Sohee', lang: 'ko', gender: 'female', desc: 'Korean' },
                { id: 'Uncle_fu', lang: 'zh', gender: 'male', desc: '成熟, 稳重' },
                { id: 'Ryan', lang: 'en', gender: 'male', desc: 'deep' },
                { id: 'Aiden', lang: 'en', gender: 'male', desc: 'young' },
                { id: 'Eric', lang: 'en', gender: 'male', desc: 'professional' },
                { id: 'Dylan', lang: 'en', gender: 'male', desc: 'casual' },
            ];
            for (const v of localVoices) {
                const current = v.id.toLowerCase() === (currentVoiceId || '').toLowerCase() ? ' ← current' : '';
                console.log(`  ${v.id.padEnd(12)} [${v.lang}/${v.gender}] ${v.desc}${current}`);
            }
            console.log(`\nTo change: alma config set tts.voiceId <voice_name>`);
            console.log('Note: Qwen3-TTS supports any voice name. These are the pre-tested ones.');
        } else {
            console.log(`Unknown TTS provider: ${provider}`);
            console.log('Supported providers: local, openai, elevenlabs');
        }
        return;
    }

