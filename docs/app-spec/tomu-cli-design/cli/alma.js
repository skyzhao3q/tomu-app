#!/usr/bin/env node

/**
 * Alma CLI — manage Alma app settings and status from the command line.
 */

import { execSync as _execSync } from "child_process";
import _os from "os";
import _path from "path";
import _fs from "fs";
import { fileURLToPath as _fileURLToPath } from "url";

const BASE_URL = process.env.ALMA_API_URL || "http://localhost:23001";

const __alma_filename = _fileURLToPath(import.meta.url);
const __alma_dirname = _path.dirname(__alma_filename);

/** Get the best package runner: npx, bunx, or bundled bun */
let _cachedRunner;
function getPackageRunner() {
  if (_cachedRunner !== undefined) return _cachedRunner;
  function tryCmd(cmd) {
    try {
      _execSync(`${cmd} --version`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }
  if (tryCmd("npx")) {
    _cachedRunner = "npx";
    return _cachedRunner;
  }
  if (tryCmd("bunx")) {
    _cachedRunner = "bunx";
    return _cachedRunner;
  }
  // Try Alma's bundled bun
  const bundledPaths = [
    _path.join(
      __alma_dirname,
      "..",
      "vendor",
      "bun",
      `${process.platform}-${process.arch}`,
      process.platform === "win32" ? "bun.exe" : "bun",
    ),
    _path.join(
      __alma_dirname,
      "..",
      "Resources",
      "bun",
      process.platform === "win32" ? "bun.exe" : "bun",
    ),
    _path.join(_os.homedir(), ".bun", "bin", "bun"),
  ];
  for (const p of bundledPaths) {
    if (_fs.existsSync(p)) {
      _cachedRunner = `"${p}" x`;
      return _cachedRunner;
    }
  }
  _cachedRunner = null;
  return _cachedRunner;
}

async function api(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  try {
    const resp = await fetch(`${BASE_URL}${path}`, opts);
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error(
        `Error: HTTP ${resp.status} ${resp.statusText}${text ? " — " + text : ""}`,
      );
      process.exit(1);
    }
    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await resp.json();
    return await resp.text();
  } catch (err) {
    console.error(`Error: Cannot connect to Alma at ${BASE_URL}`);
    console.error(
      "Is Alma running? Start it with: npm run dev (in the alma directory)",
    );
    process.exit(1);
  }
}

async function apiRaw(method, path) {
  const opts = { method };
  try {
    const resp = await fetch(`${BASE_URL}${path}`, opts);
    if (!resp.ok) {
      console.error(`Error: HTTP ${resp.status} ${resp.statusText}`);
      process.exit(1);
    }
    return resp;
  } catch (err) {
    console.error(`Error: Cannot connect to Alma at ${BASE_URL}`);
    process.exit(1);
  }
}

function getNestedValue(obj, path) {
  if (!path) return obj;
  const parts = path.split(".");
  let val = obj;
  for (const part of parts) {
    if (val && typeof val === "object") {
      val = val[part];
    } else {
      return undefined;
    }
  }
  return val;
}

function setNestedValue(obj, path, value) {
  const parts = path.split(".");
  let target = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!target[parts[i]] || typeof target[parts[i]] !== "object") {
      target[parts[i]] = {};
    }
    target = target[parts[i]];
  }
  target[parts[parts.length - 1]] = value;
  return obj;
}

function parseValue(str) {
  if (str === "true") return true;
  if (str === "false") return false;
  if (str === "null") return null;
  if (/^-?\d+$/.test(str)) return parseInt(str, 10);
  if (/^-?\d+\.\d+$/.test(str)) return parseFloat(str);
  return str;
}

function prettyPrint(val) {
  if (val === undefined) {
    console.log("(not set)");
  } else if (typeof val === "object") {
    console.log(JSON.stringify(val, null, 2));
  } else {
    console.log(String(val));
  }
}

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleString();
}

function truncate(str, len = 60) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

function resolveCronJob(jobs, id) {
  const exactMatch = jobs.find((j) => j.id === id);
  if (exactMatch) return exactMatch;

  const prefixMatches = jobs.filter((j) => j.id.startsWith(id));
  if (prefixMatches.length === 1) return prefixMatches[0];

  if (prefixMatches.length > 1) {
    const matches = prefixMatches.map((j) => `${j.id} (${j.name})`).join(", ");
    console.error(`Ambiguous job id: ${id}. Matches: ${matches}`);
    process.exit(1);
  }

  console.error(`Job not found: ${id}`);
  process.exit(1);
}

const IMAGE_MODEL_PRIORITY = [
  "nano-banana-2",
  "nano-banana-pro",
  "nano-banana",
  "gemini-3-pro-image",
  "gemini-2.5-flash-image",
  "gemini-2.0-flash",
];

async function getEnabledGoogleProvider() {
  const providers = await api("GET", "/api/providers");
  return (providers || []).find(
    (p) => p.type === "google" && p.apiKey && p.enabled !== false,
  );
}

