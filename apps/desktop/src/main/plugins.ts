import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { getConfigDir, sqlite } from "./db.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PluginManifest {
  name: string;
  version: string;
  description: string;
  main: string;
  author?: string;
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  main: string;
  author?: string;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPluginsDir(): string {
  return path.join(getConfigDir(), "plugins");
}

// ---------------------------------------------------------------------------
// Plugin operations
// ---------------------------------------------------------------------------

export function loadPlugin(pluginDir: string): PluginInfo {
  const manifestPath = path.join(pluginDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`No manifest.json found in ${pluginDir}`);
  }

  const raw = fs.readFileSync(manifestPath, "utf-8");
  const manifest = JSON.parse(raw) as Partial<PluginManifest>;

  if (!manifest.name || !manifest.version || !manifest.description || !manifest.main) {
    throw new Error("manifest.json must contain name, version, description, and main fields");
  }

  const dirName = path.basename(pluginDir);

  // Check if plugin exists in DB
  const row = sqlite
    .prepare("SELECT enabled FROM plugins WHERE name = ?")
    .get(dirName) as { enabled: number } | undefined;

  return {
    id: dirName,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    main: manifest.main,
    author: manifest.author,
    enabled: row ? row.enabled === 1 : true,
  };
}

export function listPlugins(): PluginInfo[] {
  const pluginsDir = getPluginsDir();
  if (!fs.existsSync(pluginsDir)) return [];

  const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
  const plugins: PluginInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pluginDir = path.join(pluginsDir, entry.name);
    const manifestPath = path.join(pluginDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) continue;

    try {
      plugins.push(loadPlugin(pluginDir));
    } catch {
      // Skip malformed plugins
    }
  }

  return plugins;
}

export function installPlugin(source: string): PluginInfo {
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
    throw new Error("Source must be an existing local directory path");
  }

  const manifestPath = path.join(source, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error("Source directory must contain a manifest.json");
  }

  // Validate manifest before copying
  const info = loadPlugin(source);

  const destDir = path.join(getPluginsDir(), info.id);
  if (fs.existsSync(destDir)) {
    throw new Error(`Plugin "${info.id}" is already installed`);
  }

  fs.cpSync(source, destDir, { recursive: true });

  // Register in DB
  const id = crypto.randomUUID();
  sqlite
    .prepare(
      "INSERT INTO plugins (id, name, version, description, author, main, enabled) VALUES (?, ?, ?, ?, ?, ?, 1)",
    )
    .run(id, info.name, info.version, info.description, info.author || null, info.main);

  return loadPlugin(destDir);
}

export function uninstallPlugin(name: string): boolean {
  const pluginDir = path.join(getPluginsDir(), name);
  if (!fs.existsSync(pluginDir)) return false;

  fs.rmSync(pluginDir, { recursive: true, force: true });

  // Remove from DB
  sqlite.prepare("DELETE FROM plugins WHERE name = ?").run(name);
  sqlite.prepare("DELETE FROM plugin_settings WHERE plugin_id = ?").run(name);

  return true;
}

export function getPluginSettings(pluginId: string): Record<string, unknown> {
  const row = sqlite
    .prepare("SELECT settings FROM plugin_settings WHERE plugin_id = ?")
    .get(pluginId) as { settings: string | null } | undefined;

  if (!row || !row.settings) return {};
  return JSON.parse(row.settings) as Record<string, unknown>;
}

export function setPluginSettings(
  pluginId: string,
  settings: Record<string, unknown>,
): void {
  const existing = sqlite
    .prepare("SELECT id FROM plugin_settings WHERE plugin_id = ?")
    .get(pluginId) as { id: string } | undefined;

  const json = JSON.stringify(settings);

  if (existing) {
    sqlite
      .prepare("UPDATE plugin_settings SET settings = ? WHERE plugin_id = ?")
      .run(json, pluginId);
  } else {
    const id = crypto.randomUUID();
    sqlite
      .prepare("INSERT INTO plugin_settings (id, plugin_id, settings) VALUES (?, ?, ?)")
      .run(id, pluginId, json);
  }
}