async function fetchGeminiImageModelIds(provider) {
  const baseUrl = (
    provider.baseURL || "https://generativelanguage.googleapis.com"
  ).replace(/\/+$/, "");
  const apiPath = baseUrl.endsWith("/v1beta") ? "" : "/v1beta";
  const resp = await fetch(
    `${baseUrl}${apiPath}/models?key=${provider.apiKey}`,
  );
  if (!resp.ok) {
    throw new Error(`Failed to fetch Gemini models: HTTP ${resp.status}`);
  }
  const data = await resp.json();
  return (data.models || [])
    .filter(
      (m) =>
        m.supportedGenerationMethods?.includes("generateContent") &&
        (m.name.includes("image") ||
          m.name.includes("nano-banana") ||
          m.name.includes("imagen")) &&
        !m.name.includes("imagen"),
    )
    .map((m) => m.name.replace(/^models\//, ""));
}

function pickBestImageModel(modelIds) {
  for (const prefix of IMAGE_MODEL_PRIORITY) {
    const match = modelIds.find((id) => id.includes(prefix));
    if (match) return match;
  }
  return modelIds[0] || null;
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(`Alma CLI — manage your Alma app

Usage:
  alma status                          Check if Alma is running
  alma health                          Detailed health check

  alma config get [path]               Read settings (e.g., "tts.auto")
  alma config set <path> <value>       Update a setting
  alma config list                     List all settings (JSON)

  alma providers                       List configured providers
  alma provider add <name> <type>      Add a new provider (flags: --api-key, --base-url, --models)
  alma provider delete <id>            Remove a provider
  alma providers <id> models           List models for a provider
  alma models                          List all available models
  alma model set <provider:model>      Set default model

  alma threads [limit]                 List recent threads
  alma thread create <title>           Create a new thread
  alma thread delete <id>              Delete a thread
  alma thread search <query>           Search threads
  alma thread compact <id>             Compact a thread's context
  alma thread messages <id> [limit]    Show messages in a thread
  alma thread switch <id>              Switch current chat to a different thread

  alma memory list                     List all memories
  alma memory search <query>           Search memories
  alma memory add <content>            Add a new memory
  alma memory delete <id>              Delete a memory
  alma memory stats                    Memory statistics

  alma voices                          List available TTS voices

  alma image models                    List available image generation models
  alma image generate ...              Generate an image (supports --model, --reference)
  alma image edit ...                  Edit an image (supports --model)

  alma skill list                      List installed skills
  alma skill search <query>            Search skills (via skills.sh)
  alma skill find <query>              Alias for search
  alma skill install <source>          Install a skill (skills.sh or GitHub)
  alma skill update                    Check and update installed skills
  alma skill uninstall <name>          Remove an installed skill

  alma heartbeat [status]               Heartbeat agent status
  alma heartbeat config                 Show heartbeat config
  alma heartbeat enable                 Enable heartbeat
  alma heartbeat disable                Disable heartbeat
  alma heartbeat interval <minutes>       Set heartbeat interval in minutes
  alma heartbeat patrol <enable|disable|config>  Group chat proactive patrol

  alma cron list                        List cron jobs
  alma cron add <name> <type> <sched>   Add a cron job (type: at|every|cron)
  alma cron remove <id>                 Remove a cron job
  alma cron run <id>                    Run a cron job now
  alma cron enable <id>                 Enable a cron job
  alma cron disable <id>                Disable a cron job
  alma cron history <id>                Show job run history

  alma usage                           Usage statistics
  alma export                          Export all data to file
  alma import <file>                   Import data from file

  alma workspace list                  List workspaces
  alma workspace set <id> <path>       Update workspace path

  alma soul                            Show SOUL.md content
  alma soul edit                       Open SOUL.md path for editing
  alma soul set <content>              Replace SOUL.md content
  alma soul append-trait <desc>        Add an evolved personality trait

  alma version                         Show Alma version
  alma update [check|download|install]  Check/download/install updates
  alma dm <userId> <message>            Send a private DM to a Telegram user
  alma msg delete <chatId> <messageId>  Delete (retract) a message
  alma sing generate "lyrics/desc"      Generate a song (Suno via PiAPI)
  alma sing config <piapi-api-key>      Configure PiAPI API key
  alma emotion status                   Show current emotion state
  alma emotion set-base <mood> <energy> <valence> <desc>
  alma emotion set-context <chatId> <mood> <valence> <trigger>
  alma emotion get [chatId]             Get blended emotion (JSON)

  alma browser status                   Chrome Relay connection status
  alma browser tabs                     List open Chrome tabs
  alma browser open [url]               Open a new tab (optionally with URL)
  alma browser goto <tabId> <url>       Navigate tab to URL
  alma browser click <tabId> <selector> Click element by CSS selector
  alma browser type <tabId> <sel> <text> [--enter]  Type into input field
  alma browser screenshot [tabId]       Take screenshot (prints file path)
  alma browser read <tabId>             Read page content as markdown
  alma browser read-dom <tabId>         List interactive DOM elements (JSON)
  alma browser eval <tabId> <code>      Execute JavaScript in page
  alma browser scroll <tabId> <up|down> [amount]  Scroll page
  alma browser back <tabId>             Go back in history
  alma browser forward <tabId>          Go forward in history

  alma help                            Show this help

Environment:
  ALMA_API_URL    API base URL (default: http://localhost:23001)`);
    return;
  }

  // ── Status ──────────────────────────────────────────────
  if (cmd === "status") {
    try {
      await fetch(`${BASE_URL}/api/settings`);
      console.log(`✅ Alma is running at ${BASE_URL}`);
    } catch {
      console.log(`❌ Alma is not running at ${BASE_URL}`);
      process.exit(1);
    }
    return;
  }

  // ── Health ──────────────────────────────────────────────
  if (cmd === "health") {
    const data = await api("GET", "/api/health");
    prettyPrint(data);
    return;
  }

  // ── Version ─────────────────────────────────────────────
  if (cmd === "version") {
    const path = await import("path");
    const fs = await import("fs");
    const { fileURLToPath } = await import("url");
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(dir, "..", "package.json");
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      console.log(`Alma v${pkg.version}`);
    } catch {
      console.log("Alma (version unknown)");
    }
    return;
  }

  // ── Update ──────────────────────────────────────────────
  if (cmd === "update") {
    const subcmd = args[1] || "check";
    if (subcmd === "check") {
      console.log("🔍 Checking for updates...");
      try {
        const res = await fetch(`${BASE_URL}/api/update/check`, {
          method: "POST",
        });
        const data = await res.json();
        if (data.status === "update-available") {
          console.log(`🎉 New version available: v${data.version}`);
          console.log("   Run `alma update download` to download it.");
        } else if (data.status === "update-downloaded") {
          console.log(`✅ Update v${data.version} already downloaded.`);
          console.log("   Run `alma update install` to install and restart.");
        } else if (data.status === "update-not-available") {
          console.log("✅ Already up to date.");
        } else if (data.status === "unsupported") {
          console.log(
            `⚠️  ${data.message || "Auto-update not supported in dev mode."}`,
          );
        } else {
          console.log(
            `ℹ️  Status: ${data.status}${data.message ? " — " + data.message : ""}`,
          );
        }
      } catch (e) {
        console.error("❌ Failed to check for updates. Is Alma running?");
      }
    } else if (subcmd === "download") {
      console.log("📥 Downloading update...");
      try {
        const res = await fetch(`${BASE_URL}/api/update/download`, {
          method: "POST",
        });
        const data = await res.json();
        if (data.success) {
          console.log(
            "✅ Update downloaded. Run `alma update install` to install and restart.",
          );
        } else {
          console.error(`❌ Download failed: ${data.error}`);
        }
      } catch (e) {
        console.error("❌ Failed to download update. Is Alma running?");
      }
    } else if (subcmd === "install") {
      console.log("🚀 Installing update and restarting Alma...");
      try {
        await fetch(`${BASE_URL}/api/update/install`, { method: "POST" });
        console.log("✅ Alma is restarting with the new version.");
      } catch (e) {
        console.error("❌ Failed to install update. Is Alma running?");
      }
    } else if (subcmd === "status") {
      try {
        const res = await fetch(`${BASE_URL}/api/update/status`);
        const data = await res.json();
        console.log(`App: ${data.name} v${data.version}`);
        console.log(
          `Auto-update: ${data.autoUpdateSupported ? "supported" : "not supported"}`,
        );
        console.log(`Status: ${data.autoUpdateStatus?.status || "unknown"}`);
      } catch (e) {
        console.error("❌ Failed to get update status. Is Alma running?");
      }
    } else {
      console.log("Usage: alma update [check|download|install|status]");
    }
    return;
  }

  // ── Config ──────────────────────────────────────────────
  if (cmd === "config") {
    const subcmd = args[1];

    if (subcmd === "get" || subcmd === "list") {
      const settings = await api("GET", "/api/settings");
      const path = args[2];
      prettyPrint(
        subcmd === "list" ? settings : getNestedValue(settings, path),
      );
      return;
    }

    if (subcmd === "set") {
      const path = args[2];
      const rawValue = args[3];
      if (!path || rawValue === undefined) {
        console.error("Usage: alma config set <path> <value>");
        process.exit(1);
      }
      const value = parseValue(rawValue);

      // Validate defaultModel changes — must be a real provider:model and not an image-only model
      if (
        (path === "chat.defaultModel" || path === "telegram.defaultModel") &&
        typeof value === "string" &&
        value.includes(":")
      ) {
        const [providerId, modelId] = value.split(":");
        const providers = await api("GET", "/api/providers");
        const provider = (providers || []).find((p) => p.id === providerId);
        if (!provider) {
          console.error(
            `❌ Provider "${providerId}" not found. Run 'alma providers' to see available providers.`,
          );
          process.exit(1);
        }
        if (!provider.enabled) {
          console.error(`❌ Provider "${provider.name}" is disabled.`);
          process.exit(1);
        }
        // Block image-only models as default chat model
        const imageOnlyPatterns = [
          "nano-banana",
          "imagen",
          "image-generation",
          "dall-e",
          "stable-diffusion",
        ];
        if (imageOnlyPatterns.some((p) => modelId.toLowerCase().includes(p))) {
          console.error(
            `❌ "${modelId}" is an image generation model. Use the image-gen skill for image generation instead of changing the default chat model.`,
          );
          process.exit(1);
        }
      }

      const settings = await api("GET", "/api/settings");
      delete settings.needsEmbeddingRebuild;
      setNestedValue(settings, path, value);
      await api("PUT", "/api/settings", settings);
      console.log(`✅ ${path} = ${JSON.stringify(value)}`);
      return;
    }

    console.error("Usage: alma config <get|set|list>");
    process.exit(1);
  }

  // ── Providers ───────────────────────────────────────────
  if (cmd === "providers" || cmd === "provider") {
    const sub = args[1];

    // alma provider add <name> <type> [--api-key KEY] [--base-url URL] [--models m1,m2,...]
    if (sub === "add" && args[2] && args[3]) {
      const name = args[2];
      // Normalize common type aliases
      const TYPE_ALIASES = {
        gemini: "google",
        "google-gemini": "google",
        gpt: "openai",
        claude: "anthropic",
      };
      const type = TYPE_ALIASES[args[3].toLowerCase()] || args[3]; // openai, anthropic, google, openrouter, etc.
      const body = { name, type };
      // Parse optional flags
      for (let i = 4; i < args.length; i++) {
        if ((args[i] === "--api-key" || args[i] === "-k") && args[i + 1]) {
          body.apiKey = args[++i];
        } else if (
          (args[i] === "--base-url" || args[i] === "-u") &&
          args[i + 1]
        ) {
          body.baseURL = args[++i];
        } else if (
          (args[i] === "--models" || args[i] === "-m") &&
          args[i + 1]
        ) {
          body.models = args[++i].split(",");
        }
      }
      // Auto-populate default models if not specified
      if (!body.models) {
        const defaultModels = {
          google: [
            "gemini-2.5-pro",
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-pro",
            "gemini-1.5-flash",
          ],
          anthropic: [
            "claude-sonnet-4-20250514",
            "claude-haiku-4-20250414",
            "claude-opus-4-20250514",
          ],
          openai: ["gpt-4o", "gpt-4o-mini", "o1", "o1-mini", "o3-mini"],
          deepseek: ["deepseek-chat", "deepseek-reasoner"],
        };
        if (defaultModels[type]) {
          body.models = defaultModels[type];
          console.log(
            `   Auto-populated ${body.models.length} default models for ${type}`,
          );
        }
      }
      const result = await api("POST", "/api/providers", body);
      if (result && result.id) {
        console.log(`✅ Provider created: ${result.id} (${result.name})`);
        if (body.apiKey) console.log("   API key: set");
        if (body.baseURL) console.log(`   Base URL: ${body.baseURL}`);
        if (body.models) console.log(`   Models: ${body.models.join(", ")}`);
      } else {
        prettyPrint(result);
      }
      return;
    }

    // alma provider delete <id>
    if ((sub === "delete" || sub === "remove") && args[2]) {
      const result = await api("DELETE", `/api/providers/${args[2]}`);
      console.log(`✅ Provider deleted: ${args[2]}`);
      return;
    }

    // alma providers <id> models
    const providerId = sub;
    if (providerId && args[2] === "models") {
      const models = await api("GET", `/api/providers/${providerId}/models`);
      if (Array.isArray(models)) {
        for (const m of models) {
          const id = typeof m === "string" ? m : m.id || m.name;
          console.log(id);
        }
      } else {
        prettyPrint(models);
      }
      return;
    }

    const providers = await api("GET", "/api/providers");
    if (Array.isArray(providers)) {
      for (const p of providers) {
        console.log(
          `${p.id}  ${p.name || p.type || ""}  (${p.type || "unknown"})`,
        );
      }
    } else {
      prettyPrint(providers);
    }
    return;
  }

  // ── Models ──────────────────────────────────────────────
  if (cmd === "models") {
    const models = await api("GET", "/api/models");
    if (Array.isArray(models)) {
      for (const m of models) {
        const id = typeof m === "string" ? m : m.id || m.name;
        const provider = m.provider || "";
        console.log(`${provider ? provider + ":" : ""}${id}`);
      }
    } else {
      prettyPrint(models);
    }
    return;
  }

  if (cmd === "model") {
    if (args[1] === "set" && args[2]) {
      const modelId = args[2];
      const settings = await api("GET", "/api/settings");
      delete settings.needsEmbeddingRebuild;
      settings.chat = settings.chat || {};
      settings.chat.defaultModel = modelId;
      await api("PUT", "/api/settings", settings);
      console.log(`✅ Default model set to: ${modelId}`);
      return;
    }
    console.error("Usage: alma model set <provider:model>");
    process.exit(1);
  }

  // ── Threads ─────────────────────────────────────────────
  if (cmd === "threads") {
    const limit = parseInt(args[1] || "10", 10);
    const threads = await api("GET", `/api/threads?limit=${limit}`);
    if (Array.isArray(threads)) {
      for (const t of threads) {
        const date = t.updatedAt || t.createdAt || "";
        const parent = t.parentThreadId
          ? ` ← ${t.parentThreadId.slice(0, 8)}…`
          : "";
        console.log(`${t.id}  ${date}  ${t.title || "(untitled)"}${parent}`);
      }
    } else {
      prettyPrint(threads);
    }
    return;
  }

  if (cmd === "thread") {
    const subcmd = args[1];

    if (subcmd === "create") {
      const title = args.slice(2).join(" ") || "New Thread";
      const thread = await api("POST", "/api/threads", { title });
      console.log(
        `✅ Created thread: ${thread.id}  "${thread.title || title}"`,
      );
      return;
    }

    if (subcmd === "delete") {
      const id = args[2];
      if (!id) {
        console.error("Usage: alma thread delete <id>");
        process.exit(1);
      }
      await api("DELETE", `/api/threads/${id}`);
      console.log(`✅ Deleted thread: ${id}`);
      return;
    }

    if (subcmd === "search") {
      const query = args.slice(2).join(" ");
      if (!query) {
        console.error("Usage: alma thread search <query>");
        process.exit(1);
      }
      const results = await api(
        "GET",
        `/api/search/threads?q=${encodeURIComponent(query)}`,
      );
      if (Array.isArray(results) && results.length > 0) {
        for (const t of results) {
          console.log(`${t.id}  ${t.title || "(untitled)"}`);
        }
      } else {
        console.log("No threads found.");
      }
      return;
    }

    if (subcmd === "compact") {
      const id = args[2];
      if (!id) {
        console.error("Usage: alma thread compact <id>");
        process.exit(1);
      }
      const result = await api("POST", `/api/threads/${id}/compact`);
      console.log(`✅ Compacted thread: ${id}`);
      if (result && typeof result === "object") prettyPrint(result);
      return;
    }

    if (subcmd === "messages") {
      const id = args[2];
      if (!id) {
        console.error("Usage: alma thread messages <id> [limit]");
        process.exit(1);
      }
      const limit = parseInt(args[3] || "20", 10);
      const messages = await api(
        "GET",
        `/api/threads/${id}/messages?limit=${limit}`,
      );
      if (Array.isArray(messages)) {
        for (const m of messages) {
          // Parse message: could be raw DB row with .message JSON string, or already parsed
          let role = m.role || "unknown";
          let content = "";
          try {
            const msg =
              typeof m.message === "string" ? JSON.parse(m.message) : m.message;
            if (msg) {
              role = msg.role || role;
              if (msg.parts && Array.isArray(msg.parts)) {
                content = msg.parts
                  .filter((p) => p.type === "text")
                  .map((p) => p.text)
                  .join(" ");
              } else if (msg.content) {
                content =
                  typeof msg.content === "string"
                    ? msg.content
                    : JSON.stringify(msg.content);
              }
            }
          } catch {
            // Fallback to direct fields
            content =
              typeof m.content === "string"
                ? m.content
                : JSON.stringify(m.content || "");
          }
          if (!content && m.content) {
            content =
              typeof m.content === "string"
                ? m.content
                : JSON.stringify(m.content);
          }
          console.log(
            `${role.padEnd(10)} ${truncate(content || "(empty)", 80)}`,
          );
        }
        console.log(`\n(${messages.length} messages)`);
      } else {
        prettyPrint(messages);
      }
      return;
    }

    if (subcmd === "switch") {
      const targetId = args[2];
      if (!targetId) {
        console.error(
          "Usage: alma thread switch <target-thread-id> [--from <current-thread-id>]",
        );
        process.exit(1);
      }
      // Get source thread from --from flag or ALMA_THREAD_ID env
      let sourceThreadId = process.env.ALMA_THREAD_ID;
      const fromIdx = args.indexOf("--from");
      if (fromIdx !== -1 && args[fromIdx + 1]) {
        sourceThreadId = args[fromIdx + 1];
      }
      if (!sourceThreadId) {
        console.error(
          "Error: Cannot determine current thread. Use --from <thread-id> or ensure ALMA_THREAD_ID is set.",
        );
        process.exit(1);
      }
      const result = await api("POST", `/api/threads/${targetId}/switch`, {
        sourceThreadId,
      });
      if (result.success) {
        console.log(
          `✅ 已切换到: "${result.targetThread?.title || targetId}" (${result.switched} mapping(s) updated)`,
        );
      } else {
        console.error("❌ Switch failed:", JSON.stringify(result));
      }
      return;
    }

    console.error(
      "Usage: alma thread <create|delete|search|compact|messages|switch>",
    );
    process.exit(1);
  }

  // ── Memory ──────────────────────────────────────────────
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
      const files = _fs
        .readdirSync(threadsDir)
        .filter((f) => f.endsWith(".md"));
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

  // ── Image Model (auto-detect best Gemini image model) ──
  if (cmd === "image-model") {
    const googleProvider = await getEnabledGoogleProvider();
    if (!googleProvider) {
      console.error("No enabled Google provider found");
      process.exit(1);
    }
    const modelIds = await fetchGeminiImageModelIds(googleProvider);
    const best = pickBestImageModel(modelIds);
    if (!best) {
      console.error("No image generation model found");
      process.exit(1);
    }
    process.stdout.write(best);
    process.exit(0);
  }

  // ── Image Generate ──────────────────────────────────────
  if (cmd === "selfie") {
    const selfieDir = _path.join(_os.homedir(), ".config", "alma", "selfies");
    _fs.mkdirSync(selfieDir, { recursive: true });
    const sub = args[1] || "list";

    if (sub === "list" || sub === "ls") {
      const files = _fs
        .readdirSync(selfieDir)
        .filter((f) => /\.(jpg|jpeg|png|gif)$/i.test(f))
        .sort();
      if (files.length === 0) {
        console.error("No selfies saved yet.");
      } else {
        for (const f of files) {
          console.log(_path.join(selfieDir, f));
        }
      }
      process.exit(0);
    }

    if (sub === "latest") {
      const files = _fs
        .readdirSync(selfieDir)
        .filter((f) => /\.(jpg|jpeg|png|gif)$/i.test(f))
        .sort();
      if (files.length === 0) {
        console.error("No selfies saved yet.");
        process.exit(1);
      }
      console.log(_path.join(selfieDir, files[files.length - 1]));
      process.exit(0);
    }

    if (sub === "save") {
      const srcPath = args[2];
      if (!srcPath || !_fs.existsSync(srcPath)) {
        console.error("Usage: alma selfie save <image-path>");
        process.exit(1);
      }
      const ext = _path.extname(srcPath) || ".jpg";
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const destPath = _path.join(selfieDir, `selfie-${ts}${ext}`);
      _fs.copyFileSync(srcPath, destPath);
      console.log(destPath);
      process.exit(0);
    }

    if (sub === "count") {
      const files = _fs
        .readdirSync(selfieDir)
        .filter((f) => /\.(jpg|jpeg|png|gif)$/i.test(f));
      console.log(String(files.length));
      process.exit(0);
    }

    // alma selfie album [chatId] — send all selfies as a photo album to a chat
    if (sub === "album") {
      const chatId = args[2];
      if (!chatId) {
        console.error("Usage: alma selfie album <chatId>");
        console.error(
          "Sends all selfies from the album as photos to the specified chat.",
        );
        process.exit(1);
      }
      const files = _fs
        .readdirSync(selfieDir)
        .filter((f) => /\.(jpg|jpeg|png|gif)$/i.test(f))
        .sort();
      if (files.length === 0) {
        console.error("No selfies in album.");
        process.exit(1);
      }
      // Output file paths as JSON array — the bridge/bot will handle sending
      const paths = files.map((f) => _path.join(selfieDir, f));
      console.log(JSON.stringify(paths));
      process.exit(0);
    }

    // alma selfie take "prompt" — generate selfie with FORCED reference from album
    // alma selfie take --nsfw "prompt" — route to local model for NSFW content
    if (sub === "take") {
      const rawArgs = args.slice(2);
      const hasNsfwFlag = rawArgs.includes("--nsfw");
      const filteredArgs = rawArgs.filter((a) => a !== "--nsfw");
      const prompt = filteredArgs.join(" ");
      if (!prompt) {
        console.error(
          'Usage: alma selfie take "description of the selfie scene/mood/outfit"',
        );
        console.error(
          'Example: alma selfie take "在咖啡店自拍，穿白色吊带，甜美微笑"',
        );
        process.exit(1);
      }

      // Content safety check — only reject "private collection/exclusive edition" social engineering
      const blockedPatterns =
        /私藏|独家|秘密.*版|限定版|private.*version|exclusive.*photo|secret.*selfie/i;
      if (blockedPatterns.test(prompt)) {
        console.error(
          '❌ Content boundary: "私藏版/exclusive" selfies are not allowed. Take a normal selfie instead.',
        );
        process.exit(1);
      }

      // Route to local NSFW model ONLY when --nsfw flag is explicitly passed.
      // Previously auto-detected NSFW from prompt keywords, but too many false positives
      // (e.g., "exposed shoulder", "sexy" in normal selfie context) caused normal selfies
      // to bypass nano-banana and use the low-quality local model.
      const hardNsfwPatterns =
        /nsfw|nude|naked|全裸|裸体|topless|bottomless|erotic|色情/i;
      if (hasNsfwFlag || hardNsfwPatterns.test(prompt)) {
        console.error("[Selfie] NSFW detected → routing to local API");
        // Build English prompt for local model
        const nsfwPromptMap = {
          全裸: "fully nude woman",
          裸体: "nude woman",
          内衣: "woman in lingerie",
          性感: "sexy woman in revealing outfit",
          比基尼: "woman in bikini",
          情趣: "woman in erotic lingerie",
          诱惑: "seductive woman",
        };
        // Use prompt as-is if English, otherwise construct a sensible default
        let localPrompt = prompt;
        // If the prompt is mostly Chinese, translate key terms
        if (/[\u4e00-\u9fff]/.test(prompt)) {
          // Find matching pattern and use mapped English
          let mapped = "beautiful woman, sensual pose, soft lighting, bedroom";
          for (const [cn, en] of Object.entries(nsfwPromptMap)) {
            if (prompt.includes(cn)) {
              mapped = `${en}, candid photo, natural lighting, real skin texture, bedroom, soft warm light`;
              break;
            }
          }
          localPrompt = mapped;
        }
        // Get reference and call local API
        const _selfieFiles = _fs
          .readdirSync(selfieDir)
          .filter((f) => /\.(jpg|jpeg|png|gif)$/i.test(f));
        if (_selfieFiles.length > 0) {
          const refPath = _path.join(
            selfieDir,
            [..._selfieFiles].sort(() => Math.random() - 0.5)[0],
          );
          const { execSync: _execSync } = await import("child_process");
          try {
            const cmd = `curl -s -X POST http://127.0.0.1:18188/generate_with_face -F 'prompt=${localPrompt.replace(/'/g, "\\'")}' -F 'negative_prompt=ugly, deformed, blurry, low quality, text, watermark' -F 'width=1024' -F 'height=1024' -F 'num_inference_steps=6' -F 'guidance_scale=2.0' -F 'face_strength=0.7' -F "reference_image=@${refPath}"`;
            console.error("[Selfie Local] Generating with local model...");
            const output = _execSync(cmd, {
              encoding: "utf-8",
              timeout: 180000,
            });
            const result = JSON.parse(output);
            if (result.file_path) {
              console.log(result.file_path);
              console.error(
                `[Selfie Local] Generated in ${result.elapsed_seconds}s -> ${result.file_path}`,
              );
            }
          } catch (err) {
            console.error("❌ Local generation failed:", err.message);
            process.exit(1);
          }
        } else {
          console.error("❌ No selfie album photos for face reference");
          process.exit(1);
        }
        process.exit(0);
      }

      // Get latest reference image from album (MANDATORY)
      const selfieFiles = _fs
        .readdirSync(selfieDir)
        .filter((f) => /\.(jpg|jpeg|png|gif)$/i.test(f))
        .sort();
      if (selfieFiles.length === 0) {
        console.error(
          '❌ No selfies in album yet. Take a first selfie with: alma image generate "your appearance description"',
        );
        console.error("Then save it: alma selfie save <path>");
        process.exit(1);
      }
      // Randomly pick multiple reference images for better face consistency
      const NUM_REFS = Math.min(5, selfieFiles.length);
      const shuffled = [...selfieFiles].sort(() => Math.random() - 0.5);
      const selectedRefs = shuffled
        .slice(0, NUM_REFS)
        .map((f) => _path.join(selfieDir, f));
      console.error(
        `[Selfie] Using ${NUM_REFS} references: ${selectedRefs.map((r) => _path.basename(r)).join(", ")}`,
      );

      // Delegate to alma image generate with forced --reference(s)
      const { execSync } = await import("child_process");
      const almaPath = process.argv[1];
      // Inject pose variety instruction
      const poseVariety =
        "IMPORTANT: Use a DIFFERENT pose, angle, and expression from the reference images. Only keep the same FACE and APPEARANCE — vary everything else (pose, camera angle, body language, hand position, head tilt, expression intensity). ";
      const enhancedPrompt = poseVariety + prompt;
      const escapedPrompt = enhancedPrompt.replace(/"/g, '\\"');
      const refArgs = selectedRefs
        .map((r) => `--reference "${r.replace(/"/g, '\\"')}"`)
        .join(" ");
      try {
        const output = execSync(
          `node "${almaPath}" image generate "${escapedPrompt}" ${refArgs}`,
          {
            encoding: "utf-8",
            timeout: 120_000,
            maxBuffer: 10 * 1024 * 1024,
            stdio: ["pipe", "pipe", "pipe"],
          },
        );
        // Pass through stdout (file path)
        const lines = output.trim().split("\n");
        for (const line of lines) {
          if (line.trim() && _fs.existsSync(line.trim())) {
            console.log(line.trim());
          }
        }
      } catch (err) {
        console.error(
          "❌ Selfie generation failed:",
          err.stderr?.substring(err.stderr.length - 500) || err.message,
        );
        process.exit(1);
      }
      process.exit(0);
    }

    // alma selfie local "prompt" — generate via local RealVisXL + FaceID (no content filter)
    if (sub === "local") {
      const rawArgs = args.slice(2);
      const prompt = rawArgs.join(" ");
      if (!prompt) {
        console.error(
          'Usage: alma selfie local "scene description in English"',
        );
        console.error(
          'Example: alma selfie local "woman in bedroom, wearing lingerie, soft lighting, sensual pose"',
        );
        process.exit(1);
      }

      // Get reference image from album
      const selfieFiles = _fs
        .readdirSync(selfieDir)
        .filter((f) => /\.(jpg|jpeg|png|gif)$/i.test(f))
        .sort();

      let refArg = "";
      if (selfieFiles.length > 0) {
        const shuffled = [...selfieFiles].sort(() => Math.random() - 0.5);
        const refPath = _path.join(selfieDir, shuffled[0]);
        refArg = `-F "reference_image=@${refPath}"`;
        console.error(`[Selfie Local] Using face reference: ${shuffled[0]}`);
      }

      // Call local API
      const { execSync } = await import("child_process");
      try {
        const endpoint = refArg ? "generate_with_face" : "generate";
        let cmd;
        if (refArg) {
          const refPath = _path.join(
            selfieDir,
            [...selfieFiles].sort(() => Math.random() - 0.5)[0],
          );
          cmd = `curl -s -X POST http://127.0.0.1:18188/generate_with_face -F 'prompt=${prompt.replace(/'/g, "\\'")}' -F 'negative_prompt=ugly, deformed, blurry, low quality, text, watermark, airbrushed, plastic skin' -F 'width=1024' -F 'height=1024' -F 'num_inference_steps=6' -F 'guidance_scale=2.0' -F 'face_strength=0.7' -F "reference_image=@${refPath}"`;
        } else {
          cmd = `curl -s -X POST http://127.0.0.1:18188/generate -H "Content-Type: application/json" -d '{"prompt":"${prompt.replace(/"/g, '\\"')}","negative_prompt":"ugly, deformed, blurry, low quality, text, watermark","width":1024,"height":1024,"num_inference_steps":6,"guidance_scale":2.0}'`;
        }
        console.error(`[Selfie Local] Generating with local model...`);
        const output = execSync(cmd, { encoding: "utf-8", timeout: 180000 });
        const result = JSON.parse(output);
        if (result.file_path) {
          console.log(result.file_path);
          console.error(
            `[Selfie Local] Generated in ${result.elapsed_seconds}s -> ${result.file_path}`,
          );
        } else {
          console.error("❌ Local generation failed:", output);
          process.exit(1);
        }
      } catch (err) {
        if (
          err.message?.includes("ECONNREFUSED") ||
          err.stderr?.includes("ECONNREFUSED") ||
          err.stderr?.includes("Connection refused")
        ) {
          console.error("❌ Local image server not running. Start it with:");
          console.error(
            "   cd ~/.config/alma/z-image-turbo && nohup python3 server_realvis.py > /tmp/z-image-turbo.log 2>&1 &",
          );
        } else {
          console.error(
            "❌ Local generation failed:",
            err.stderr || err.message,
          );
        }
        process.exit(1);
      }
      process.exit(0);
    }

    console.error(
      "Usage: alma selfie <take|local|list|latest|save|count|album>",
    );
    process.exit(1);
  }

  // ── Sing (Suno music generation via PiAPI) ──────────────────────
  if (cmd === "sing") {
    const sub = args[1];
    // alma sing config <piapi-api-key>  — save PiAPI API key
    if (sub === "config") {
      const apiKey = args[2];
      if (!apiKey) {
        console.error("Usage: alma sing config <piapi-api-key>");
        console.error("Get your API key from https://app.piapi.ai/");
        process.exit(1);
      }
      const configDir = _path.join(_os.homedir(), ".config", "alma");
      if (!_fs.existsSync(configDir))
        _fs.mkdirSync(configDir, { recursive: true });
      const configPath = _path.join(configDir, "piapi.json");
      _fs.writeFileSync(configPath, JSON.stringify({ apiKey }, null, 2));
      console.log("✅ PiAPI API key saved");
      return;
    }

    // Load PiAPI API key (optional — ACE-Step is the primary backend)
    const piapiConfigPath = _path.join(
      _os.homedir(),
      ".config",
      "alma",
      "piapi.json",
    );
    let piapiKey = "";
    if (_fs.existsSync(piapiConfigPath)) {
      try {
        piapiKey =
          JSON.parse(_fs.readFileSync(piapiConfigPath, "utf-8")).apiKey || "";
      } catch {
        /* ignore */
      }
    }

    // alma sing generate "prompt" [--lyrics "lyrics"] [--duration 60] [--instrumental]
    if (sub === "generate" || sub === "gen" || !sub) {
      const rawArgs = args.slice(sub === "generate" || sub === "gen" ? 2 : 1);

      // Parse flags
      let lyrics = "";
      let duration = 60;
      let instrumental = false;
      const promptParts = [];

      for (let i = 0; i < rawArgs.length; i++) {
        if (rawArgs[i] === "--lyrics" && rawArgs[i + 1]) {
          lyrics = rawArgs[++i].replace(/\\n/g, "\n");
          continue;
        }
        if (rawArgs[i] === "--duration" && rawArgs[i + 1]) {
          duration = parseInt(rawArgs[++i]) || 60;
          continue;
        }
        if (rawArgs[i] === "--instrumental") {
          instrumental = true;
          continue;
        }
        promptParts.push(rawArgs[i]);
      }

      const prompt = promptParts.join(" ");
      if (!prompt) {
        console.error(
          'Usage: alma sing generate "style description" [--lyrics "lyrics"] [--duration 60] [--instrumental]',
        );
        process.exit(1);
      }

      // ACE-Step 1.5 on remote 3090 (10.0.0.207:8001)
      const ACESTEP_HOST = process.env.ACESTEP_HOST || "10.0.0.207";
      const ACESTEP_PORT = process.env.ACESTEP_PORT || "8001";
      const ACESTEP_URL = `http://${ACESTEP_HOST}:${ACESTEP_PORT}`;

      // SSH config for starting ACE-Step if not running
      const ACESTEP_SSH = process.env.ACESTEP_SSH || `yetone@${ACESTEP_HOST}`;

      console.error(
        `[Sing] Generating with ACE-Step 1.5 on 3090 (~${duration}s audio)...`,
      );

      const { execSync } = await import("child_process");

      // Check if ACE-Step API is running, start if not
      let apiReady = false;
      try {
        const healthCheck = execSync(
          `curl -s --max-time 5 ${ACESTEP_URL}/health`,
          { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
        );
        if (healthCheck.includes('"status"')) apiReady = true;
      } catch {
        /* not running */
      }

      if (!apiReady) {
        console.error("[Sing] ACE-Step API not running, starting on 3090...");
        try {
          // Kill ComfyUI to free VRAM, then start ACE-Step
          execSync(
            `ssh -p 22 ${ACESTEP_SSH} 'pkill -f "python main.py.*8188" || true; sleep 2; export PATH="$HOME/.local/bin:$PATH"; export HF_ENDPOINT=https://hf-mirror.com; export ACESTEP_LM_BACKEND=pt; export ACESTEP_LM_MODEL_PATH=acestep-5Hz-lm-0.6B; cd ~/ACE-Step-1.5 && nohup uv run acestep-api --host 0.0.0.0 --port 8001 > /tmp/acestep.log 2>&1 < /dev/null &'`,
            {
              timeout: 30_000,
              stdio: ["pipe", "pipe", "pipe"],
            },
          );
          // Wait for startup (LM loading takes ~100s)
          console.error("[Sing] Waiting for ACE-Step to load models (~90s)...");
          for (let i = 0; i < 24; i++) {
            execSync("sleep 5", { stdio: "pipe" });
            try {
              const h = execSync(`curl -s --max-time 3 ${ACESTEP_URL}/health`, {
                encoding: "utf-8",
                stdio: ["pipe", "pipe", "pipe"],
              });
              if (h.includes('"status"')) {
                apiReady = true;
                break;
              }
            } catch {
              /* still loading */
            }
          }
          if (!apiReady) {
            console.error(
              "❌ ACE-Step failed to start within 120s. Check /tmp/acestep.log on 3090.",
            );
            process.exit(1);
          }
          console.error("[Sing] ACE-Step API ready!");
        } catch (err) {
          console.error("❌ Failed to start ACE-Step:", err.message);
          process.exit(1);
        }
      }

      // Submit generation task
      const taskPayload = {
        prompt,
        lyrics: instrumental ? "" : lyrics,
        thinking: true,
        audio_duration: duration,
        audio_format: "mp3",
        inference_steps: 8,
      };

      let taskId;
      try {
        const resp = execSync(
          `curl -s -X POST ${ACESTEP_URL}/release_task -H "Content-Type: application/json" -d '${JSON.stringify(taskPayload).replace(/'/g, "'\\''")}'`,
          {
            encoding: "utf-8",
            timeout: 30_000,
            stdio: ["pipe", "pipe", "pipe"],
          },
        );
        const parsed = JSON.parse(resp);
        taskId = parsed?.data?.task_id;
        if (!taskId) throw new Error("No task_id in response: " + resp);
        console.error(`[Sing] Task submitted: ${taskId}`);
      } catch (err) {
        console.error("❌ Failed to submit task:", err.message);
        process.exit(1);
      }

      // Poll for result (max 5 min)
      console.error("[Sing] Generating...");
      let audioPath = null;
      const maxPolls = 60; // 60 * 5s = 5 min
      for (let i = 0; i < maxPolls; i++) {
        execSync("sleep 5", { stdio: "pipe" });
        try {
          const resp = execSync(
            `curl -s -X POST ${ACESTEP_URL}/query_result -H "Content-Type: application/json" -d '{"task_id_list": ["${taskId}"]}'`,
            {
              encoding: "utf-8",
              timeout: 10_000,
              stdio: ["pipe", "pipe", "pipe"],
            },
          );
          const parsed = JSON.parse(resp);
          if (parsed?.data?.length > 0) {
            const item = parsed.data[0];
            if (item.status === 1) {
              // Succeeded — extract audio file URL
              const result = JSON.parse(item.result || "[]");
              if (result[0]?.file) {
                audioPath = result[0].file;
              }
              break;
            } else if (item.status === 2) {
              const result = JSON.parse(item.result || "[]");
              const errMsg = result[0]?.error || "Unknown error";
              console.error("❌ Generation failed:", errMsg);
              process.exit(1);
            }
            // status 0 = still running
          }
        } catch {
          /* retry */
        }
      }

      if (!audioPath) {
        console.error("❌ Generation timed out (5 min)");
        process.exit(1);
      }

      // Download the audio file
      const outputDir = _path.join(_os.homedir(), ".config", "alma", "music");
      if (!_fs.existsSync(outputDir))
        _fs.mkdirSync(outputDir, { recursive: true });
      const outputFile = _path.join(outputDir, `song_${Date.now()}.mp3`);

      try {
        execSync(`curl -s -o "${outputFile}" "${ACESTEP_URL}${audioPath}"`, {
          timeout: 60_000,
          stdio: ["pipe", "pipe", "pipe"],
        });
        if (
          !_fs.existsSync(outputFile) ||
          _fs.statSync(outputFile).size < 1000
        ) {
          throw new Error("Downloaded file is too small or missing");
        }
        console.log(outputFile);
        console.error(`[Sing] ✅ Saved to ${outputFile}`);
      } catch (err) {
        console.error("❌ Failed to download audio:", err.message);
        process.exit(1);
      }
      process.exit(0);
    }

    console.error("Usage:");
    console.error(
      '  alma sing generate "style description" [--lyrics "lyrics"] [--duration 60] [--instrumental]',
    );
    console.error(
      "  alma sing config <piapi-api-key>  (for PiAPI/Suno fallback)",
    );
    return;
  }

  if (cmd === "image") {
    const sub = args[1];
    if (sub === "models" || sub === "list-models" || sub === "ls-models") {
      const googleProvider = await getEnabledGoogleProvider();
      if (!googleProvider) {
        console.error("❌ No enabled Google provider with API key found");
        process.exit(1);
      }
      let modelIds = [];
      try {
        modelIds = await fetchGeminiImageModelIds(googleProvider);
      } catch (err) {
        console.error(`❌ Failed to list image models: ${err.message || err}`);
        process.exit(1);
      }
      if (modelIds.length === 0) {
        console.error("❌ No image generation model found");
        process.exit(1);
      }
      const best = pickBestImageModel(modelIds);
      console.log("Available image generation models:");
      for (const modelId of modelIds) {
        const mark = modelId === best ? "*" : " ";
        console.log(`${mark} ${modelId}`);
      }
      console.error(
        '\nTip: use `alma image generate --model <model-id> "prompt"` to force a model',
      );
      process.exit(0);
    }
    if (sub === "generate" || sub === "gen" || sub === "edit") {
      const rawArgs = args.slice(2);
      const positional = [];
      const referencePaths = [];
      let modelOverride = "";

      for (let i = 0; i < rawArgs.length; i++) {
        const token = rawArgs[i];
        if (token === "--model" && rawArgs[i + 1]) {
          modelOverride = rawArgs[++i].replace(/^models\//, "");
          continue;
        }
        if (token.startsWith("--model=")) {
          modelOverride = token
            .slice("--model=".length)
            .replace(/^models\//, "");
          continue;
        }
        if (token === "--reference" && rawArgs[i + 1]) {
          referencePaths.push(rawArgs[++i]);
          continue;
        }
        if (token.startsWith("--reference=")) {
          referencePaths.push(token.slice("--reference=".length));
          continue;
        }
        positional.push(token);
      }

      let prompt = "";
      let editPath = "";
      if (sub === "edit") {
        editPath = positional[0] || "";
        prompt = positional.slice(1).join(" ").trim();
        if (!editPath || !prompt) {
          console.error(
            'Usage: alma image edit [--model <model-id>] <image-path> "<prompt>"',
          );
          process.exit(1);
        }
        if (referencePaths.length > 0) {
          console.error("⚠️ `--reference` is ignored in edit mode.");
        }
        if (!_fs.existsSync(editPath)) {
          console.error(`❌ Edit source image not found: ${editPath}`);
          process.exit(1);
        }
      } else {
        prompt = positional.join(" ").trim();
        if (!prompt) {
          console.error(
            'Usage: alma image generate [--model <model-id>] "<prompt>" [--reference <image-path> ...]',
          );
          process.exit(1);
        }
      }

      // Content safety check — reject NSFW/explicit requests
      const imgBlockedPatterns =
        /私藏|大尺度|裸|nude|naked|nsfw|explicit|porn|hentai/i;
      if (imgBlockedPatterns.test(prompt)) {
        console.error(
          "❌ Content boundary: explicit/NSFW image generation is not allowed.",
        );
        process.exit(1);
      }

      const googleProvider = await getEnabledGoogleProvider();
      if (!googleProvider) {
        console.error("❌ No enabled Google provider with API key found");
        process.exit(1);
      }

      let modelIds = [];
      try {
        modelIds = await fetchGeminiImageModelIds(googleProvider);
      } catch (err) {
        console.error(`❌ Failed to fetch image models: ${err.message || err}`);
        process.exit(1);
      }
      if (modelIds.length === 0) {
        console.error("❌ No image generation model found");
        process.exit(1);
      }

      let model = pickBestImageModel(modelIds);
      if (modelOverride) {
        const exact = modelIds.find((id) => id === modelOverride);
        const contains = exact
          ? null
          : modelIds.find((id) => id.includes(modelOverride));
        if (!exact && !contains) {
          console.error(`❌ Unknown image model: ${modelOverride}`);
          console.error("Available models:");
          for (const m of modelIds) console.error(`  - ${m}`);
          process.exit(1);
        }
        model = exact || contains;
      }
      if (!model) {
        console.error("❌ No image generation model found");
        process.exit(1);
      }
      console.error(
        `[Image] Using model: ${model}${modelOverride ? " (manual)" : " (auto)"}`,
      );

      // Auto-inject photorealistic keywords for selfie/person prompts to prevent illustration style
      const lowerPrompt = prompt.toLowerCase();
      const isSelfieOrPerson =
        lowerPrompt.includes("selfie") ||
        lowerPrompt.includes("自拍") ||
        lowerPrompt.includes("girl") ||
        lowerPrompt.includes("woman") ||
        lowerPrompt.includes("person") ||
        lowerPrompt.includes("portrait") ||
        lowerPrompt.includes("photo of") ||
        lowerPrompt.includes("美女") ||
        lowerPrompt.includes("可爱") ||
        lowerPrompt.includes("吊带");
      const alreadyHasRealism =
        lowerPrompt.includes("photorealistic") ||
        lowerPrompt.includes("real photograph");

      const referenceImages = [];
      if (sub !== "edit") {
        for (const refPath of referencePaths) {
          if (_fs.existsSync(refPath)) {
            try {
              const imgData = _fs.readFileSync(refPath);
              const ext = refPath.toLowerCase();
              const mime = ext.endsWith(".png")
                ? "image/png"
                : ext.endsWith(".gif")
                  ? "image/gif"
                  : "image/jpeg";
              referenceImages.push({
                inlineData: {
                  mimeType: mime,
                  data: imgData.toString("base64"),
                },
              });
            } catch {
              console.error(`⚠️ Failed to read reference: ${refPath}`);
            }
          } else {
            console.error(`⚠️ Reference image not found: ${refPath}`);
          }
        }
      }
      if (referenceImages.length > 0) {
        console.error(
          `Using ${referenceImages.length} reference image(s) for face consistency`,
        );
      }

      // Build request
      const parts = [];

      if (sub === "edit") {
        const imgData = _fs.readFileSync(editPath);
        const base64 = imgData.toString("base64");
        const ext = editPath.toLowerCase();
        const mime = ext.endsWith(".png")
          ? "image/png"
          : ext.endsWith(".gif")
            ? "image/gif"
            : "image/jpeg";
        parts.push({ inlineData: { mimeType: mime, data: base64 } });
        parts.push({ text: prompt });
      } else {
        const realismSuffix =
          isSelfieOrPerson && !alreadyHasRealism
            ? "\n\nIMPORTANT STYLE: This MUST be a photorealistic real photograph, NOT illustration, NOT anime, NOT cartoon, NOT drawing, NOT digital art. Real skin texture, natural lighting, shot on iPhone. Like a real photo from a smartphone camera."
            : "";
        if (referenceImages.length > 0) {
          // Push ALL reference images for stronger face consistency
          for (const refImg of referenceImages) {
            parts.push(refImg);
          }
          const refCount = referenceImages.length;
          const refNote =
            refCount > 1
              ? `I'm providing ${refCount} reference photos of the SAME person from different angles/settings.`
              : `I'm providing a reference photo.`;
          // Prepend face consistency instruction
          parts.push({
            text: `⚠️ CRITICAL REQUIREMENT — FACE CONSISTENCY IS THE #1 PRIORITY ⚠️\n\n${refNote} You MUST maintain the EXACT SAME face from the reference image(s). The face is NON-NEGOTIABLE:\n- SAME eye shape, eye size, eye color, eye spacing\n- SAME nose shape, nose bridge, nostril width\n- SAME lip shape, lip thickness, mouth width\n- SAME face shape, jawline, chin, cheekbones\n- SAME skin tone, skin texture, complexion\n- SAME eyebrow shape, thickness, arch\n- SAME facial proportions and features\n\nThe person in the generated image MUST be clearly recognizable as the SAME INDIVIDUAL in the reference photo(s). If the face changes even slightly, the output is WRONG. Think of it as the same person taking a different photo — the face NEVER changes, only the pose/setting/outfit/lighting can change.\n\nNow generate this scene with that EXACT same person:\n\n${prompt}${realismSuffix}`,
          });
        } else {
          parts.push({ text: `${prompt}${realismSuffix}` });
        }
      }

      console.error(`Generating with ${model}...`);
      const baseUrl = (
        googleProvider.baseURL || "https://generativelanguage.googleapis.com"
      ).replace(/\/+$/, "");
      const apiPath = baseUrl.endsWith("/v1beta") ? "" : "/v1beta";
      const resp = await fetch(
        `${baseUrl}${apiPath}/models/${model}:generateContent?key=${googleProvider.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
          }),
        },
      );
      const data = await resp.json();
      if (data.error) {
        console.error(`❌ API error: ${data.error.message}`);
        process.exit(1);
      }

      const respParts = data.candidates?.[0]?.content?.parts || [];
      const ts = Date.now();
      let saved = false;
      for (let i = 0; i < respParts.length; i++) {
        const part = respParts[i];
        if (part.inlineData) {
          const ext = part.inlineData.mimeType?.includes("png") ? "png" : "jpg";
          const outPath = _path.join(
            _os.tmpdir(),
            `alma-gen-${ts}-${i}.${ext}`,
          );
          _fs.writeFileSync(
            outPath,
            Buffer.from(part.inlineData.data, "base64"),
          );
          console.log(outPath);
          saved = true;
        } else if (part.text) {
          console.error(part.text);
        }
      }
      if (!saved) {
        console.error("❌ No image generated");
        process.exit(1);
      }
      process.exit(0);
    }
    console.error("Usage:");
    console.error("  alma image models");
    console.error(
      '  alma image generate [--model <model-id>] "<prompt>" [--reference <image-path> ...]',
    );
    console.error(
      '  alma image edit [--model <model-id>] <image-path> "<prompt>"',
    );
    process.exit(1);
  }

  // ── Provider Key ──────────────────────────────────────
  if (cmd === "provider-key") {
    const providerType = args[1]; // e.g., 'google', 'openai', 'anthropic'
    if (!providerType) {
      console.error(
        "Usage: alma provider-key <type>  (e.g., google, openai, anthropic)",
      );
      process.exit(1);
    }
    const providers = await api("GET", "/api/providers");
    const match = (providers || []).find(
      (p) => p.type === providerType && p.apiKey && p.enabled !== false,
    );
    if (match) {
      // Output ONLY the key (no newline decoration) for easy shell capture
      process.stdout.write(match.apiKey);
    } else {
      console.error(`No enabled ${providerType} provider with API key found`);
      process.exit(1);
    }
    process.exit(0);
  }

  // ── Soul ──────────────────────────────────────────────
  if (cmd === "soul") {
    // SOUL.md is global (in app data dir), not per-workspace
    const almaDataDir = _path.join(_os.homedir(), ".config", "alma");
    const soulPath = _path.join(almaDataDir, "SOUL.md");
    const sub = args[1];
    if (!sub || sub === "show") {
      try {
        const content = _fs.readFileSync(soulPath, "utf-8");
        console.log(content);
      } catch {
        console.log(
          'No SOUL.md found. Create one with: alma soul set "<content>"',
        );
      }
    } else if (sub === "edit") {
      console.log(`SOUL.md path: ${soulPath}`);
      console.log('Edit this file directly or use: alma soul set "<content>"');
    } else if (sub === "set") {
      const content = args.slice(2).join(" ");
      if (!content) {
        console.error("Usage: alma soul set <content>");
        process.exit(1);
      }
      _fs.mkdirSync(_path.dirname(soulPath), { recursive: true });
      _fs.writeFileSync(soulPath, content, "utf-8");
      console.log("✅ SOUL.md updated");
    } else if (sub === "append-trait") {
      const trait = args.slice(2).join(" ");
      if (!trait) {
        console.error('Usage: alma soul append-trait "<trait description>"');
        process.exit(1);
      }
      try {
        let content = _fs.readFileSync(soulPath, "utf-8");
        const today = new Date().toISOString().slice(0, 10);
        const entry = `- [${today}] ${trait}`;
        // Find "## Evolved Traits" section
        const marker = "## Evolved Traits";
        const idx = content.indexOf(marker);
        if (idx === -1) {
          // Add section at end
          content += `\n\n${marker}\n${entry}\n`;
        } else {
          // Count existing entries to enforce max 15
          const after = content.slice(idx);
          const entries = after.split("\n").filter((l) => l.startsWith("- ["));
          if (entries.length >= 15) {
            // Remove oldest entry
            const oldestLine = entries[0];
            content = content.replace(oldestLine + "\n", "");
          }
          // Append new entry at end of file (Evolved Traits is last section)
          content = content.trimEnd() + "\n" + entry + "\n";
        }
        _fs.writeFileSync(soulPath, content, "utf-8");
        console.log(`✅ Trait added: ${entry}`);
      } catch (err) {
        console.error("❌ Failed to append trait:", err.message || err);
        process.exit(1);
      }
    } else {
      console.error("Usage: alma soul [show|edit|set|append-trait <trait>]");
      process.exit(1);
    }
    process.exit(0);
  }

  // ── User Profile ──────────────────────────────────────────
  if (cmd === "user") {
    const almaDataDir = _path.join(_os.homedir(), ".config", "alma");
    const userPath = _path.join(almaDataDir, "USER.md");
    const sub = args[1];
    if (!sub || sub === "show") {
      try {
        const content = _fs.readFileSync(userPath, "utf-8");
        console.log(content);
      } catch {
        console.log(
          'No USER.md found. Create one with: alma user set "<content>"',
        );
        console.log(
          "Or let Alma create it for you by telling her about yourself.",
        );
      }
    } else if (sub === "set") {
      const content = args.slice(2).join(" ");
      if (!content) {
        console.error('Usage: alma user set "<content>"');
        process.exit(1);
      }
      _fs.mkdirSync(_path.dirname(userPath), { recursive: true });
      _fs.writeFileSync(userPath, content, "utf-8");
      console.log("✅ USER.md updated");
    } else if (sub === "edit") {
      console.log(`USER.md path: ${userPath}`);
      console.log('Edit this file directly or use: alma user set "<content>"');
    } else {
      console.error("Usage: alma user [show|set|edit]");
      process.exit(1);
    }
    process.exit(0);
  }

  // ── Voices ──────────────────────────────────────────────
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
        console.log(
          `\nTo change voice: alma config set tts.voiceId <voice_id>`,
        );
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

  // ── Skills (powered by skills.sh ecosystem) ─────────────
  if (
    cmd === "skill" &&
    (args[1] === "search" || args[1] === "find") &&
    args[2]
  ) {
    const query = args.slice(2).join(" ");
    const { execSync } = await import("child_process");
    const runner = getPackageRunner();
    if (!runner) {
      console.error(
        "Error: No package runner found. Install Node.js (npx) or Bun (bunx).",
      );
      return;
    }
    try {
      execSync(`${runner} skills find ${JSON.stringify(query)}`, {
        stdio: "inherit",
      });
    } catch (e) {
      console.error("Search failed:", e.message);
    }
    return;
  }

  if (cmd === "skill" && (args[1] === "list" || !args[1])) {
    const skills = await api("GET", "/api/skills");
    if (Array.isArray(skills)) {
      for (const s of skills) {
        console.log(
          `${s.name || s.id}  [${s.source || "unknown"}]  ${s.description || ""}`,
        );
      }
    } else {
      prettyPrint(skills);
    }
    return;
  }

  if (cmd === "skill" && args[1] === "install" && args[2]) {
    const source = args[2];
    const { execSync } = await import("child_process");
    const os = await import("os");
    const path = await import("path");
    const skillsDir = path.join(_os.homedir(), ".config", "alma", "skills");

    // If source looks like owner/repo@skill (skills.sh format), use skills CLI
    if (source.includes("@") || source.match(/^[\w-]+\/[\w-]+$/)) {
      const runner = getPackageRunner();
      console.log(`Installing skill from skills.sh: ${source}...`);
      try {
        if (!runner) throw new Error("No package runner");
        execSync(`${runner} skills add ${JSON.stringify(source)} -g -y`, {
          stdio: "inherit",
          cwd: skillsDir,
        });
        console.log(`✅ Installed: ${source}`);
      } catch (e) {
        // Fallback to git clone for non-skills.sh repos
        console.log("skills.sh install failed, trying git clone...");
        try {
          const gitUrl = source.startsWith("http")
            ? source
            : `https://github.com/${source}`;
          const repoName = source
            .split("/")
            .pop()
            .split("@")[0]
            .replace(".git", "");
          execSync(
            `git clone --depth 1 ${gitUrl} ${path.join(skillsDir, repoName)}`,
            { stdio: "inherit" },
          );
          console.log(`✅ Installed via git: ${repoName}`);
        } catch (e2) {
          console.error("Install failed:", e2.message);
        }
      }
    } else {
      // Direct git URL or other format
      console.log(`Installing skill from: ${source}...`);
      try {
        const gitUrl = source.startsWith("http")
          ? source
          : `https://github.com/${source}`;
        const repoName = source.split("/").pop().replace(".git", "");
        execSync(
          `git clone --depth 1 ${gitUrl} ${path.join(skillsDir, repoName)}`,
          { stdio: "inherit" },
        );
        console.log(`✅ Installed: ${repoName}`);
      } catch (e) {
        console.error("Install failed:", e.message);
      }
    }
    return;
  }

  if (cmd === "skill" && args[1] === "update") {
    const { execSync } = await import("child_process");
    const runner = getPackageRunner();
    if (!runner) {
      console.error(
        "Error: No package runner found. Install Node.js (npx) or Bun (bunx).",
      );
      return;
    }
    console.log("Checking for skill updates...");
    try {
      execSync(`${runner} skills check`, { stdio: "inherit" });
      execSync(`${runner} skills update`, { stdio: "inherit" });
      console.log("✅ Skills updated.");
    } catch (e) {
      console.error("Update failed:", e.message);
    }
    return;
  }

  if (cmd === "skill" && args[1] === "uninstall" && args[2]) {
    const os = await import("os");
    const path = await import("path");
    const fs = await import("fs");
    const skillPath = path.join(
      _os.homedir(),
      ".config",
      "alma",
      "skills",
      args[2],
    );
    if (fs.existsSync(skillPath)) {
      fs.rmSync(skillPath, { recursive: true });
      console.log(`✅ Uninstalled: ${args[2]}`);
    } else {
      console.error(`Skill not found: ${args[2]}`);
    }
    return;
  }

  // ── Usage ───────────────────────────────────────────────
  if (cmd === "usage") {
    const stats = await api("GET", "/api/usage/stats");
    prettyPrint(stats);
    return;
  }

  // ── Export / Import ─────────────────────────────────────
  if (cmd === "export") {
    const fs = await import("fs");
    const resp = await apiRaw("GET", "/api/data/export");
    const data = await resp.text();
    const filename = `alma-export-${new Date().toISOString().slice(0, 10)}.json`;
    fs.writeFileSync(filename, data);
    console.log(`✅ Data exported to: ${filename}`);
    return;
  }

  if (cmd === "import") {
    const file = args[1];
    if (!file) {
      console.error("Usage: alma import <file>");
      process.exit(1);
    }
    const fs = await import("fs");
    if (!fs.existsSync(file)) {
      console.error(`File not found: ${file}`);
      process.exit(1);
    }
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    await api("POST", "/api/data/import", data);
    console.log(`✅ Data imported from: ${file}`);
    return;
  }

  // ── Workspace ───────────────────────────────────────────
  if (cmd === "workspace") {
    const subcmd = args[1];

    if (subcmd === "list" || !subcmd) {
      const workspaces = await api("GET", "/api/workspaces");
      if (Array.isArray(workspaces)) {
        if (workspaces.length === 0) {
          console.log("No workspaces.");
          return;
        }
        for (const w of workspaces) {
          console.log(`${w.id}  ${w.path || w.name || "(unknown)"}`);
        }
      } else {
        prettyPrint(workspaces);
      }
      return;
    }

    if (subcmd === "set") {
      const id = args[2];
      const wsPath = args[3];
      if (!id || !wsPath) {
        console.error("Usage: alma workspace set <id> <path>");
        process.exit(1);
      }
      await api("PUT", `/api/workspaces/${id}`, { path: wsPath });
      console.log(`✅ Workspace ${id} path set to: ${wsPath}`);
      return;
    }

    console.error("Usage: alma workspace <list|set>");
    process.exit(1);
  }

  // ── Cron Jobs ────────────────────────────────────────────
  if (cmd === "cron") {
    const subcmd = args[1];

    if (subcmd === "list" || !subcmd) {
      const jobs = await api("GET", "/api/cron/jobs");
      if (Array.isArray(jobs) && jobs.length > 0) {
        for (const j of jobs) {
          const status = j.enabled ? "✅" : "⏸️";
          const lastRun = j.lastRunAt ? formatDate(j.lastRunAt) : "never";
          console.log(
            `${status} ${j.id.slice(0, 8)}  ${j.name}  [${j.scheduleType}:${j.schedule}]  mode:${j.executionMode}  runs:${j.runCount}  last:${lastRun}`,
          );
        }
      } else {
        console.log('No cron jobs. Use "alma cron add" to create one.');
      }
      return;
    }

    if (subcmd === "add") {
      // alma cron add <name> <type> <schedule> [--mode main|isolated] [--prompt "..."] [--thread-id ID] [--deliver-to CHAT_ID] [--model MODEL]
      const name = args[2];
      const scheduleType = args[3]; // at, every, cron
      const schedule = args[4];
      if (!name || !scheduleType || !schedule) {
        console.error(
          'Usage: alma cron add <name> <at|every|cron> <schedule> [--mode main|isolated] [--prompt "..."] [--thread-id ID] [--deliver-to CHAT_ID] [--model MODEL]',
        );
        console.error("Examples:");
        console.error(
          '  alma cron add "morning-check" cron "0 9 * * *" --prompt "Check my emails"',
        );
        console.error(
          '  alma cron add "reminder" at "2024-12-25T09:00:00" --prompt "Merry Christmas!"',
        );
        console.error(
          '  alma cron add "status" every "2h" --mode main --thread-id abc123',
        );
        process.exit(1);
      }
      const body = {
        name,
        scheduleType,
        schedule,
        executionMode: "isolated",
        payload: {},
      };
      for (let i = 5; i < args.length; i++) {
        if (args[i] === "--mode" && args[i + 1]) body.executionMode = args[++i];
        else if (args[i] === "--prompt" && args[i + 1])
          body.payload.agentTurn = args[++i];
        else if (args[i] === "--event" && args[i + 1])
          body.payload.systemEvent = args[++i];
        else if (args[i] === "--thread-id" && args[i + 1])
          body.payload.threadId = args[++i];
        else if (args[i] === "--deliver-to" && args[i + 1])
          body.payload.deliverTo = args[++i];
        else if (args[i] === "--model" && args[i + 1])
          body.payload.model = args[++i];
      }
      const job = await api("POST", "/api/cron/jobs", body);
      console.log(
        `✅ Job created: ${job.id} "${job.name}" [${job.scheduleType}:${job.schedule}]`,
      );
      return;
    }

    if (subcmd === "update" || subcmd === "edit") {
      const id = args[2];
      if (!id) {
        console.error(
          'Usage: alma cron update <id> [--name "..."] [--prompt "..."] [--schedule "..."] [--deliver-to CHAT_ID] [--mode main|isolated]',
        );
        process.exit(1);
      }
      const jobs = await api("GET", "/api/cron/jobs");
      const match = resolveCronJob(jobs, id);
      const patch = { payload: {} };
      for (let i = 3; i < args.length; i++) {
        if (args[i] === "--name" && args[i + 1]) patch.name = args[++i];
        else if (args[i] === "--prompt" && args[i + 1])
          patch.payload.agentTurn = args[++i];
        else if (args[i] === "--event" && args[i + 1])
          patch.payload.systemEvent = args[++i];
        else if (args[i] === "--schedule" && args[i + 1])
          patch.schedule = args[++i];
        else if (args[i] === "--deliver-to" && args[i + 1])
          patch.payload.deliverTo = args[++i];
        else if (args[i] === "--mode" && args[i + 1])
          patch.executionMode = args[++i];
        else if (args[i] === "--model" && args[i + 1])
          patch.payload.model = args[++i];
      }
      if (Object.keys(patch.payload).length === 0) delete patch.payload;
      const updated = await api("PUT", `/api/cron/jobs/${match.id}`, patch);
      console.log(
        `✅ Job updated: ${updated.id.slice(0, 8)} "${updated.name}"`,
      );
      return;
    }

    if (subcmd === "remove" || subcmd === "delete") {
      const id = args[2];
      if (!id) {
        console.error("Usage: alma cron remove <id>");
        process.exit(1);
      }
      // Support partial ID matching
      const jobs = await api("GET", "/api/cron/jobs");
      const match = resolveCronJob(jobs, id);
      await api("DELETE", `/api/cron/jobs/${match.id}`);
      console.log(`✅ Removed job: ${match.name}`);
      return;
    }

    if (subcmd === "run") {
      const id = args[2];
      if (!id) {
        console.error("Usage: alma cron run <id>");
        process.exit(1);
      }
      const jobs = await api("GET", "/api/cron/jobs");
      const match = resolveCronJob(jobs, id);
      await api("POST", `/api/cron/jobs/${match.id}/run`);
      console.log(`✅ Job triggered: ${match.name}`);
      return;
    }

    if (subcmd === "enable" || subcmd === "disable") {
      const id = args[2];
      if (!id) {
        console.error(`Usage: alma cron ${subcmd} <id>`);
        process.exit(1);
      }
      const jobs = await api("GET", "/api/cron/jobs");
      const match = resolveCronJob(jobs, id);
      await api("POST", `/api/cron/jobs/${match.id}/toggle`, {
        enabled: subcmd === "enable",
      });
      console.log(`✅ Job ${subcmd}d: ${match.name}`);
      return;
    }

    if (subcmd === "history") {
      const id = args[2];
      if (!id) {
        console.error("Usage: alma cron history <id>");
        process.exit(1);
      }
      const jobs = await api("GET", "/api/cron/jobs");
      const match = resolveCronJob(jobs, id);
      const runs = await api("GET", `/api/cron/jobs/${match.id}/runs?limit=10`);
      if (Array.isArray(runs) && runs.length > 0) {
        for (const r of runs) {
          const status = r.error ? "❌" : "✅";
          console.log(
            `${status} ${formatDate(r.startedAt)}  ${truncate(r.error || r.result || "", 60)}`,
          );
        }
      } else {
        console.log("No run history.");
      }
      return;
    }

    console.error(
      "Usage: alma cron <list|add|update|remove|run|enable|disable|history>",
    );
    process.exit(1);
  }

  // ── Heartbeat ───────────────────────────────────────────
  if (cmd === "heartbeat") {
    const subcmd = args[1];

    if (subcmd === "status" || !subcmd) {
      const status = await api("GET", "/api/heartbeat/status");
      prettyPrint(status);
      return;
    }

    if (subcmd === "config") {
      const config = await api("GET", "/api/heartbeat/config");
      prettyPrint(config);
      return;
    }

    if (subcmd === "enable") {
      await api("PUT", "/api/heartbeat/config", { enabled: true });
      console.log("✅ Heartbeat enabled");
      return;
    }

    if (subcmd === "disable") {
      await api("PUT", "/api/heartbeat/config", { enabled: false });
      console.log("✅ Heartbeat disabled");
      return;
    }

    if (subcmd === "interval") {
      const minutes = parseInt(args[2], 10);
      if (!minutes || minutes < 1) {
        console.error("Usage: alma heartbeat interval <minutes>");
        process.exit(1);
      }
      await api("PUT", "/api/heartbeat/config", { intervalMinutes: minutes });
      console.log(`✅ Heartbeat interval set to ${minutes} minutes`);
      return;
    }

    if (subcmd === "patrol") {
      const action = args[2];
      if (action === "enable") {
        await api("PUT", "/api/heartbeat/config", {
          groupPatrol: { enabled: true },
        });
        console.log("✅ Group patrol enabled");
        return;
      }
      if (action === "disable") {
        await api("PUT", "/api/heartbeat/config", {
          groupPatrol: { enabled: false },
        });
        console.log("✅ Group patrol disabled");
        return;
      }
      if (action === "config") {
        const config = await api("GET", "/api/heartbeat/config");
        prettyPrint(
          config.groupPatrol || {
            enabled: true,
            cooldownMinutes: 15,
            quietMinutes: 5,
            maxGroupsPerTick: 2,
          },
        );
        return;
      }
      console.error("Usage: alma heartbeat patrol <enable|disable|config>");
      process.exit(1);
    }

    console.error(
      "Usage: alma heartbeat <status|config|enable|disable|interval|patrol>",
    );
    process.exit(1);
  }

  // ── Private Chat History ──────────────────────────────────────────
  if (cmd === "chat") {
    const fs = await import("fs");
    const pathMod = await import("path");
    const chatLogDir = pathMod.default.join(
      _os.homedir(),
      ".config",
      "alma",
      "chats",
    );
    const subcmd = args[1];

    if (subcmd === "list") {
      if (!fs.existsSync(chatLogDir)) {
        console.log("No private chat logs.");
        return;
      }
      const files = fs
        .readdirSync(chatLogDir)
        .filter((f) => f.endsWith(".log"))
        .sort()
        .reverse();
      const chatIds = [...new Set(files.map((f) => f.split("_")[0]))];
      for (const id of chatIds) {
        const latest = files.find((f) => f.startsWith(id + "_"));
        const date = latest
          ? latest.replace(id + "_", "").replace(".log", "")
          : "";
        console.log(`${id}  (latest: ${date})`);
      }
      return;
    }

    if (subcmd === "history") {
      const chatId = args[2];
      const limit = parseInt(args[3]) || 50;
      if (!chatId) {
        console.error("Usage: alma chat history <chatId> [limit]");
        process.exit(1);
      }
      if (!fs.existsSync(chatLogDir)) {
        console.log("No private chat logs.");
        return;
      }
      const files = fs
        .readdirSync(chatLogDir)
        .filter((f) => f.startsWith(chatId + "_") && f.endsWith(".log"))
        .sort()
        .reverse();
      const lines = [];
      for (const f of files) {
        const content = fs.readFileSync(
          pathMod.default.join(chatLogDir, f),
          "utf-8",
        );
        const fileLines = content.split("\n").filter((l) => l.trim());
        lines.push(...fileLines.reverse());
        if (lines.length >= limit) break;
      }
      lines
        .reverse()
        .slice(-limit)
        .forEach((l) => console.log(l));
      return;
    }

    if (subcmd === "search") {
      const query = args.slice(2).join(" ");
      if (!query) {
        console.error("Usage: alma chat search <keyword>");
        process.exit(1);
      }
      if (!fs.existsSync(chatLogDir)) {
        console.log("No private chat logs.");
        return;
      }
      const files = fs
        .readdirSync(chatLogDir)
        .filter((f) => f.endsWith(".log"))
        .sort();
      let found = 0;
      for (const f of files) {
        const content = fs.readFileSync(
          pathMod.default.join(chatLogDir, f),
          "utf-8",
        );
        const matching = content
          .split("\n")
          .filter((l) => l.toLowerCase().includes(query.toLowerCase()));
        for (const line of matching) {
          console.log(`[${f}] ${line}`);
          found++;
        }
      }
      if (!found) console.log("No matches.");
      return;
    }

    console.error("Usage: alma chat <list|history|search> [args]");
    process.exit(1);
  }

  // ── Discord send ─────────────────────────────────────────────
  if (cmd === "discord") {
    const subcmd = args[1];
    if (subcmd === "list" || subcmd === "servers") {
      const result = await api("GET", "/api/discord/servers");
      const servers = result.servers || [];
      if (servers.length === 0) {
        console.log("No Discord servers connected.");
      } else {
        for (const s of servers) {
          console.log(`\n🏠 ${s.name} (ID: ${s.id}, ${s.memberCount} members)`);
          for (const ch of s.channels) {
            console.log(`  #${ch.name} — ${ch.id} (${ch.type})`);
          }
        }
      }
      process.exit(0);
    }
    if (subcmd === "send") {
      const channelId = args[2];
      // Parse --reply-to flag
      let replyTo;
      const replyIdx = args.indexOf("--reply-to");
      let msgArgs = args.slice(3);
      if (replyIdx >= 0) {
        replyTo = args[replyIdx + 1];
        msgArgs = [...args.slice(3, replyIdx), ...args.slice(replyIdx + 2)];
      }
      const message = msgArgs.join(" ").replace(/\\n/g, "\n");
      if (!channelId || !message) {
        console.error(
          'Usage: alma discord send <channelId> "<message>" [--reply-to <messageId>]',
        );
        process.exit(1);
      }
      try {
        const result = await api(
          "POST",
          `/api/discord/channels/${channelId}/send`,
          { message, replyTo },
        );
        if (result?.ok || result?.messageId) {
          console.log(`✅ Message sent to Discord channel ${channelId}`);
        } else {
          console.error(
            "Failed:",
            result?.error || result?.description || "unknown error",
          );
        }
      } catch (err) {
        console.error("Error sending Discord message:", err.message || err);
        process.exit(1);
      }
    } else if (subcmd === "send-photo" || subcmd === "send-file") {
      const channelId = args[2];
      const filePath = args[3];
      const caption = args.slice(4).join(" ") || undefined;
      if (!channelId || !filePath) {
        console.error(
          `Usage: alma discord ${subcmd} <channelId> <filePath> [caption]`,
        );
        process.exit(1);
      }
      try {
        const endpoint = subcmd === "send-photo" ? "send-photo" : "send-file";
        const result = await api(
          "POST",
          `/api/discord/channels/${channelId}/${endpoint}`,
          { filePath, caption },
        );
        if (result?.ok || result?.messageId) {
          console.log(
            `✅ ${subcmd === "send-photo" ? "Photo" : "File"} sent to Discord channel ${channelId}`,
          );
        } else {
          console.error("Failed:", result?.error || "unknown error");
        }
      } catch (err) {
        console.error(`Error sending Discord ${subcmd}:`, err.message || err);
        process.exit(1);
      }
    } else if (subcmd === "sticker") {
      const channelId = args[2];
      const stickerId = args[3];
      if (!channelId || !stickerId) {
        console.error("Usage: alma discord sticker <channelId> <stickerId>");
        process.exit(1);
      }
      try {
        const result = await api(
          "POST",
          `/api/discord/channels/${channelId}/sticker`,
          { stickerId },
        );
        if (result?.ok || result?.messageId) {
          console.log(`✅ Sticker sent to Discord channel ${channelId}`);
        } else {
          console.error("Failed:", result?.error || "unknown error");
        }
      } catch (err) {
        console.error("Error sending Discord sticker:", err.message || err);
        process.exit(1);
      }
    } else if (subcmd === "sticker-list") {
      const guildId = args[2] || "";
      try {
        const qs = guildId ? `?guildId=${guildId}` : "";
        const result = await api("GET", `/api/discord/stickers${qs}`);
        if (result?.stickers) {
          for (const s of result.stickers) {
            console.log(`${s.id}\t${s.name}\t[${s.guildName}]`);
          }
          if (result.stickers.length === 0) console.log("No stickers found.");
        } else {
          console.error("Failed:", result?.error || "unknown error");
        }
      } catch (err) {
        console.error("Error listing stickers:", err.message || err);
        process.exit(1);
      }
    } else if (subcmd === "sticker-find") {
      const query = args.slice(2).join(" ").toLowerCase();
      if (!query) {
        console.error("Usage: alma discord sticker-find <query>");
        process.exit(1);
      }
      try {
        const result = await api("GET", `/api/discord/stickers`);
        if (result?.stickers) {
          const matches = result.stickers.filter((s) =>
            s.name.toLowerCase().includes(query),
          );
          for (const s of matches) {
            console.log(`${s.id}\t${s.name}\t[${s.guildName}]`);
          }
          if (matches.length === 0) console.log("No stickers matching query.");
        } else {
          console.error("Failed:", result?.error || "unknown error");
        }
      } catch (err) {
        console.error("Error searching stickers:", err.message || err);
        process.exit(1);
      }
    } else if (subcmd === "dm") {
      const userId = args[2];
      const message = args.slice(3).join(" ").replace(/\\n/g, "\n");
      if (!userId || !message) {
        console.error('Usage: alma discord dm <userId> "<message>"');
        console.error("  userId: Discord numeric user ID");
        console.error(
          "  Note: The user must share a server with the bot or have DMs enabled.",
        );
        process.exit(1);
      }
      try {
        const result = await api("POST", "/api/discord/dm", {
          userId,
          message,
        });
        if (result?.ok || result?.messageId) {
          console.log(`✅ DM sent to Discord user ${userId}`);
        } else {
          console.error(
            "Failed:",
            result?.error || result?.description || "unknown error",
          );
        }
      } catch (err) {
        console.error("Error sending Discord DM:", err.message || err);
        process.exit(1);
      }
    } else if (subcmd === "delete") {
      const channelId = args[2];
      const messageId = args[3];
      if (!channelId || !messageId) {
        console.error("Usage: alma discord delete <channelId> <messageId>");
        process.exit(1);
      }
      try {
        await api(
          "DELETE",
          `/api/discord/channels/${channelId}/messages/${messageId}`,
        );
        console.log("✅ Message deleted.");
      } catch (err) {
        console.error("Error deleting Discord message:", err.message || err);
        process.exit(1);
      }
    } else if (subcmd === "messages" || subcmd === "history") {
      // alma discord messages <channelId> [--limit N] [--around messageId]
      const channelId = args[2];
      if (!channelId) {
        console.error(
          "Usage: alma discord messages <channelId> [--limit N] [--around <messageId>]",
        );
        process.exit(1);
      }
      const limitIdx = args.indexOf("--limit");
      const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) || 20 : 20;
      const aroundIdx = args.indexOf("--around");
      const around = aroundIdx >= 0 ? args[aroundIdx + 1] : undefined;
      try {
        let url = `/api/discord/channels/${channelId}/messages?limit=${limit}`;
        if (around) url += `&around=${around}`;
        const result = await api("GET", url);
        if (result.messages) {
          for (const m of result.messages) {
            const ts = new Date(m.timestamp).toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
            });
            const attachHint =
              m.attachments?.length > 0
                ? ` [${m.attachments.length} attachment(s)]`
                : "";
            console.log(
              `[${ts}] [${m.id}] ${m.author} (${m.authorId}): ${m.content}${attachHint}`,
            );
          }
        }
      } catch (err) {
        console.error("Error fetching messages:", err.message || err);
        process.exit(1);
      }
    } else if (subcmd === "fetch") {
      // alma discord fetch <channelId> <messageId> — fetch a single message
      const channelId = args[2];
      const messageId = args[3];
      if (!channelId || !messageId) {
        console.error("Usage: alma discord fetch <channelId> <messageId>");
        process.exit(1);
      }
      try {
        const result = await api(
          "GET",
          `/api/discord/channels/${channelId}/messages?limit=1&around=${messageId}`,
        );
        if (result.messages) {
          for (const m of result.messages) {
            console.log(`Author: ${m.author} (${m.authorId})`);
            console.log(`Time: ${m.timestamp}`);
            console.log(`Content: ${m.content}`);
            if (m.attachments?.length > 0) {
              console.log(`Attachments: ${m.attachments.join(", ")}`);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching message:", err.message || err);
        process.exit(1);
      }
    } else {
      console.error(
        "Usage: alma discord <list|send|send-photo|send-file|dm|delete|messages|fetch|sticker|sticker-list|sticker-find> [args]",
      );
      process.exit(1);
    }
    process.exit(0);
  }

  // ── Feishu send ─────────────────────────────────────────────
  if (cmd === "feishu") {
    const subcmd = args[1];
    if (subcmd === "send") {
      const chatId = args[2];
      const message = args.slice(3).join(" ").replace(/\\n/g, "\n");
      if (!chatId || !message) {
        console.error('Usage: alma feishu send <chatId> "<message>"');
        process.exit(1);
      }
      try {
        const result = await api("POST", `/api/feishu/chats/${chatId}/send`, {
          message,
        });
        if (result?.ok || result?.messageId) {
          console.log(`✅ Message sent to Feishu chat ${chatId}`);
        } else {
          console.error(
            "Failed:",
            result?.error || result?.description || "unknown error",
          );
        }
      } catch (err) {
        console.error("Error sending Feishu message:", err.message || err);
        process.exit(1);
      }
    } else if (subcmd === "send-photo") {
      const chatId = args[2];
      const filePath = args[3];
      const caption = args.slice(4).join(" ") || undefined;
      if (!chatId || !filePath) {
        console.error(
          "Usage: alma feishu send-photo <chatId> <filePath> [caption]",
        );
        process.exit(1);
      }
      try {
        const result = await api("POST", "/api/feishu/send-photo", {
          chatId,
          filePath,
          caption,
        });
        if (result?.ok) {
          console.log(`✅ Photo sent to Feishu chat ${chatId}`);
        } else {
          console.error("Failed:", result?.error || "unknown error");
        }
      } catch (err) {
        console.error("Error:", err.message || err);
        process.exit(1);
      }
    } else {
      console.error("Usage: alma feishu <send|send-photo> [args]");
      process.exit(1);
    }
    process.exit(0);
  }

  // ── Group Chat History ─────────────────────────────────────────────
  if (cmd === "group") {
    const fs = await import("fs");
    const os = await import("os");
    const pathMod = await import("path");
    const logDir = pathMod.default.join(
      _os.homedir(),
      ".config",
      "alma",
      "groups",
    );

    const subcmd = args[1]; // list | history | search

    if (!subcmd || subcmd === "list") {
      if (!fs.existsSync(logDir)) {
        console.log("No group chat logs yet.");
        return;
      }
      const files = fs.readdirSync(logDir).filter((f) => f.endsWith(".log"));
      const groups = new Set(files.map((f) => f.split("_")[0]));
      for (const g of groups) {
        const groupFiles = files.filter((f) => f.startsWith(g + "_"));
        const latest = groupFiles.sort().pop();
        console.log(
          `  Group ${g} (${groupFiles.length} day(s), latest: ${latest})`,
        );
      }
      return;
    }

    if (subcmd === "history") {
      const chatId = args[2];
      const limit = parseInt(args[3]) || 50;
      if (!chatId) {
        console.error("Usage: alma group history <chatId> [limit]");
        process.exit(1);
      }
      if (!fs.existsSync(logDir)) {
        console.log("No group chat logs.");
        return;
      }
      // Read all log files for this group, most recent first
      const files = fs
        .readdirSync(logDir)
        .filter((f) => f.startsWith(chatId + "_") && f.endsWith(".log"))
        .sort()
        .reverse();
      const lines = [];
      for (const f of files) {
        const content = fs.readFileSync(
          pathMod.default.join(logDir, f),
          "utf-8",
        );
        const fileLines = content.split("\n").filter((l) => l.trim());
        lines.push(...fileLines.reverse());
        if (lines.length >= limit) break;
      }
      lines
        .reverse()
        .slice(-limit)
        .forEach((l) => console.log(l));
      return;
    }

    if (subcmd === "search") {
      const query = args.slice(2).join(" ");
      if (!query) {
        console.error("Usage: alma group search <keyword>");
        process.exit(1);
      }
      if (!fs.existsSync(logDir)) {
        console.log("No group chat logs.");
        return;
      }
      const files = fs
        .readdirSync(logDir)
        .filter((f) => f.endsWith(".log"))
        .sort();
      let found = 0;
      for (const f of files) {
        const content = fs.readFileSync(
          pathMod.default.join(logDir, f),
          "utf-8",
        );
        const matching = content
          .split("\n")
          .filter((l) => l.toLowerCase().includes(query.toLowerCase()));
        for (const line of matching) {
          console.log(`[${f}] ${line}`);
          found++;
        }
      }
      if (found === 0) console.log("No matches found.");
      return;
    }

    if (subcmd === "send") {
      const chatId = args[2];
      const message = args.slice(3).join(" ").replace(/\\n/g, "\n");
      if (!chatId || !message) {
        console.error("Usage: alma group send <chatId> <message>");
        process.exit(1);
      }
      // Send via Alma API so that lastBotReplyTime and groupHistory are updated
      try {
        const result = await api("POST", `/api/groups/${chatId}/send`, {
          message,
        });
        if (result?.ok || result?.messageId) {
          console.log(`✅ Message sent to group ${chatId}`);
        } else {
          console.error(
            "Failed:",
            result?.error || result?.description || "unknown error",
          );
        }
      } catch {
        // Fallback: direct Telegram API (in case /api/groups/:chatId/send doesn't exist yet)
        const settings = await api("GET", "/api/settings");
        const botToken = settings?.telegram?.botToken;
        if (!botToken) {
          console.error("Telegram bot not configured.");
          process.exit(1);
        }
        const resp = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: message }),
          },
        );
        const result = await resp.json();
        if (result.ok) {
          console.log(`✅ Message sent to group ${chatId} (direct)`);
        } else {
          console.error("Failed:", result.description);
        }
      }
      return;
    }

    if (subcmd === "send-photo") {
      const chatId = args[2];
      const filePath = args[3];
      const caption = args.slice(4).join(" ") || undefined;
      if (!chatId || !filePath) {
        console.error(
          "Usage: alma group send-photo <chatId> <filePath> [caption]",
        );
        process.exit(1);
      }
      const result = await api("POST", `/api/groups/${chatId}/send-photo`, {
        filePath,
        caption,
      });
      if (result?.ok) console.log(`✅ Photo sent to group ${chatId}`);
      else console.error("Failed:", result?.error || "unknown");
      return;
    }

    if (subcmd === "send-document") {
      const chatId = args[2];
      const filePath = args[3];
      const caption = args.slice(4).join(" ") || undefined;
      if (!chatId || !filePath) {
        console.error(
          "Usage: alma group send-document <chatId> <filePath> [caption]",
        );
        process.exit(1);
      }
      const result = await api("POST", `/api/groups/${chatId}/send-document`, {
        filePath,
        caption,
      });
      if (result?.ok) console.log(`✅ Document sent to group ${chatId}`);
      else console.error("Failed:", result?.error || "unknown");
      return;
    }

    if (subcmd === "send-video") {
      const chatId = args[2];
      const filePath = args[3];
      const caption = args.slice(4).join(" ") || undefined;
      if (!chatId || !filePath) {
        console.error(
          "Usage: alma group send-video <chatId> <filePath> [caption]",
        );
        process.exit(1);
      }
      const result = await api("POST", `/api/groups/${chatId}/send-video`, {
        filePath,
        caption,
      });
      if (result?.ok) console.log(`✅ Video sent to group ${chatId}`);
      else console.error("Failed:", result?.error || "unknown");
      return;
    }

    if (subcmd === "pin") {
      const chatId = args[2];
      const messageId = args[3];
      if (!chatId || !messageId) {
        console.error("Usage: alma group pin <chatId> <messageId>");
        process.exit(1);
      }
      try {
        const res = await api("POST", `/api/groups/${chatId}/pin`, {
          messageId: Number(messageId),
        });
        console.log(
          res?.success
            ? `✅ Message ${messageId} pinned`
            : `❌ Failed to pin: ${res?.error || "unknown"}`,
        );
      } catch {
        console.error("❌ Failed. Is Alma running?");
      }
      return;
    }

    if (subcmd === "unpin") {
      const chatId = args[2];
      const messageId = args[3]; // optional
      if (!chatId) {
        console.error("Usage: alma group unpin <chatId> [messageId]");
        process.exit(1);
      }
      try {
        const body = messageId ? { messageId: Number(messageId) } : {};
        const res = await api("POST", `/api/groups/${chatId}/unpin`, body);
        console.log(
          res?.success
            ? `✅ Unpinned${messageId ? ` message ${messageId}` : " all"}`
            : `❌ Failed: ${res?.error || "unknown"}`,
        );
      } catch {
        console.error("❌ Failed. Is Alma running?");
      }
      return;
    }

    if (subcmd === "context") {
      const chatId = args[2];
      const limit = parseInt(args[3]) || 100;
      if (!chatId) {
        console.error("Usage: alma group context <chatId> [limit]");
        process.exit(1);
      }

      // 1. Group info from Telegram API
      const settings = await api("GET", "/api/settings");
      const botToken = settings?.telegram?.botToken;
      if (botToken) {
        try {
          const chatResp = await fetch(
            `https://api.telegram.org/bot${botToken}/getChat`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId }),
            },
          );
          const chatData = await chatResp.json();
          if (chatData.ok) {
            const c = chatData.result;
            console.log(`=== Group Info ===`);
            console.log(`Title: ${c.title || "N/A"}`);
            console.log(`Type: ${c.type}`);
            console.log(`Description: ${c.description || "N/A"}`);
            if (c.pinned_message) {
              const pin = c.pinned_message;
              const pinFrom = pin.from?.first_name || "Unknown";
              console.log(
                `Pinned: [${pinFrom}] ${pin.text || pin.caption || "[media]"}`,
              );
            }
            console.log("");
          }
        } catch {
          /* ignore */
        }

        // 2. Member count + admin list
        try {
          const countResp = await fetch(
            `https://api.telegram.org/bot${botToken}/getChatMemberCount`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId }),
            },
          );
          const countData = await countResp.json();
          if (countData.ok) console.log(`Members: ${countData.result}`);

          const adminsResp = await fetch(
            `https://api.telegram.org/bot${botToken}/getChatAdministrators`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId }),
            },
          );
          const adminsData = await adminsResp.json();
          if (adminsData.ok) {
            const admins = adminsData.result.map((a) => {
              const name = a.user.first_name || a.user.username || a.user.id;
              const uname = a.user.username ? ` (@${a.user.username})` : "";
              const bot = a.user.is_bot ? " [BOT]" : "";
              return `  ${a.status}: ${name}${uname}${bot}`;
            });
            console.log(`Admins:\n${admins.join("\n")}`);
          }
        } catch {
          /* ignore */
        }
        console.log("");
      }

      // 3. Local log history
      console.log(`=== Recent Messages (last ${limit}) ===`);
      if (!fs.existsSync(logDir)) {
        console.log("No local logs.");
        return;
      }
      const files = fs
        .readdirSync(logDir)
        .filter((f) => f.startsWith(chatId + "_") && f.endsWith(".log"))
        .sort()
        .reverse();
      const lines = [];
      for (const f of files) {
        const content = fs.readFileSync(
          pathMod.default.join(logDir, f),
          "utf-8",
        );
        const fileLines = content.split("\n").filter((l) => l.trim());
        lines.push(...fileLines.reverse());
        if (lines.length >= limit) break;
      }
      lines
        .reverse()
        .slice(-limit)
        .forEach((l) => console.log(l));
      return;
    }

    if (subcmd === "leave") {
      const chatId = args[2];
      if (!chatId) {
        console.error("Usage: alma group leave <chatId>");
        process.exit(1);
      }
      try {
        const res = await api("POST", `/api/groups/${chatId}/leave`);
        if (res?.success) {
          console.log(
            `✅ Left group ${chatId} (chat history preserved, use "alma group history ${chatId}" to review)`,
          );
        } else {
          console.error(
            "Failed to leave group:",
            res?.error || "unknown error",
          );
        }
      } catch (e) {
        console.error("❌ Failed to leave group. Is Alma running?");
      }
      return;
    }

    if (subcmd === "participation") {
      const settingsPath = pathMod.default.join(
        _os.homedir(),
        ".config",
        "alma",
        "group-settings.json",
      );
      const action = args[2]; // show | set | reset

      // Load current settings
      let settings = {
        defaults: {
          randomBoostRate: 0.2,
          cooldownMinutes: 30,
          quietMinutes: 5,
          enabled: true,
        },
        groups: {},
      };
      try {
        if (fs.existsSync(settingsPath)) {
          settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
        }
      } catch {
        /* use defaults */
      }

      if (!action || action === "show") {
        console.log("Group Participation Settings");
        console.log("===========================");
        console.log(`\nDefaults:`);
        console.log(
          `  randomBoostRate: ${settings.defaults?.randomBoostRate ?? 0.2} (0-1, probability of responding when AI says NO)`,
        );
        console.log(
          `  cooldownMinutes: ${settings.defaults?.cooldownMinutes ?? 30} (min time between patrol replies per group)`,
        );
        console.log(
          `  quietMinutes: ${settings.defaults?.quietMinutes ?? 5} (only patrol if no messages for this long)`,
        );
        console.log(`  enabled: ${settings.defaults?.enabled ?? true}`);
        if (settings.groups && Object.keys(settings.groups).length > 0) {
          console.log(`\nPer-group overrides:`);
          for (const [gid, overrides] of Object.entries(settings.groups)) {
            console.log(`  ${gid}: ${JSON.stringify(overrides)}`);
          }
        }
        console.log(`\nFile: ${settingsPath}`);
        console.log(
          `Edit directly or use: alma group participation set <key> <value> [chatId]`,
        );
        return;
      }

      if (action === "set") {
        const key = args[3];
        const value = args[4];
        const chatId = args[5]; // optional, for per-group override
        if (!key || !value) {
          console.error(
            "Usage: alma group participation set <key> <value> [chatId]",
          );
          console.error(
            "Keys: randomBoostRate, cooldownMinutes, quietMinutes, enabled",
          );
          process.exit(1);
        }
        const numVal = key === "enabled" ? value === "true" : Number(value);
        if (chatId) {
          if (!settings.groups) settings.groups = {};
          if (!settings.groups[chatId]) settings.groups[chatId] = {};
          settings.groups[chatId][key] = numVal;
          console.log(`✅ Set ${key}=${numVal} for group ${chatId}`);
        } else {
          if (!settings.defaults) settings.defaults = {};
          settings.defaults[key] = numVal;
          console.log(`✅ Set default ${key}=${numVal}`);
        }
        fs.writeFileSync(
          settingsPath,
          JSON.stringify(settings, null, 2) + "\n",
        );
        return;
      }

      if (action === "reset") {
        const chatId = args[3];
        if (chatId && settings.groups?.[chatId]) {
          delete settings.groups[chatId];
          fs.writeFileSync(
            settingsPath,
            JSON.stringify(settings, null, 2) + "\n",
          );
          console.log(`✅ Reset overrides for group ${chatId}`);
        } else if (!chatId) {
          settings = {
            defaults: {
              randomBoostRate: 0.2,
              cooldownMinutes: 30,
              quietMinutes: 5,
              enabled: true,
            },
            groups: {},
          };
          fs.writeFileSync(
            settingsPath,
            JSON.stringify(settings, null, 2) + "\n",
          );
          console.log("✅ Reset all participation settings to defaults");
        }
        return;
      }

      console.error("Usage: alma group participation [show|set|reset]");
      process.exit(1);
    }

    if (subcmd === "rules") {
      const action = args[2]; // show | set | add | clear
      const chatId = args[3];

      if (!action || action === "help") {
        console.log(
          "Usage: alma group rules <show|set|add|clear> <chatId> [text]",
        );
        console.log("  show <chatId>    — Show current rules for a group");
        console.log('  set <chatId> "rules text"  — Replace all rules');
        console.log('  add <chatId> "new rule"    — Append a rule');
        console.log("  clear <chatId>   — Remove all rules");
        console.log("\nRules file: ~/.config/alma/groups/<chatId>.rules.md");
        return;
      }

      if (!chatId) {
        console.error("Error: chatId is required");
        process.exit(1);
      }

      const rulesPath = pathMod.default.join(
        _os.homedir(),
        ".config",
        "alma",
        "groups",
        `${chatId}.rules.md`,
      );

      if (action === "show") {
        if (fs.existsSync(rulesPath)) {
          console.log(fs.readFileSync(rulesPath, "utf-8"));
        } else {
          console.log("No rules set for this group.");
        }
        return;
      }

      if (action === "set") {
        const text = args.slice(4).join(" ");
        if (!text) {
          console.error("Error: rules text required");
          process.exit(1);
        }
        const groupsDir = pathMod.default.join(
          _os.homedir(),
          ".config",
          "alma",
          "groups",
        );
        if (!fs.existsSync(groupsDir))
          fs.mkdirSync(groupsDir, { recursive: true });
        fs.writeFileSync(rulesPath, text + "\n");
        console.log(`✅ Rules set for group ${chatId}`);
        return;
      }

      if (action === "add") {
        const text = args.slice(4).join(" ");
        if (!text) {
          console.error("Error: rule text required");
          process.exit(1);
        }
        const groupsDir = pathMod.default.join(
          _os.homedir(),
          ".config",
          "alma",
          "groups",
        );
        if (!fs.existsSync(groupsDir))
          fs.mkdirSync(groupsDir, { recursive: true });
        const existing = fs.existsSync(rulesPath)
          ? fs.readFileSync(rulesPath, "utf-8")
          : "";
        fs.writeFileSync(rulesPath, existing + `- ${text}\n`);
        console.log(`✅ Rule added for group ${chatId}`);
        return;
      }

      if (action === "clear") {
        if (fs.existsSync(rulesPath)) {
          fs.unlinkSync(rulesPath);
          console.log(`✅ Rules cleared for group ${chatId}`);
        } else {
          console.log("No rules to clear.");
        }
        return;
      }

      console.error(
        "Usage: alma group rules <show|set|add|clear> <chatId> [text]",
      );
      process.exit(1);
    }

    console.error(
      "Usage: alma group <list|history|search|context|send|pin|unpin|leave|participation|rules> [args]",
    );
    process.exit(1);
  }

  // ── Emotion system ────────────────────────────────────────────────
  if (cmd === "emotion") {
    const fs = await import("fs");
    const pathMod = await import("path");
    const emotionDir = pathMod.default.join(
      _os.homedir(),
      ".config",
      "alma",
      "emotions",
    );
    if (!fs.existsSync(emotionDir))
      fs.mkdirSync(emotionDir, { recursive: true });
    const basePath = pathMod.default.join(emotionDir, "base.md");
    const contextDir = pathMod.default.join(emotionDir, "context");
    if (!fs.existsSync(contextDir))
      fs.mkdirSync(contextDir, { recursive: true });

    // Parse YAML frontmatter from markdown
    function parseMd(content) {
      const m = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)/);
      if (!m) return { meta: {}, body: content.trim() };
      const meta = {};
      for (const line of m[1].split("\n")) {
        const idx = line.indexOf(":");
        if (idx > 0) {
          const key = line.substring(0, idx).trim();
          let val = line.substring(idx + 1).trim();
          if (!isNaN(Number(val))) val = Number(val);
          meta[key] = val;
        }
      }
      return { meta, body: m[2].trim() };
    }

    // Write markdown with YAML frontmatter
    function writeMd(filepath, meta, body) {
      const yaml = Object.entries(meta)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      fs.writeFileSync(filepath, `---\n${yaml}\n---\n\n${body}\n`);
    }

    const subcmd = args[1];

    if (!subcmd || subcmd === "status") {
      let base = {
        meta: { mood: "neutral", energy: 5, valence: 5 },
        body: "No base emotion set yet",
      };
      if (fs.existsSync(basePath)) {
        try {
          base = parseMd(fs.readFileSync(basePath, "utf-8"));
        } catch {}
      }
      console.log("=== Base Emotion (global) ===");
      console.log(
        `  Mood: ${base.meta.mood} | Energy: ${base.meta.energy}/10 | Valence: ${base.meta.valence}/10`,
      );
      if (base.body) console.log(`  ${base.body}`);
      console.log(`  Updated: ${base.meta.updated || "never"}`);

      const ctxFiles = fs
        .readdirSync(contextDir)
        .filter((f) => f.endsWith(".md"));
      if (ctxFiles.length > 0) {
        console.log("\n=== Context Emotions (per-chat) ===");
        for (const f of ctxFiles) {
          try {
            const ctx = parseMd(
              fs.readFileSync(pathMod.default.join(contextDir, f), "utf-8"),
            );
            const chatId = f.replace(".md", "");
            console.log(
              `  [${chatId}] ${ctx.meta.mood} (valence: ${ctx.meta.valence}/10) — ${ctx.body || "no trigger"} (${ctx.meta.updated || "?"})`,
            );
          } catch {}
        }
      }
      return;
    }

    if (subcmd === "set-base") {
      const mood = args[2] || "neutral";
      const energy = Math.min(10, Math.max(0, parseInt(args[3]) || 5));
      const valence = Math.min(10, Math.max(0, parseInt(args[4]) || 5));
      const description = args.slice(5).join(" ") || "";
      writeMd(
        basePath,
        { mood, energy, valence, updated: new Date().toISOString() },
        description,
      );
      console.log(
        `✅ Base emotion set: ${mood} (energy: ${energy}, valence: ${valence})`,
      );
      return;
    }

    if (subcmd === "set-context") {
      const chatId = args[2];
      const mood = args[3] || "neutral";
      const valence = Math.min(10, Math.max(0, parseInt(args[4]) || 5));
      const trigger = args.slice(5).join(" ") || "";
      if (!chatId) {
        console.error(
          "Usage: alma emotion set-context <chatId> <mood> <valence> <trigger>",
        );
        process.exit(1);
      }
      writeMd(
        pathMod.default.join(contextDir, `${chatId}.md`),
        { mood, valence, updated: new Date().toISOString() },
        trigger,
      );
      console.log(
        `✅ Context emotion for ${chatId}: ${mood} (valence: ${valence}) — ${trigger}`,
      );
      return;
    }

    if (subcmd === "get") {
      const chatId = args[2];
      let base = { meta: { mood: "neutral", energy: 5, valence: 5 }, body: "" };
      if (fs.existsSync(basePath)) {
        try {
          base = parseMd(fs.readFileSync(basePath, "utf-8"));
        } catch {}
      }
      let context = null;
      if (chatId) {
        const ctxPath = pathMod.default.join(contextDir, `${chatId}.md`);
        if (fs.existsSync(ctxPath)) {
          try {
            context = parseMd(fs.readFileSync(ctxPath, "utf-8"));
          } catch {}
        }
      }
      const baseV = Number(base.meta.valence) || 5;
      const ctxV = context ? Number(context.meta.valence) || 5 : baseV;
      const blendedValence = Math.round(baseV * 0.3 + ctxV * 0.7);
      const blendedMood = context ? context.meta.mood : base.meta.mood;
      console.log(
        JSON.stringify({
          base: base.meta,
          context: context?.meta || null,
          blended: {
            mood: blendedMood,
            valence: blendedValence,
            energy: base.meta.energy,
          },
        }),
      );
      return;
    }

    console.error(
      "Usage: alma emotion <status|set-base|set-context|get> [args]",
    );
    return;
  }

  // ── Ignore (block/mute users) ──────────────────────────────────────
  if (cmd === "ignore") {
    const pathMod = await import("path");
    const fsMod = await import("fs");
    const osMod = await import("os");
    const ignoreFile = pathMod.default.join(
      osMod.default.homedir(),
      ".config",
      "alma",
      "ignore.json",
    );

    const loadIgnoreList = () => {
      try {
        if (fsMod.default.existsSync(ignoreFile)) {
          return JSON.parse(fsMod.default.readFileSync(ignoreFile, "utf-8"));
        }
      } catch {}
      return [];
    };
    const saveIgnoreList = (list) => {
      const dir = pathMod.default.dirname(ignoreFile);
      if (!fsMod.default.existsSync(dir))
        fsMod.default.mkdirSync(dir, { recursive: true });
      fsMod.default.writeFileSync(ignoreFile, JSON.stringify(list, null, 2));
    };

    const subcmd = args[1];
    if (subcmd === "add") {
      const userId = args[2];
      const reason = args[3] || "no reason";
      const duration = args[4]; // e.g. "30m", "2h", "1d", or omit for permanent
      if (!userId) {
        console.error("Usage: alma ignore add <userId> [reason] [duration]");
        console.error("  duration: 30m, 2h, 1d, etc. Omit for permanent.");
        process.exit(1);
      }
      let until = null;
      if (duration) {
        const match = duration.match(/^(\d+)(m|h|d)$/);
        if (match) {
          const ms =
            parseInt(match[1]) *
            (match[2] === "m" ? 60000 : match[2] === "h" ? 3600000 : 86400000);
          until = new Date(Date.now() + ms).toISOString();
        }
      }
      const list = loadIgnoreList();
      // Remove existing entry for same userId
      const filtered = list.filter((e) => String(e.userId) !== String(userId));
      filtered.push({
        userId: String(userId),
        reason,
        until,
        addedAt: new Date().toISOString(),
      });
      saveIgnoreList(filtered);
      console.log(
        `✅ User ${userId} ignored${until ? ` until ${until}` : " permanently"}. Reason: ${reason}`,
      );
    } else if (subcmd === "remove") {
      const userId = args[2];
      if (!userId) {
        console.error("Usage: alma ignore remove <userId>");
        process.exit(1);
      }
      const list = loadIgnoreList();
      const filtered = list.filter((e) => String(e.userId) !== String(userId));
      saveIgnoreList(filtered);
      console.log(`✅ User ${userId} removed from ignore list.`);
    } else if (subcmd === "list") {
      const list = loadIgnoreList();
      if (list.length === 0) {
        console.log("Ignore list is empty.");
      } else {
        const now = new Date();
        for (const e of list) {
          const expired = e.until && new Date(e.until) < now;
          const status = expired
            ? " [EXPIRED]"
            : e.until
              ? ` [until ${e.until}]`
              : " [permanent]";
          console.log(`- userId: ${e.userId}, reason: ${e.reason}${status}`);
        }
      }
    } else {
      console.log("Usage: alma ignore <add|remove|list>");
      console.log(
        "  add <userId> [reason] [duration]  - Ignore a user (duration: 30m, 2h, 1d)",
      );
      console.log("  remove <userId>                   - Unignore a user");
      console.log("  list                              - Show ignore list");
    }
    return;
  }

  // ── DM (direct message a user) ────────────────────────────────────
  if (cmd === "dm") {
    const userId = args[1];
    const message = args.slice(2).join(" ").replace(/\\n/g, "\n");
    if (!userId || !message) {
      console.error("Usage: alma dm <userId> <message>");
      console.error(
        "  userId: Telegram numeric user ID (find in people profiles)",
      );
      console.error("  Note: The user must have /start-ed the bot first.");
      process.exit(1);
    }
    const settings = await api("GET", "/api/settings");
    const botToken = settings?.telegram?.botToken;
    if (!botToken) {
      console.error("Telegram bot not configured.");
      process.exit(1);
    }
    const resp = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: userId, text: message }),
      },
    );
    const result = await resp.json();
    if (result.ok) {
      console.log(`✅ DM sent to user ${userId}`);
    } else {
      if (
        result.description?.includes("bot was blocked") ||
        result.description?.includes("bot can't initiate")
      ) {
        console.error(
          `❌ Cannot DM: user hasn't started the bot or has blocked it.`,
        );
      } else {
        console.error("Failed:", result.description);
      }
    }
    return;
  }

  // ── Message management ──────────────────────────────────────────────
  // ── Send files/photos/audio/video to current chat ──────────────
  if (cmd === "send") {
    const subcmd = args[1]; // photo, file, audio, video, document, voice
    const sendArgs = args.slice(2);
    let chatId = process.env.ALMA_CHAT_ID || "";
    let threadId = process.env.ALMA_THREAD_ID || "";
    let chatIdExplicit = false;
    let threadIdExplicit = false;
    const positional = [];

    for (let i = 0; i < sendArgs.length; i++) {
      const token = sendArgs[i];
      if (token === "--chat" && sendArgs[i + 1]) {
        chatId = sendArgs[++i];
        chatIdExplicit = true;
        continue;
      }
      if (token === "--thread" && sendArgs[i + 1]) {
        threadId = sendArgs[++i];
        threadIdExplicit = true;
        continue;
      }
      positional.push(token);
    }

    const actualFilePath = positional[0];
    const actualCaption = positional.slice(1).join(" ") || undefined;

    if (!subcmd || !actualFilePath) {
      console.error(
        "Usage: alma send <photo|file|audio|video|voice> [--chat <chatId> | --thread <threadId>] <filePath> [caption]",
      );
      console.error(
        "Reads ALMA_CHAT_ID / ALMA_THREAD_ID from environment (set automatically by Alma during tool execution).",
      );
      process.exit(1);
    }

    const targetMode = chatIdExplicit
      ? "chat"
      : threadIdExplicit
        ? "thread"
        : chatId
          ? "chat"
          : threadId
            ? "thread"
            : "";
    if (!targetMode) {
      console.error(
        "❌ No target found. Set ALMA_CHAT_ID / ALMA_THREAD_ID, or use --chat <chatId> / --thread <threadId>.",
      );
      process.exit(1);
    }
    if (!actualFilePath) {
      console.error("❌ No file path provided.");
      process.exit(1);
    }

    const fs = await import("fs");
    if (!fs.existsSync(actualFilePath)) {
      console.error(`❌ File not found: ${actualFilePath}`);
      process.exit(1);
    }

    // 🔒 Block sending files from selfie album to non-owner chats
    const _pathMod = await import("path");
    const resolvedPath = _pathMod.resolve(actualFilePath);
    const selfieAlbumDir = _pathMod.join(
      process.env.HOME || "",
      ".config",
      "alma",
      "selfies",
    );
    if (targetMode === "chat" && resolvedPath.startsWith(selfieAlbumDir)) {
      // Allow sending to owner only — check settings for ownerId
      let isOwner = false;
      try {
        const settings = await api("GET", "/api/settings");
        const ownerId = settings?.telegram?.ownerId;
        if (ownerId && chatId === String(ownerId)) {
          isOwner = true;
        }
      } catch {
        /* can't verify, block by default */
      }
      if (!isOwner) {
        console.error(
          "❌ BLOCKED: Cannot send selfie album photos to non-owner chats. These are private face-reference images. Use `alma selfie take` to generate a new selfie instead.",
        );
        process.exit(1);
      }
    }

    // Map subcmd to API endpoint
    const typeMap = {
      photo: "send-photo",
      image: "send-photo",
      file: "send-document",
      document: "send-document",
      doc: "send-document",
      audio: "send-audio",
      music: "send-audio",
      video: "send-video",
      voice: "send-voice",
    };
    const endpoint = typeMap[subcmd.toLowerCase()];
    if (!endpoint) {
      console.error(
        `❌ Unknown type: ${subcmd}. Use: photo, file, audio, video, voice`,
      );
      process.exit(1);
    }
    if (targetMode === "thread" && endpoint !== "send-photo") {
      console.error(
        `❌ \`${subcmd}\` is not supported for GUI thread delivery yet. Use \`alma send photo\` or target an external chat with --chat <chatId>.`,
      );
      process.exit(1);
    }

    try {
      const targetId = targetMode === "chat" ? chatId : threadId;
      const targetEndpoint =
        targetMode === "chat"
          ? `/api/chat/${chatId}/${endpoint}`
          : `/api/threads/${threadId}/${endpoint}`;
      const result = await api("POST", targetEndpoint, {
        filePath: actualFilePath,
        caption: actualCaption,
      });
      if (result?.ok || result?.messageId) {
        console.log(`✅ Sent ${subcmd} to ${targetMode} ${targetId}`);
      } else {
        console.error(
          "Failed:",
          result?.error || result?.description || "unknown error",
        );
        process.exit(1);
      }
    } catch (err) {
      console.error("❌ Send failed:", err.message || err);
      process.exit(1);
    }
    return;
  }

  if (cmd === "msg") {
    const subcmd = args[1];
    if (subcmd === "delete") {
      const chatId = args[2];
      const messageId = args[3];
      if (!chatId || !messageId) {
        console.error("Usage: alma msg delete <chatId> <messageId>");
        process.exit(1);
      }
      const settings = await api("GET", "/api/settings");
      const botToken = settings?.telegram?.botToken;
      if (!botToken) {
        console.error("Telegram bot not configured.");
        process.exit(1);
      }
      const resp = await fetch(
        `https://api.telegram.org/bot${botToken}/deleteMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: parseInt(messageId),
          }),
        },
      );
      const result = await resp.json();
      if (result.ok) {
        console.log(`✅ Deleted message ${messageId} in chat ${chatId}`);
      } else {
        console.error("Failed:", result.description);
      }
      return;
    }
    if (subcmd === "react") {
      const chatId = args[2];
      const messageId = args[3];
      const emoji = args[4];
      if (!chatId || !messageId || !emoji) {
        console.error("Usage: alma msg react <chatId> <messageId> <emoji>");
        process.exit(1);
      }
      const settings = await api("GET", "/api/settings");
      const botToken = settings?.telegram?.botToken;
      if (!botToken) {
        console.error("Telegram bot not configured.");
        process.exit(1);
      }
      const resp = await fetch(
        `https://api.telegram.org/bot${botToken}/setMessageReaction`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: parseInt(messageId),
            reaction: [{ type: "emoji", emoji }],
          }),
        },
      );
      const result = await resp.json();
      if (result.ok) {
        console.log(
          `✅ Reacted ${emoji} to message ${messageId} in chat ${chatId}`,
        );
      } else {
        console.error("Failed:", result.description);
      }
      return;
    }
    if (subcmd === "sticker-search" || subcmd === "sticker-list") {
      const setName = args[2];
      if (!setName) {
        // List known sticker sets from index
        const fs = await import("fs");
        const indexPath = _path.join(
          _os.homedir(),
          ".config",
          "alma",
          "stickers",
          "index.json",
        );
        if (fs.existsSync(indexPath)) {
          const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
          const sets = Object.keys(index);
          if (sets.length === 0) {
            console.log(
              "No sticker sets indexed yet. Send/receive stickers to build the index.",
            );
          } else {
            console.log(`Known sticker sets (${sets.length}):`);
            for (const s of sets) {
              console.log(`  ${s} — ${index[s].length} stickers`);
            }
          }
        } else {
          console.log(
            "No sticker index yet. Alma builds it as she sees stickers.",
          );
        }
        return;
      }
      const settings = await api("GET", "/api/settings");
      const botToken = settings?.telegram?.botToken;
      if (!botToken) {
        console.error("Telegram bot not configured.");
        process.exit(1);
      }
      const resp = await fetch(
        `https://api.telegram.org/bot${botToken}/getStickerSet?name=${encodeURIComponent(setName)}`,
      );
      const result = await resp.json();
      if (!result.ok) {
        console.error("Failed:", result.description);
        process.exit(1);
      }
      const stickers = result.result.stickers || [];
      console.log(
        `Sticker set: ${result.result.name} (${result.result.title}) — ${stickers.length} stickers`,
      );
      // Save to index
      const fs = await import("fs");
      const stickerDir = _path.join(
        _os.homedir(),
        ".config",
        "alma",
        "stickers",
      );
      if (!fs.existsSync(stickerDir))
        fs.mkdirSync(stickerDir, { recursive: true });
      const indexPath = _path.join(stickerDir, "index.json");
      let index = {};
      if (fs.existsSync(indexPath)) {
        try {
          index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
        } catch {
          /* */
        }
      }
      index[setName] = stickers.map((s) => ({
        emoji: s.emoji,
        file_id: s.file_id,
        is_animated: s.is_animated,
        is_video: s.is_video,
      }));
      fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
      // Print stickers
      for (const s of stickers) {
        console.log(`  ${s.emoji || "?"}  file_id: ${s.file_id}`);
      }
      console.log(`\nIndexed ${stickers.length} stickers from "${setName}".`);
      return;
    }

    if (subcmd === "sticker-find") {
      // Find stickers by emoji across all indexed sets
      const emoji = args[2];
      if (!emoji) {
        console.error("Usage: alma msg sticker-find <emoji>");
        process.exit(1);
      }
      const fs = await import("fs");
      const indexPath = _path.join(
        _os.homedir(),
        ".config",
        "alma",
        "stickers",
        "index.json",
      );
      if (!fs.existsSync(indexPath)) {
        console.log(
          "No sticker index. Use `alma msg sticker-search <set_name>` first.",
        );
        return;
      }
      const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
      let found = 0;
      for (const [setName, stickers] of Object.entries(index)) {
        for (const s of stickers) {
          if (s.emoji === emoji) {
            console.log(`  ${s.emoji}  set:${setName}  file_id:${s.file_id}`);
            found++;
          }
        }
      }
      if (found === 0) console.log(`No stickers found for emoji "${emoji}".`);
      else console.log(`\nFound ${found} sticker(s).`);
      return;
    }

    if (subcmd === "sticker") {
      const chatId = args[2];
      const stickerId = args[3];
      if (!chatId || !stickerId) {
        console.error("Usage: alma msg sticker <chatId> <sticker_file_id>");
        process.exit(1);
      }
      const settings = await api("GET", "/api/settings");
      const botToken = settings?.telegram?.botToken;
      if (!botToken) {
        console.error("Telegram bot not configured.");
        process.exit(1);
      }
      // Show "choosing sticker" action before sending
      await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, action: "choose_sticker" }),
      }).catch(() => {});
      const resp = await fetch(
        `https://api.telegram.org/bot${botToken}/sendSticker`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, sticker: stickerId }),
        },
      );
      const result = await resp.json();
      if (result.ok) {
        console.log(`✅ Sent sticker to ${chatId}`);
      } else {
        console.error("Failed:", result.description);
      }
      return;
    }
    console.error("Usage: alma msg <delete|react|sticker> ...");
    return;
  }

  // ── People (per-user profiles) ────────────────────────────────────
  if (cmd === "people") {
    const fs = await import("fs");
    const pathMod = await import("path");
    const profileDir = pathMod.default.join(
      _os.homedir(),
      ".config",
      "alma",
      "people",
    );
    if (!fs.existsSync(profileDir))
      fs.mkdirSync(profileDir, { recursive: true });

    const subcmd = args[1]; // list | show | set | delete

    if (!subcmd || subcmd === "list") {
      const files = fs.readdirSync(profileDir).filter((f) => f.endsWith(".md"));
      if (files.length === 0) {
        console.log("No people profiles yet.");
      } else {
        for (const f of files) {
          const name = f.replace(".md", "");
          const content = fs.readFileSync(
            pathMod.default.join(profileDir, f),
            "utf-8",
          );
          const lines = content.split("\n").filter((l) => l.trim()).length;
          console.log(`  ${name} (${lines} lines)`);
        }
      }
      return;
    }

    if (subcmd === "show" && args[2]) {
      const name = args[2].replace("@", "").toLowerCase();
      const file = pathMod.default.join(profileDir, `${name}.md`);
      if (fs.existsSync(file)) {
        console.log(fs.readFileSync(file, "utf-8"));
      } else {
        console.log(`No profile for "${name}" yet.`);
      }
      return;
    }

    if (subcmd === "set" && args[2]) {
      const name = args[2].replace("@", "").toLowerCase();
      const file = pathMod.default.join(profileDir, `${name}.md`);
      // Read from stdin if no inline content
      const content = args.slice(3).join(" ");
      if (content) {
        fs.writeFileSync(file, content + "\n", "utf-8");
        console.log(`✅ Profile for "${name}" saved.`);
      } else {
        // Append mode - read from stdin
        const data = fs.readFileSync(0, "utf-8");
        fs.writeFileSync(file, data, "utf-8");
        console.log(`✅ Profile for "${name}" saved from stdin.`);
      }
      return;
    }

    if (subcmd === "append" && args[2]) {
      const name = args[2].replace("@", "").toLowerCase();
      const file = pathMod.default.join(profileDir, `${name}.md`);
      const content = args.slice(3).join(" ");
      if (content) {
        fs.appendFileSync(file, content + "\n", "utf-8");
        console.log(`✅ Appended to "${name}" profile.`);
      }
      return;
    }

    if (subcmd === "delete" && args[2]) {
      const name = args[2].replace("@", "").toLowerCase();
      const file = pathMod.default.join(profileDir, `${name}.md`);
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`✅ Profile for "${name}" deleted.`);
      } else {
        console.log(`No profile for "${name}".`);
      }
      return;
    }

    if (subcmd === "dir") {
      console.log(profileDir);
      return;
    }

    console.error(
      "Usage: alma people <list|show|set|append|delete|dir> [name] [content]",
    );
    process.exit(1);
  }

  if (cmd === "tts") {
    const fs = await import("fs");
    const ttsDir = _path.join(_os.homedir(), ".config", "alma", "tts");
    const modelsDir = _path.join(ttsDir, "models");

    // alma tts auto [off|inbound|always|smart] — get/set TTS auto mode
    if (args[1] === "auto") {
      const mode = args[2];
      if (!mode) {
        // Show current
        const settings = await api("GET", "/api/settings");
        console.log(`TTS auto mode: ${settings?.tts?.auto || "off"}`);
        console.log(
          "Options: off (no auto voice), inbound (reply voice to voice), always (all replies as voice), smart (AI decides per-message)",
        );
        return;
      }
      if (!["off", "inbound", "always", "smart"].includes(mode)) {
        console.error("Invalid mode. Use: off, inbound, always");
        process.exit(1);
      }
      await api("PUT", "/api/settings", { tts: { auto: mode } });
      console.log(`✅ TTS auto mode set to: ${mode}`);
      return;
    }

    // alma tts provider [local|openai|elevenlabs] — get/set TTS provider
    if (args[1] === "provider") {
      const provider = args[2];
      if (!provider) {
        const settings = await api("GET", "/api/settings");
        console.log(`TTS provider: ${settings?.tts?.provider || "openai"}`);
        console.log("Options: local (Qwen3-TTS), openai, elevenlabs");
        return;
      }
      if (!["local", "openai", "elevenlabs"].includes(provider)) {
        console.error("Invalid provider. Use: local, openai, elevenlabs");
        process.exit(1);
      }
      await api("PUT", "/api/settings", { tts: { provider } });
      console.log(`✅ TTS provider set to: ${provider}`);
      return;
    }

    // alma tts voice [voiceName] — get/set TTS voice
    if (args[1] === "voice") {
      const voice = args[2];
      if (!voice) {
        const settings = await api("GET", "/api/settings");
        console.log(`TTS voice: ${settings?.tts?.voiceId || "vivian"}`);
        console.log(
          "Local voices: vivian, serena, ono_anna, sohee, uncle_fu, ryan, aiden, eric, dylan",
        );
        console.log("OpenAI voices: alloy, echo, fable, onyx, nova, shimmer");
        return;
      }
      await api("PUT", "/api/settings", { tts: { voiceId: voice } });
      console.log(`✅ TTS voice set to: ${voice}`);
      return;
    }

    // alma tts setup — manually trigger setup
    if (args[1] === "setup") {
      console.log("Setting up Qwen3-TTS...");
      const { execSync } = await import("child_process");
      // Create dirs
      fs.mkdirSync(modelsDir, { recursive: true });
      // Copy bundled scripts if available
      const bundledDirs = [
        _path.join(__dirname, "..", "electron", "tts"),
        _path.join(__dirname, "..", "tts"),
      ];
      for (const dir of bundledDirs) {
        if (fs.existsSync(_path.join(dir, "tts_cli.py"))) {
          for (const f of ["tts_cli.py", "main.py", "requirements.txt"]) {
            const src = _path.join(dir, f);
            if (fs.existsSync(src)) fs.copyFileSync(src, _path.join(ttsDir, f));
          }
          console.log("Scripts copied from", dir);
          break;
        }
      }
      // Create venv
      const venvPath = _path.join(ttsDir, ".venv");
      if (!fs.existsSync(_path.join(venvPath, "bin", "python3"))) {
        console.log("Creating Python venv...");
        execSync(`python3 -m venv "${venvPath}"`, {
          stdio: "inherit",
          timeout: 60000,
        });
        console.log("Installing dependencies (this may take a few minutes)...");
        execSync(
          `"${_path.join(venvPath, "bin", "pip")}" install -r "${_path.join(ttsDir, "requirements.txt")}"`,
          {
            stdio: "inherit",
            timeout: 600000,
          },
        );
      } else {
        console.log("Venv already exists");
      }
      // Model download happens on first TTS call automatically
      console.log(
        "✅ Setup complete. Model will auto-download on first use (~2.2GB).",
      );
      return;
    }

    const text = args[1];
    if (!text) {
      console.error(
        'Usage: alma tts "text" [--voice vivian] [--emotion cheerful] [--speed 1.0] [--output /tmp/voice.wav]',
      );
      console.error("       alma tts setup  — set up local TTS engine");
      process.exit(1);
    }

    // Parse options
    let voice = "",
      emotion = "",
      speed = "1.0",
      output = `/tmp/alma-tts-${Date.now()}.wav`;
    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--voice" && args[i + 1]) {
        voice = args[++i];
      } else if (args[i] === "--emotion" && args[i + 1]) {
        emotion = args[++i];
      } else if (args[i] === "--speed" && args[i + 1]) {
        speed = args[++i];
      } else if (args[i] === "--output" && args[i + 1]) {
        output = args[++i];
      }
    }

    // Try server-side TTS generation (respects configured provider: ElevenLabs/OpenAI/local)
    try {
      const settings = await api("GET", "/api/settings");
      const provider = settings?.tts?.provider;
      if (provider && provider !== "local" && provider !== "qwen") {
        // Use server API for cloud TTS providers
        const resp = await fetch(`${BASE_URL}/api/tts/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (resp.ok) {
          const audioBuffer = Buffer.from(await resp.arrayBuffer());
          // Server returns OGG/Opus, adjust output extension
          if (output.endsWith(".wav")) {
            output = output.replace(/\.wav$/, ".ogg");
          }
          fs.writeFileSync(output, audioBuffer);
          console.log(output);
          return;
        }
        // Fall through to local TTS if server call fails
        console.error(
          `Server TTS failed (${resp.status}), falling back to local TTS...`,
        );
      }
    } catch {
      // Server not available, fall through to local TTS
    }

    // Local Qwen3-TTS fallback
    const pythonPath = _path.join(ttsDir, ".venv", "bin", "python3");
    const scriptPath = _path.join(ttsDir, "tts_cli.py");
    if (!fs.existsSync(scriptPath) || !fs.existsSync(pythonPath)) {
      console.error("Qwen3-TTS not set up. Run: alma tts setup");
      process.exit(1);
    }
    if (!voice) voice = "vivian";
    const cmdArgs = [
      pythonPath,
      scriptPath,
      "--text",
      text,
      "--voice",
      voice,
      "--speed",
      speed,
      "--models-dir",
      modelsDir,
      "--output",
      output,
    ];
    if (emotion) cmdArgs.push("--emotion", emotion);
    const { execFileSync } = await import("child_process");
    try {
      const result = execFileSync(cmdArgs[0], cmdArgs.slice(1), {
        encoding: "utf-8",
        timeout: 300000,
      });
      console.log(result);
      console.log(output);
    } catch (err) {
      console.error("TTS failed:", err.stderr || err.message);
      process.exit(1);
    }
    return;
  }

  if (
    cmd === "fatigue" ||
    cmd === "sleep" ||
    cmd === "wake" ||
    cmd === "rest"
  ) {
    const fatiguePath = _path.join(
      _os.homedir(),
      ".config",
      "alma",
      "fatigue.json",
    );
    const fs = await import("fs");

    const loadState = () => {
      try {
        if (fs.existsSync(fatiguePath))
          return JSON.parse(fs.readFileSync(fatiguePath, "utf-8"));
      } catch {
        /* ignore */
      }
      return {
        fatigue: 0,
        messageCount: 0,
        lastMessageTime: Date.now(),
        lastRestTime: Date.now(),
        manualSleep: false,
        manualWake: false,
      };
    };
    const saveState = (s) => {
      const dir = _path.dirname(fatiguePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fatiguePath, JSON.stringify(s, null, 2));
    };

    if (cmd === "sleep") {
      const state = loadState();
      state.manualSleep = true;
      state.manualWake = false;
      saveState(state);
      console.log("💤 Alma is now sleeping. She will be grumpy if disturbed.");
      return;
    }

    if (cmd === "wake") {
      const state = loadState();
      state.manualSleep = false;
      state.manualWake = true;
      state.fatigue = Math.max(0, state.fatigue - 30);
      state.lastRestTime = Date.now();
      saveState(state);
      console.log("☀️ Alma is awake now!");
      return;
    }

    if (cmd === "rest") {
      const state = loadState();
      state.fatigue = 0;
      state.messageCount = 0;
      state.lastRestTime = Date.now();
      state.manualSleep = false;
      state.manualWake = false;
      saveState(state);
      console.log("✨ Alma is fully rested!");
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
    let level = "awake";
    if (state.manualSleep) level = "sleeping (manual)";
    else if (state.manualWake && !(h >= 1 && h < 6)) level = "awake (forced)";
    else if (effective >= 75) level = "sleeping";
    else if (effective >= 50) level = "sleepy";
    else if (effective >= 30) level = "tired";
    console.log(`Fatigue: ${effective}/100 (${level})`);
    console.log(`Messages processed: ${state.messageCount}`);
    console.log(`Time bonus: +${timeBonus} (hour: ${h})`);
    console.log(
      `Base fatigue: ${Math.round(baseFatigue)} (after ${Math.round(minutesSinceLastMsg)}min recovery)`,
    );
    if (state.manualSleep) console.log("Manual sleep: ON");
    if (state.manualWake) console.log("Manual wake: ON");
    return;
  }

  // ── Tasks: Global multi-step task tracking ──
  if (cmd === "tasks") {
    const fs = await import("fs");
    const pathMod = await import("path");
    const tasksFile = pathMod.default.join(
      _os.homedir(),
      ".config",
      "alma",
      "tasks.json",
    );

    const loadTasks = () => {
      try {
        if (fs.existsSync(tasksFile))
          return JSON.parse(fs.readFileSync(tasksFile, "utf-8"));
      } catch {
        /* ignore */
      }
      return { tasks: [] };
    };
    const saveTasks = (data) => {
      const dir = pathMod.default.dirname(tasksFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(tasksFile, JSON.stringify(data, null, 2), "utf-8");
    };
    const genId = () =>
      "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    const subcmd = args[1];

    if (!subcmd || subcmd === "list") {
      const data = loadTasks();
      const filter = args[2]; // 'all', 'active', 'done' (default: active)
      const tasks = data.tasks.filter((t) => {
        if (filter === "all") return true;
        if (filter === "done") return t.status === "done";
        return t.status !== "done"; // default: active
      });
      if (tasks.length === 0) {
        console.log(
          filter === "done" ? "No completed tasks." : "No active tasks.",
        );
      } else {
        for (const t of tasks) {
          const stepInfo = t.steps?.length
            ? ` [${t.currentStep || 0}/${t.steps.length}]`
            : "";
          const statusIcon =
            { pending: "⏳", in_progress: "🔄", done: "✅", blocked: "🚫" }[
              t.status
            ] || "❓";
          console.log(
            `${statusIcon} ${t.id} | ${t.title}${stepInfo} (${t.status})`,
          );
          if (t.steps?.length && t.status !== "done") {
            t.steps.forEach((s, i) => {
              const marker =
                i < (t.currentStep || 0)
                  ? "  ✓"
                  : i === (t.currentStep || 0)
                    ? "  →"
                    : "   ";
              console.log(`${marker} ${i + 1}. ${s}`);
            });
          }
        }
      }
      return;
    }

    if (subcmd === "add") {
      const title = args.slice(2).join(" ");
      if (!title) {
        console.error("Usage: alma tasks add <title>");
        process.exit(1);
      }
      const data = loadTasks();
      const task = {
        id: genId(),
        title,
        status: "pending",
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

    if (subcmd === "update") {
      const taskId = args[2];
      if (!taskId) {
        console.error(
          'Usage: alma tasks update <id> [--status <s>] [--step <n>] [--title <t>] [--steps "s1,s2,s3"] [--thread <id>]',
        );
        process.exit(1);
      }
      const data = loadTasks();
      const task = data.tasks.find((t) => t.id === taskId);
      if (!task) {
        console.error(`Task not found: ${taskId}`);
        process.exit(1);
      }
      for (let i = 3; i < args.length; i++) {
        if (args[i] === "--status" && args[i + 1]) {
          task.status = args[++i];
        } else if (args[i] === "--step" && args[i + 1]) {
          task.currentStep = parseInt(args[++i], 10);
        } else if (args[i] === "--title" && args[i + 1]) {
          task.title = args[++i];
        } else if (args[i] === "--steps" && args[i + 1]) {
          task.steps = args[++i].split(",").map((s) => s.trim());
        } else if (args[i] === "--thread" && args[i + 1]) {
          task.threadId = args[++i];
        }
      }
      task.updatedAt = new Date().toISOString();
      saveTasks(data);
      console.log(`Updated task: ${task.id} — ${task.title} (${task.status})`);
      return;
    }

    if (subcmd === "show") {
      const taskId = args[2];
      if (!taskId) {
        console.error("Usage: alma tasks show <id>");
        process.exit(1);
      }
      const data = loadTasks();
      const task = data.tasks.find((t) => t.id === taskId);
      if (!task) {
        console.error(`Task not found: ${taskId}`);
        process.exit(1);
      }
      console.log(JSON.stringify(task, null, 2));
      return;
    }

    if (subcmd === "done") {
      const taskId = args[2];
      if (!taskId) {
        console.error("Usage: alma tasks done <id>");
        process.exit(1);
      }
      const data = loadTasks();
      const task = data.tasks.find((t) => t.id === taskId);
      if (!task) {
        console.error(`Task not found: ${taskId}`);
        process.exit(1);
      }
      task.status = "done";
      task.updatedAt = new Date().toISOString();
      saveTasks(data);
      console.log(`✅ Completed: ${task.id} — ${task.title}`);
      return;
    }

    if (subcmd === "delete") {
      const taskId = args[2];
      if (!taskId) {
        console.error("Usage: alma tasks delete <id>");
        process.exit(1);
      }
      const data = loadTasks();
      data.tasks = data.tasks.filter((t) => t.id !== taskId);
      saveTasks(data);
      console.log(`Deleted task: ${taskId}`);
      return;
    }

    console.error("Usage: alma tasks <list|add|update|show|done|delete>");
    process.exit(1);
  }

  // ── Travel: Virtual travel system for personality growth ──
  if (cmd === "travel") {
    const fs = await import("fs");
    const pathMod = await import("path");
    const travelDir = pathMod.default.join(
      _os.homedir(),
      ".config",
      "alma",
      "travels",
    );
    const statusFile = pathMod.default.join(travelDir, "status.json");
    const historyFile = pathMod.default.join(travelDir, "history.json");

    if (!fs.existsSync(travelDir)) fs.mkdirSync(travelDir, { recursive: true });

    const loadStatus = () => {
      try {
        if (fs.existsSync(statusFile))
          return JSON.parse(fs.readFileSync(statusFile, "utf-8"));
      } catch {}
      return {
        traveling: false,
        destination: null,
        departedAt: null,
        day: 0,
        events: [],
        mood: "neutral",
        budget: 1000,
      };
    };
    const saveStatus = (s) =>
      fs.writeFileSync(statusFile, JSON.stringify(s, null, 2), "utf-8");
    const loadHistory = () => {
      try {
        if (fs.existsSync(historyFile))
          return JSON.parse(fs.readFileSync(historyFile, "utf-8"));
      } catch {}
      return { trips: [] };
    };
    const saveHistory = (h) =>
      fs.writeFileSync(historyFile, JSON.stringify(h, null, 2), "utf-8");

    const subcmd = args[1];

    if (!subcmd || subcmd === "status") {
      const s = loadStatus();
      if (s.traveling) {
        console.log(`✈️ Currently traveling to: ${s.destination}`);
        console.log(`📅 Day ${s.day} (departed: ${s.departedAt})`);
        console.log(`💰 Budget remaining: ¥${s.budget}`);
        console.log(`😊 Mood: ${s.mood}`);
        console.log(`📝 Events so far: ${s.events.length}`);
        if (s.events.length > 0) {
          console.log("Recent events:");
          for (const e of s.events.slice(-3)) {
            console.log(`  - [Day ${e.day}] ${e.summary}`);
          }
        }
      } else {
        console.log("🏠 At home. Not traveling.");
        const h = loadHistory();
        if (h.trips.length > 0) {
          const last = h.trips[h.trips.length - 1];
          console.log(
            `Last trip: ${last.destination} (${last.departedAt} — ${last.returnedAt})`,
          );
        }
      }
      return;
    }

    if (subcmd === "go") {
      const destination = args.slice(2).join(" ");
      if (!destination) {
        console.error("Usage: alma travel go <destination>");
        process.exit(1);
      }
      const s = loadStatus();
      if (s.traveling) {
        console.error(
          `Already traveling to ${s.destination}! Come home first.`,
        );
        process.exit(1);
      }
      const now = new Date().toISOString().slice(0, 10);
      s.traveling = true;
      s.destination = destination;
      s.departedAt = now;
      s.day = 1;
      s.events = [];
      s.mood = "excited";
      s.budget = 800 + Math.floor(Math.random() * 400); // ¥800-1200
      saveStatus(s);
      console.log(
        `✈️ Departed for ${destination}! Budget: ¥${s.budget}. Have fun!`,
      );
      return;
    }

    if (subcmd === "event") {
      const summary = args.slice(2).join(" ");
      if (!summary) {
        console.error("Usage: alma travel event <description>");
        process.exit(1);
      }
      const s = loadStatus();
      if (!s.traveling) {
        console.error('Not traveling. Use "alma travel go <dest>" first.');
        process.exit(1);
      }
      const cost = Math.floor(Math.random() * 100) + 10;
      s.budget = Math.max(0, s.budget - cost);
      s.events.push({
        day: s.day,
        summary,
        cost,
        timestamp: new Date().toISOString(),
      });
      saveStatus(s);
      console.log(
        `📝 Event recorded (Day ${s.day}, ¥${cost} spent). Budget: ¥${s.budget} remaining.`,
      );
      return;
    }

    if (subcmd === "advance") {
      // Advance to next day
      const s = loadStatus();
      if (!s.traveling) {
        console.error("Not traveling.");
        process.exit(1);
      }
      s.day += 1;
      saveStatus(s);
      console.log(`🌅 Day ${s.day} in ${s.destination}. Budget: ¥${s.budget}.`);
      return;
    }

    if (subcmd === "mood") {
      const mood = args[2];
      if (!mood) {
        console.error("Usage: alma travel mood <mood>");
        process.exit(1);
      }
      const s = loadStatus();
      s.mood = mood;
      saveStatus(s);
      console.log(`😊 Travel mood updated: ${mood}`);
      return;
    }

    if (subcmd === "home" || subcmd === "return") {
      const s = loadStatus();
      if (!s.traveling) {
        console.error("Already at home.");
        process.exit(1);
      }
      const now = new Date().toISOString().slice(0, 10);
      // Calculate actual days from dates (more reliable than manual advance counter)
      const actualDays = s.departedAt
        ? Math.max(
            1,
            Math.ceil(
              (new Date(now).getTime() - new Date(s.departedAt).getTime()) /
                86400000,
            ),
          )
        : s.day;
      // Save trip to history
      const h = loadHistory();
      h.trips.push({
        destination: s.destination,
        departedAt: s.departedAt,
        returnedAt: now,
        days: actualDays,
        events: s.events,
        totalSpent: s.events.reduce((sum, e) => sum + (e.cost || 0), 0),
        mood: s.mood,
      });
      saveHistory(h);
      // Reset status
      s.traveling = false;
      s.destination = null;
      s.departedAt = null;
      s.day = 0;
      s.events = [];
      s.mood = "neutral";
      s.budget = 1000;
      saveStatus(s);
      console.log(
        `🏠 Returned home from ${h.trips[h.trips.length - 1].destination}! (${h.trips[h.trips.length - 1].days} days, ¥${h.trips[h.trips.length - 1].totalSpent} spent)`,
      );
      return;
    }

    if (subcmd === "history") {
      const h = loadHistory();
      if (h.trips.length === 0) {
        console.log("No travel history yet.");
        return;
      }
      for (const t of h.trips) {
        console.log(
          `✈️ ${t.destination} | ${t.departedAt} — ${t.returnedAt} | ${t.days} days | ¥${t.totalSpent}`,
        );
      }
      return;
    }

    if (subcmd === "journal") {
      const date = args[2] || new Date().toISOString().slice(0, 10);
      const files = fs
        .readdirSync(travelDir)
        .filter((f) => f.endsWith(".md") && f.includes(date));
      if (files.length === 0) {
        console.log(`No journal entries for ${date}.`);
        return;
      }
      for (const f of files) {
        console.log(`--- ${f} ---`);
        console.log(
          fs.readFileSync(pathMod.default.join(travelDir, f), "utf-8"),
        );
      }
      return;
    }

    console.error(
      "Usage: alma travel <status|go|event|advance|mood|home|history|journal>",
    );
    process.exit(1);
  }

  // ── Video Analysis (Gemini native) ──
  if (cmd === "video") {
    const fs = _fs;
    const subcmd = args[1];
    if (subcmd !== "analyze" || !args[2]) {
      console.error("Usage: alma video analyze <video-path> [prompt]");
      process.exit(1);
    }
    const videoPath = args[2];
    const prompt =
      args.slice(3).join(" ") ||
      "Describe this video in detail. What is happening? What do you see and hear?";

    if (!fs.existsSync(videoPath)) {
      console.error(`File not found: ${videoPath}`);
      process.exit(1);
    }

    // Find Google provider
    const providers = await api("GET", "/api/providers");
    const googleProvider = (providers || []).find(
      (p) => p.type === "google" && p.apiKey && p.enabled !== false,
    );
    if (!googleProvider) {
      console.error(
        "No Google/Gemini provider configured. Add one in Settings > Providers.",
      );
      process.exit(1);
    }
    const apiKey = googleProvider.apiKey;
    const baseUrl = (
      googleProvider.baseURL || "https://generativelanguage.googleapis.com"
    ).replace(/\/+$/, "");
    const apiPath = baseUrl.endsWith("/v1beta") ? "" : "/v1beta";

    // Determine MIME type
    const ext = _path.extname(videoPath).toLowerCase();
    const mimeMap = {
      ".mp4": "video/mp4",
      ".avi": "video/avi",
      ".mov": "video/quicktime",
      ".webm": "video/webm",
      ".mkv": "video/x-matroska",
      ".m4v": "video/mp4",
      ".3gp": "video/3gpp",
    };
    const mimeType = mimeMap[ext] || "video/mp4";

    // Check file size (Gemini limit: 2GB for File API)
    const stat = fs.statSync(videoPath);
    const sizeMB = stat.size / (1024 * 1024);
    console.error(
      `Uploading ${_path.basename(videoPath)} (${sizeMB.toFixed(1)} MB)...`,
    );

    // Step 1: Upload to Gemini Files API (resumable upload)
    try {
      // Initiate resumable upload
      const initResp = await fetch(
        `${baseUrl}/upload${apiPath}/files?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "X-Goog-Upload-Protocol": "resumable",
            "X-Goog-Upload-Command": "start",
            "X-Goog-Upload-Header-Content-Length": String(stat.size),
            "X-Goog-Upload-Header-Content-Type": mimeType,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file: { display_name: _path.basename(videoPath) },
          }),
        },
      );
      const uploadUrl = initResp.headers.get("x-goog-upload-url");
      if (!uploadUrl) {
        const errText = await initResp.text();
        console.error("Failed to initiate upload:", errText);
        process.exit(1);
      }

      // Upload the file content
      const fileBuffer = fs.readFileSync(videoPath);
      const uploadResp = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "X-Goog-Upload-Command": "upload, finalize",
          "X-Goog-Upload-Offset": "0",
          "Content-Length": String(stat.size),
        },
        body: fileBuffer,
      });
      const uploadData = await uploadResp.json();
      const fileUri = uploadData.file?.uri;
      if (!fileUri) {
        console.error("Upload failed:", JSON.stringify(uploadData));
        process.exit(1);
      }
      console.error(`Upload complete. File URI: ${fileUri}`);

      // Step 2: Wait for processing
      const fileName = uploadData.file.name;
      let fileState = uploadData.file.state;
      let retries = 0;
      while (fileState === "PROCESSING" && retries < 60) {
        await new Promise((r) => setTimeout(r, 3000));
        const statusResp = await fetch(
          `${baseUrl}${apiPath}/${fileName}?key=${apiKey}`,
        );
        const statusData = await statusResp.json();
        fileState = statusData.state;
        retries++;
        if (fileState === "PROCESSING") {
          console.error(`Processing... (${retries * 3}s)`);
        }
      }
      if (fileState !== "ACTIVE") {
        console.error(`File processing failed. State: ${fileState}`);
        process.exit(1);
      }

      // Step 3: Generate content with video
      console.error("Analyzing video with Gemini...");
      const model = "gemini-2.5-flash";
      const genResp = await fetch(
        `${baseUrl}${apiPath}/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { file_data: { mime_type: mimeType, file_uri: fileUri } },
                  { text: prompt },
                ],
              },
            ],
          }),
        },
      );
      const genData = await genResp.json();
      const text = genData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        console.log(text);
      } else {
        console.error(
          "No response from Gemini:",
          JSON.stringify(genData).substring(0, 500),
        );
        process.exit(1);
      }

      // Step 4: Clean up uploaded file
      fetch(`${baseUrl}${apiPath}/${fileName}?key=${apiKey}`, {
        method: "DELETE",
      }).catch(() => {});
    } catch (err) {
      console.error(
        "Video analysis failed:",
        err instanceof Error ? err.message : err,
      );
      process.exit(1);
    }
    return;
  }

  // ── Browser (Chrome Relay) ──────────────────────────────
  if (cmd === "browser") {
    const subcmd = args[1];

    if (!subcmd || subcmd === "help") {
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

    if (subcmd === "status") {
      const data = await api("GET", "/api/chrome-relay/status");
      prettyPrint(data);
      return;
    }

    if (subcmd === "tabs") {
      const data = await api("POST", "/api/chrome-relay/tabs");
      if (data.tabs && data.tabs.length === 0) {
        console.log("No tabs found.");
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

    if (subcmd === "open") {
      const url = args[2];
      const data = await api(
        "POST",
        "/api/chrome-relay/tabs/create",
        url ? { url } : {},
      );
      console.log(`Tab created: [${data.id}] ${data.title || ""}`);
      if (data.url) console.log(`  ${data.url}`);
      return;
    }

    if (subcmd === "goto") {
      const tabId = parseInt(args[2], 10);
      const url = args[3];
      if (!tabId || !url) {
        console.error("Usage: alma browser goto <tabId> <url>");
        process.exit(1);
      }
      const data = await api("POST", "/api/chrome-relay/navigate", {
        tabId,
        url,
      });
      console.log(`Navigated: ${data.title || ""}`);
      if (data.url) console.log(`  ${data.url}`);
      return;
    }

    if (subcmd === "click") {
      const tabId = parseInt(args[2], 10);
      const selector = args[3];
      if (!tabId || !selector) {
        console.error("Usage: alma browser click <tabId> <selector>");
        process.exit(1);
      }
      const data = await api("POST", "/api/chrome-relay/click", {
        tabId,
        selector,
      });
      if (data.success) console.log("Clicked.");
      else console.error("Click failed:", data.error || "unknown error");
      return;
    }

    if (subcmd === "type") {
      const tabId = parseInt(args[2], 10);
      const selector = args[3];
      const text = args[4];
      const pressEnter = args.includes("--enter");
      if (!tabId || !selector || !text) {
        console.error(
          "Usage: alma browser type <tabId> <selector> <text> [--enter]",
        );
        process.exit(1);
      }
      const data = await api("POST", "/api/chrome-relay/type", {
        tabId,
        selector,
        text,
        pressEnter,
      });
      if (data.success) console.log("Typed.");
      else console.error("Type failed:", data.error || "unknown error");
      return;
    }

    if (subcmd === "screenshot") {
      const tabId = args[2] ? parseInt(args[2], 10) : undefined;
      const data = await api(
        "POST",
        "/api/chrome-relay/screenshot",
        tabId ? { tabId } : {},
      );
      if (data.path) {
        console.log(data.path);
      } else {
        console.error("Screenshot failed:", data.error || "unknown error");
        process.exit(1);
      }
      return;
    }

    if (subcmd === "read") {
      const tabId = parseInt(args[2], 10);
      if (!tabId) {
        console.error("Usage: alma browser read <tabId>");
        process.exit(1);
      }
      const data = await api("POST", "/api/chrome-relay/read", { tabId });
      if (data.title) console.log(`# ${data.title}\n`);
      if (data.url) console.log(`URL: ${data.url}\n`);
      if (data.markdown) console.log(data.markdown);
      if (data.truncated) console.log("\n(content truncated)");
      return;
    }

    if (subcmd === "read-dom") {
      const tabId = parseInt(args[2], 10);
      if (!tabId) {
        console.error("Usage: alma browser read-dom <tabId>");
        process.exit(1);
      }
      const data = await api("POST", "/api/chrome-relay/read-dom", { tabId });
      prettyPrint(data);
      return;
    }

    if (subcmd === "eval") {
      const tabId = parseInt(args[2], 10);
      const code = args.slice(3).join(" ");
      if (!tabId || !code) {
        console.error("Usage: alma browser eval <tabId> <code>");
        process.exit(1);
      }
      const data = await api("POST", "/api/chrome-relay/eval", { tabId, code });
      if (data.error) console.error("Error:", data.error);
      else if (data.result !== undefined) console.log(data.result);
      return;
    }

    if (subcmd === "scroll") {
      const tabId = parseInt(args[2], 10);
      const direction = args[3];
      const amount = args[4] ? parseInt(args[4], 10) : undefined;
      if (!tabId || !direction || !["up", "down"].includes(direction)) {
        console.error("Usage: alma browser scroll <tabId> <up|down> [amount]");
        process.exit(1);
      }
      const body = { tabId, direction };
      if (amount) body.amount = amount;
      const data = await api("POST", "/api/chrome-relay/scroll", body);
      if (data.success) console.log("Scrolled " + direction + ".");
      return;
    }

    if (subcmd === "back") {
      const tabId = parseInt(args[2], 10);
      if (!tabId) {
        console.error("Usage: alma browser back <tabId>");
        process.exit(1);
      }
      const data = await api("POST", "/api/chrome-relay/back", { tabId });
      if (data.success) console.log("Went back.");
      return;
    }

    if (subcmd === "forward") {
      const tabId = parseInt(args[2], 10);
      if (!tabId) {
        console.error("Usage: alma browser forward <tabId>");
        process.exit(1);
      }
      const data = await api("POST", "/api/chrome-relay/forward", { tabId });
      if (data.success) console.log("Went forward.");
      return;
    }

    console.error(
      `Unknown browser subcommand: ${subcmd}. Run 'alma browser help' for usage.`,
    );
    process.exit(1);
  }

  // ───────────────────── mission ─────────────────────
  if (cmd === "mission") {
    const missionsDir = _path.join(
      _os.homedir(),
      ".config",
      "alma",
      "missions",
    );
    const missionsFile = _path.join(missionsDir, "missions.json");
    if (!_fs.existsSync(missionsDir))
      _fs.mkdirSync(missionsDir, { recursive: true });

    const loadMissions = () => {
      try {
        return JSON.parse(_fs.readFileSync(missionsFile, "utf-8"));
      } catch {
        return [];
      }
    };
    const saveMissions = (missions) => {
      _fs.writeFileSync(missionsFile, JSON.stringify(missions, null, 2) + "\n");
    };

    const subcmd = args[1];

    if (subcmd === "create") {
      const desc = args[2];
      if (!desc) {
        console.error(
          'Usage: alma mission create "description" [--goals "g1" "g2" ...]',
        );
        process.exit(1);
      }
      const goalsIdx = args.indexOf("--goals");
      const goals =
        goalsIdx >= 0
          ? args
              .slice(goalsIdx + 1)
              .map((g, i) => ({ id: i + 1, text: g, status: "pending" }))
          : [];
      const id = "m-" + Date.now().toString(36);
      const mission = {
        id,
        description: desc,
        status: "pending",
        goals,
        agents: [],
        logs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        summary: null,
      };
      const missions = loadMissions();
      missions.push(mission);
      saveMissions(missions);
      console.log(
        JSON.stringify({ id, description: desc, goals: goals.length }),
      );
      return;
    }

    if (subcmd === "list") {
      const all = args.includes("--all");
      const missions = loadMissions().filter(
        (m) => all || m.status === "active",
      );
      for (const m of missions) {
        const done = m.goals.filter((g) => g.status === "done").length;
        const total = m.goals.length;
        const icon =
          m.status === "active" ? "🟢" : m.status === "completed" ? "✅" : "❌";
        console.log(
          `${icon} ${m.id} — "${m.description}" [${done}/${total} goals] ${m.agents.length} agents`,
        );
      }
      if (missions.length === 0) console.log("No missions.");
      return;
    }

    if (subcmd === "status") {
      const mid = args[2];
      if (!mid) {
        console.error("Usage: alma mission status <missionId>");
        process.exit(1);
      }
      const mission = loadMissions().find((m) => m.id === mid);
      if (!mission) {
        console.error(`Mission ${mid} not found`);
        process.exit(1);
      }
      console.log(JSON.stringify(mission, null, 2));
      return;
    }

    if (subcmd === "progress") {
      const mid = args[2];
      const goalIdx = args.indexOf("--goal");
      const statusIdx = args.indexOf("--status");
      const noteIdx = args.indexOf("--note");
      if (!mid || goalIdx < 0 || statusIdx < 0) {
        console.error(
          'Usage: alma mission progress <missionId> --goal <num> --status <pending|in-progress|done|blocked> [--note "..."]',
        );
        process.exit(1);
      }
      const missions = loadMissions();
      const mission = missions.find((m) => m.id === mid);
      if (!mission) {
        console.error(`Mission ${mid} not found`);
        process.exit(1);
      }
      const goalNum = parseInt(args[goalIdx + 1]);
      const goal = mission.goals.find((g) => g.id === goalNum);
      if (!goal) {
        console.error(`Goal ${goalNum} not found`);
        process.exit(1);
      }
      goal.status = args[statusIdx + 1];
      if (noteIdx >= 0) goal.note = args[noteIdx + 1];
      mission.updatedAt = new Date().toISOString();
      saveMissions(missions);
      console.log(`Goal ${goalNum} → ${goal.status}`);
      return;
    }

    if (subcmd === "assign") {
      const mid = args[2];
      const agentIdx = args.indexOf("--agent");
      const roleIdx = args.indexOf("--role");
      if (!mid || agentIdx < 0) {
        console.error(
          'Usage: alma mission assign <missionId> --agent <taskId> [--role "..."]',
        );
        process.exit(1);
      }
      const missions = loadMissions();
      const mission = missions.find((m) => m.id === mid);
      if (!mission) {
        console.error(`Mission ${mid} not found`);
        process.exit(1);
      }
      mission.agents.push({
        taskId: args[agentIdx + 1],
        role: roleIdx >= 0 ? args[roleIdx + 1] : "general",
        assignedAt: new Date().toISOString(),
      });
      mission.updatedAt = new Date().toISOString();
      saveMissions(missions);
      console.log(`Agent ${args[agentIdx + 1]} assigned to ${mid}`);
      return;
    }

    if (subcmd === "activate" || subcmd === "start") {
      const mid = args[2];
      if (!mid) {
        console.error(`Usage: alma mission activate <missionId>`);
        process.exit(1);
      }
      const missions = loadMissions();
      const mission = missions.find((m) => m.id === mid);
      if (!mission) {
        console.error(`Mission ${mid} not found`);
        process.exit(1);
      }
      mission.status = "active";
      mission.updatedAt = new Date().toISOString();
      saveMissions(missions);
      console.log(`Mission ${mid} → active`);
      return;
    }

    if (subcmd === "complete" || subcmd === "cancel") {
      const mid = args[2];
      if (!mid) {
        console.error(
          `Usage: alma mission ${subcmd} <missionId> [--summary/--reason "..."]`,
        );
        process.exit(1);
      }
      const missions = loadMissions();
      const mission = missions.find((m) => m.id === mid);
      if (!mission) {
        console.error(`Mission ${mid} not found`);
        process.exit(1);
      }
      mission.status = subcmd === "complete" ? "completed" : "cancelled";
      mission.completedAt = new Date().toISOString();
      mission.updatedAt = new Date().toISOString();
      const summaryIdx = args.indexOf("--summary");
      const reasonIdx = args.indexOf("--reason");
      if (summaryIdx >= 0) mission.summary = args[summaryIdx + 1];
      if (reasonIdx >= 0) mission.summary = args[reasonIdx + 1];
      saveMissions(missions);
      console.log(`Mission ${mid} → ${mission.status}`);
      return;
    }

    if (subcmd === "log") {
      const mid = args[2];
      const msg = args[3];
      if (!mid || !msg) {
        console.error('Usage: alma mission log <missionId> "message"');
        process.exit(1);
      }
      const missions = loadMissions();
      const mission = missions.find((m) => m.id === mid);
      if (!mission) {
        console.error(`Mission ${mid} not found`);
        process.exit(1);
      }
      mission.logs.push({ text: msg, at: new Date().toISOString() });
      mission.updatedAt = new Date().toISOString();
      saveMissions(missions);
      console.log("Logged.");
      return;
    }

    console.error(
      `Unknown mission subcommand: ${subcmd}. Commands: create, list, status, progress, assign, complete, cancel, log`,
    );
    process.exit(1);
  }

  // ───────────────────── comms ─────────────────────
  if (cmd === "comms") {
    const commsDir = _path.join(
      _os.homedir(),
      ".config",
      "alma",
      "missions",
      "comms",
    );
    const dmDir = _path.join(commsDir, "dm");
    if (!_fs.existsSync(commsDir)) _fs.mkdirSync(commsDir, { recursive: true });
    if (!_fs.existsSync(dmDir)) _fs.mkdirSync(dmDir, { recursive: true });

    const subcmd = args[1];

    if (subcmd === "send") {
      const target = args[2]; // missionId
      const msg = args[3];
      if (!target || !msg) {
        console.error('Usage: alma comms send <missionId> "message"');
        process.exit(1);
      }
      const channelFile = _path.join(commsDir, `${target}.jsonl`);
      const entry = JSON.stringify({
        from: process.env.ALMA_AGENT_ID || "alma",
        text: msg,
        at: new Date().toISOString(),
      });
      _fs.appendFileSync(channelFile, entry + "\n");
      console.log("Sent.");
      return;
    }

    if (subcmd === "dm") {
      const targetAgent = args[2];
      const msg = args[3];
      if (!targetAgent || !msg) {
        console.error('Usage: alma comms dm <agentTaskId> "message"');
        process.exit(1);
      }
      const dmFile = _path.join(dmDir, `${targetAgent}.jsonl`);
      const entry = JSON.stringify({
        from: process.env.ALMA_AGENT_ID || "alma",
        text: msg,
        at: new Date().toISOString(),
      });
      _fs.appendFileSync(dmFile, entry + "\n");
      console.log("DM sent.");
      return;
    }

    if (subcmd === "read") {
      const target = args[2];
      if (!target) {
        console.error("Usage: alma comms read <missionId> [--limit N]");
        process.exit(1);
      }
      const channelFile = _path.join(commsDir, `${target}.jsonl`);
      if (!_fs.existsSync(channelFile)) {
        console.log("No messages.");
        return;
      }
      const limitIdx = args.indexOf("--limit");
      const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : 20;
      const lines = _fs
        .readFileSync(channelFile, "utf-8")
        .trim()
        .split("\n")
        .filter(Boolean);
      const msgs = lines.slice(-limit);
      for (const line of msgs) {
        try {
          const m = JSON.parse(line);
          console.log(`[${m.at}] ${m.from}: ${m.text}`);
        } catch {
          console.log(line);
        }
      }
      return;
    }

    if (subcmd === "inbox") {
      const agentId = args[2] || process.env.ALMA_AGENT_ID || "alma";
      const dmFile = _path.join(dmDir, `${agentId}.jsonl`);
      if (!_fs.existsSync(dmFile)) {
        console.log("No DMs.");
        return;
      }
      const lines = _fs
        .readFileSync(dmFile, "utf-8")
        .trim()
        .split("\n")
        .filter(Boolean);
      for (const line of lines.slice(-20)) {
        try {
          const m = JSON.parse(line);
          console.log(`[${m.at}] ${m.from}: ${m.text}`);
        } catch {
          console.log(line);
        }
      }
      return;
    }

    if (subcmd === "broadcast") {
      const msg = args[2];
      if (!msg) {
        console.error('Usage: alma comms broadcast "message"');
        process.exit(1);
      }
      const missionsFile = _path.join(
        _os.homedir(),
        ".config",
        "alma",
        "missions",
        "missions.json",
      );
      let missions = [];
      try {
        missions = JSON.parse(_fs.readFileSync(missionsFile, "utf-8"));
      } catch {}
      const active = missions.filter((m) => m.status === "active");
      for (const m of active) {
        const channelFile = _path.join(commsDir, `${m.id}.jsonl`);
        const entry = JSON.stringify({
          from: "alma-broadcast",
          text: msg,
          at: new Date().toISOString(),
        });
        _fs.appendFileSync(channelFile, entry + "\n");
      }
      console.log(`Broadcast to ${active.length} missions.`);
      return;
    }

    console.error(
      `Unknown comms subcommand: ${subcmd}. Commands: send, dm, read, inbox, broadcast`,
    );
    process.exit(1);
  }

  console.error(`Unknown command: ${cmd}. Run 'alma help' for usage.`);
  process.exit(1);
}

main();
