import { useState, useEffect, useCallback } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { cn } from '@tomu/ui';
import type { Provider, Person, Skill, Config, AgentProfile } from '@tomu/core';
import { settingsModalOpenAtom, settingsAtom, providersAtom, currentModelAtom, agentsConfigAtom } from '../store/atoms';
import { api } from '../lib/api';

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function importJsonFile(handler: (data: unknown) => Promise<void>) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await handler(data);
    } catch {
      // ignore
    }
  };
  input.click();
}

type Tab = 'general' | 'providers' | 'memory' | 'people' | 'skills' | 'integrations' | 'agents';

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'providers', label: 'Providers' },
  { id: 'memory', label: 'Memory' },
  { id: 'people', label: 'People' },
  { id: 'skills', label: 'Skills' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'agents', label: 'Agents' },
];

// ---------------------------------------------------------------------------
// General Tab
// ---------------------------------------------------------------------------

function GeneralTab() {
  const [settings, setSettings] = useAtom(settingsAtom);
  const [saving, setSaving] = useState(false);

  const update = async (patch: Partial<Config>) => {
    setSaving(true);
    try {
      const updated = await api.updateSettings(patch);
      setSettings(updated);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-lg font-semibold text-fg-primary">General</h3>

      {/* Theme */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-fg-secondary">Theme</label>
        <div className="flex gap-2">
          {(['system', 'dark', 'light'] as const).map((t) => (
            <button
              key={t}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm capitalize',
                settings.theme === t
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border text-fg-secondary hover:bg-bg-tertiary',
              )}
              onClick={() => update({ theme: t })}
              disabled={saving}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Language */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-fg-secondary">Language</label>
        <select
          className="w-48 rounded-md border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-fg-primary"
          value={settings.language}
          onChange={(e) => update({ language: e.target.value as Config['language'] })}
          disabled={saving}
        >
          <option value="en">English</option>
          <option value="ja">Japanese</option>
          <option value="zh">Chinese</option>
        </select>
      </div>

      {/* Max iterations */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-fg-secondary">
          Agent max iterations: {settings.agent_max_iterations}
        </label>
        <input
          type="range"
          min={1}
          max={50}
          value={settings.agent_max_iterations}
          onChange={(e) => update({ agent_max_iterations: Number(e.target.value) })}
          className="w-64"
          disabled={saving}
        />
      </div>

      {/* Export & Import */}
      <div className="flex flex-col gap-3">
        <label className="text-sm font-medium text-fg-secondary">Export & Import</label>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md border border-border px-3 py-1.5 text-xs text-fg-secondary hover:bg-bg-tertiary"
            onClick={async () => {
              try {
                const data = await api.exportThreads();
                downloadJson(data, 'tomu-threads.json');
              } catch { /* ignore */ }
            }}
          >
            Export Threads
          </button>
          <button
            className="rounded-md border border-border px-3 py-1.5 text-xs text-fg-secondary hover:bg-bg-tertiary"
            onClick={async () => {
              try {
                const data = await api.exportMemories();
                downloadJson(data, 'tomu-memories.json');
              } catch { /* ignore */ }
            }}
          >
            Export Memories
          </button>
          <button
            className="rounded-md border border-border px-3 py-1.5 text-xs text-fg-secondary hover:bg-bg-tertiary"
            onClick={async () => {
              try {
                const data = await api.exportSettings();
                downloadJson(data, 'tomu-settings.json');
              } catch { /* ignore */ }
            }}
          >
            Export Settings
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md border border-border px-3 py-1.5 text-xs text-fg-secondary hover:bg-bg-tertiary"
            onClick={() => importJsonFile((data) => api.importThreads(data))}
          >
            Import Threads
          </button>
          <button
            className="rounded-md border border-border px-3 py-1.5 text-xs text-fg-secondary hover:bg-bg-tertiary"
            onClick={() => importJsonFile((data) => api.importMemories(data))}
          >
            Import Memories
          </button>
        </div>
      </div>

      {/* Version */}
      <div className="text-xs text-fg-muted">tomu v0.1.0</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Providers Tab
// ---------------------------------------------------------------------------

const PROVIDER_TYPES = ['openai', 'anthropic', 'gemini', 'ollama', 'openrouter', 'custom'] as const;

function ProvidersTab() {
  const [providers, setProviders] = useAtom(providersAtom);
  const [settings, setSettings] = useAtom(settingsAtom);
  const [currentModel, setCurrentModel] = useAtom(currentModelAtom);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; error?: string }>>({});

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<Provider['type']>('openai');
  const [formKey, setFormKey] = useState('');
  const [formUrl, setFormUrl] = useState('');

  const handleAdd = async () => {
    if (!formName.trim()) return;
    try {
      const p = await api.createProvider({
        name: formName,
        type: formType,
        api_key: formKey || undefined,
        base_url: formUrl || undefined,
      });
      setProviders((prev) => [...prev, p]);
      setShowForm(false);
      setFormName('');
      setFormKey('');
      setFormUrl('');
    } catch {
      // ignore
    }
  };

  const handleTest = async (id: string) => {
    try {
      const result = await api.testProvider(id);
      setTestResults((prev) => ({ ...prev, [id]: result }));
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { success: false, error: 'Request failed' } }));
    }
  };

  const handleFetchModels = async (id: string) => {
    try {
      const models = await api.fetchModels(id);
      setProviders((prev) =>
        prev.map((p) => (p.id === id ? { ...p, models } : p)),
      );
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteProvider(id);
      setProviders((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // ignore
    }
  };

  const handleSetDefault = async (modelId: string, providerId: string) => {
    try {
      const updated = await api.updateSettings({ ...settings, default_model_id: modelId, default_provider_id: providerId });
      setSettings(updated);
      setCurrentModel(modelId);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-fg-primary">Providers</h3>
        <button
          className="rounded-md border border-border px-3 py-1.5 text-sm text-fg-secondary hover:bg-bg-tertiary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : 'Add Provider'}
        </button>
      </div>

      {showForm && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-tertiary p-4">
          <input
            className="rounded-md border border-border bg-bg-primary px-3 py-1.5 text-sm text-fg-primary placeholder:text-fg-muted"
            placeholder="Provider name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <select
            className="rounded-md border border-border bg-bg-primary px-3 py-1.5 text-sm text-fg-primary"
            value={formType}
            onChange={(e) => setFormType(e.target.value as Provider['type'])}
          >
            {PROVIDER_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            type="password"
            className="rounded-md border border-border bg-bg-primary px-3 py-1.5 text-sm text-fg-primary placeholder:text-fg-muted"
            placeholder="API key (optional)"
            value={formKey}
            onChange={(e) => setFormKey(e.target.value)}
          />
          <input
            className="rounded-md border border-border bg-bg-primary px-3 py-1.5 text-sm text-fg-primary placeholder:text-fg-muted"
            placeholder="Base URL (optional)"
            value={formUrl}
            onChange={(e) => setFormUrl(e.target.value)}
          />
          <button
            className="self-start rounded-md bg-accent px-4 py-1.5 text-sm text-white hover:bg-accent/80"
            onClick={handleAdd}
          >
            Add
          </button>
        </div>
      )}

      {providers.length === 0 && !showForm && (
        <p className="text-sm text-fg-muted">No providers configured.</p>
      )}

      <div className="flex flex-col gap-2">
        {providers.map((p) => (
          <div key={p.id} className="rounded-lg border border-border bg-bg-tertiary">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-fg-primary">{p.name}</span>
                <span className="rounded bg-bg-primary px-1.5 py-0.5 text-xs text-fg-muted">{p.type}</span>
                <span className={cn('h-2 w-2 rounded-full', p.enabled ? 'bg-green-400' : 'bg-fg-muted')} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded px-2 py-1 text-xs text-fg-secondary hover:bg-bg-primary"
                  onClick={() => handleTest(p.id)}
                >
                  Test
                </button>
                <button
                  className="rounded px-2 py-1 text-xs text-fg-secondary hover:bg-bg-primary"
                  onClick={() => handleFetchModels(p.id)}
                >
                  Fetch Models
                </button>
                <button
                  className="rounded px-2 py-1 text-xs text-red-400 hover:bg-bg-primary"
                  onClick={() => handleDelete(p.id)}
                >
                  Delete
                </button>
              </div>
            </div>

            {testResults[p.id] && (
              <div className={cn('border-t border-border px-4 py-2 text-xs', testResults[p.id].success ? 'text-green-400' : 'text-red-400')}>
                {testResults[p.id].success ? 'Connection successful' : `Error: ${testResults[p.id].error}`}
              </div>
            )}

            {p.models.length > 0 && (
              <div className="border-t border-border">
                <button
                  className="flex w-full items-center gap-1.5 px-4 py-2 text-xs text-fg-muted hover:text-fg-secondary"
                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                >
                  <svg
                    className={cn('h-3 w-3 transition-transform', expandedId === p.id && 'rotate-90')}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 5l8 7-8 7z" />
                  </svg>
                  {p.models.length} model{p.models.length !== 1 && 's'}
                </button>
                {expandedId === p.id && (
                  <ul className="px-4 pb-3">
                    {p.models.map((m) => (
                      <li key={m.id} className="flex items-center justify-between py-0.5">
                        <span className="text-xs text-fg-secondary">{m.name}</span>
                        <button
                          className={cn(
                            'rounded px-2 py-0.5 text-xs',
                            currentModel === m.id
                              ? 'text-accent'
                              : 'text-fg-muted hover:text-fg-secondary',
                          )}
                          onClick={() => handleSetDefault(m.id, p.id)}
                        >
                          {currentModel === m.id ? 'Default ✓' : 'Set default'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Memory Tab (reuses MemoryPanel content inline)
// ---------------------------------------------------------------------------

function MemoryTab() {
  return <MemoryPanelInline />;
}

function MemoryPanelInline() {
  // Re-implement the memory panel content inline (without the slide-over wrapper)
  const [stats, setStats] = useState<{ total: number; by_type: Record<string, number>; db_size_bytes: number } | null>(null);
  const [memories, setMemories] = useState<Array<{ id: string; content: string; type: string; created_at: string }>>([]);
  const [rebuilding, setRebuilding] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([api.getMemoryStats(), api.getMemories(20)]);
      setStats(s);
      setMemories(m);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const TYPE_COLORS: Record<string, string> = {
    message: 'bg-blue-500/20 text-blue-400',
    note: 'bg-green-500/20 text-green-400',
    temporary: 'bg-yellow-500/20 text-yellow-400',
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-fg-primary">Memory</h3>

      {stats && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-fg-muted">Total memories</div>
          <div className="text-fg-primary">{stats.total}</div>
          <div className="text-fg-muted">DB size</div>
          <div className="text-fg-primary">{formatBytes(stats.db_size_bytes)}</div>
          {Object.entries(stats.by_type).map(([type, count]) => (
            <div key={type} className="contents">
              <div className="text-fg-muted capitalize">{type}</div>
              <div className="text-fg-primary">{count}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          className={cn('rounded-md border border-border px-3 py-1.5 text-xs text-fg-secondary hover:bg-bg-tertiary', rebuilding && 'pointer-events-none opacity-60')}
          onClick={async () => { setRebuilding(true); try { await api.rebuildEmbeddings(); } catch {} finally { setRebuilding(false); } }}
          disabled={rebuilding}
        >
          {rebuilding ? 'Rebuilding...' : 'Rebuild Embeddings'}
        </button>
        <button
          className={cn('rounded-md border border-border px-3 py-1.5 text-xs text-fg-secondary hover:bg-bg-tertiary', cleaning && 'pointer-events-none opacity-60')}
          onClick={async () => { setCleaning(true); try { await api.cleanupMemories(); await load(); } catch {} finally { setCleaning(false); } }}
          disabled={cleaning}
        >
          {cleaning ? 'Cleaning...' : 'Clean Up'}
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {memories.map((mem) => (
          <li key={mem.id} className="rounded-md border border-border p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', TYPE_COLORS[mem.type] ?? 'bg-fg-muted/20 text-fg-muted')}>
                {mem.type}
              </span>
              <span className="text-[10px] text-fg-muted">
                {new Date(mem.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="line-clamp-2 text-xs text-fg-secondary">{mem.content}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// People Tab
// ---------------------------------------------------------------------------

function PeopleTab() {
  const [people, setPeople] = useState<Person[]>([]);
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editNotes, setEditNotes] = useState<Record<string, string>>({});

  // Form state
  const [formName, setFormName] = useState('');
  const [formRelation, setFormRelation] = useState('');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    api.getPeople().then(setPeople).catch(() => {});
  }, []);

  const handleAdd = async () => {
    if (!formName.trim()) return;
    try {
      const person = await api.createPerson({
        name: formName,
        metadata: { relationship: formRelation },
        notes: formNotes,
      });
      setPeople((prev) => [...prev, person]);
      setShowForm(false);
      setFormName('');
      setFormRelation('');
      setFormNotes('');
    } catch {
      // ignore
    }
  };

  const handleSaveNotes = async (name: string) => {
    const notes = editNotes[name];
    if (notes === undefined) return;
    try {
      await api.updatePerson(name, { notes });
      setPeople((prev) => prev.map((p) => (p.name === name ? { ...p, notes } : p)));
    } catch {
      // ignore
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await api.deletePerson(name);
      setPeople((prev) => prev.filter((p) => p.name !== name));
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-fg-primary">People</h3>
        <button
          className="rounded-md border border-border px-3 py-1.5 text-sm text-fg-secondary hover:bg-bg-tertiary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : 'Add Person'}
        </button>
      </div>

      {showForm && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-tertiary p-4">
          <input
            className="rounded-md border border-border bg-bg-primary px-3 py-1.5 text-sm text-fg-primary placeholder:text-fg-muted"
            placeholder="Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <input
            className="rounded-md border border-border bg-bg-primary px-3 py-1.5 text-sm text-fg-primary placeholder:text-fg-muted"
            placeholder="Relationship (e.g. colleague, friend)"
            value={formRelation}
            onChange={(e) => setFormRelation(e.target.value)}
          />
          <textarea
            className="rounded-md border border-border bg-bg-primary px-3 py-1.5 text-sm text-fg-primary placeholder:text-fg-muted"
            placeholder="Notes"
            rows={3}
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
          />
          <button
            className="self-start rounded-md bg-accent px-4 py-1.5 text-sm text-white hover:bg-accent/80"
            onClick={handleAdd}
          >
            Add
          </button>
        </div>
      )}

      {people.length === 0 && !showForm && (
        <p className="text-sm text-fg-muted">No people added yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {people.map((p) => {
          const relationship = (p.metadata?.relationship as string) || '';
          const isExpanded = expandedName === p.name;
          return (
            <div key={p.name} className="rounded-lg border border-border bg-bg-tertiary">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  className="flex items-center gap-2 text-left"
                  onClick={() => {
                    if (isExpanded) {
                      setExpandedName(null);
                    } else {
                      setExpandedName(p.name);
                      setEditNotes((prev) => ({ ...prev, [p.name]: p.notes }));
                    }
                  }}
                >
                  <span className="text-sm font-medium text-fg-primary">{p.name}</span>
                  {relationship && (
                    <span className="text-xs text-fg-muted">{relationship}</span>
                  )}
                </button>
                <button
                  className="rounded px-2 py-1 text-xs text-red-400 hover:bg-bg-primary"
                  onClick={() => handleDelete(p.name)}
                >
                  Delete
                </button>
              </div>
              {isExpanded && (
                <div className="border-t border-border px-4 py-3">
                  <textarea
                    className="w-full rounded-md border border-border bg-bg-primary px-3 py-1.5 text-sm text-fg-primary"
                    rows={4}
                    value={editNotes[p.name] ?? p.notes}
                    onChange={(e) => setEditNotes((prev) => ({ ...prev, [p.name]: e.target.value }))}
                  />
                  <button
                    className="mt-2 rounded-md bg-accent px-3 py-1 text-xs text-white hover:bg-accent/80"
                    onClick={() => handleSaveNotes(p.name)}
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skills Tab
// ---------------------------------------------------------------------------

function SkillsTab() {
  const [skills, setSkills] = useState<Skill[]>([]);

  useEffect(() => {
    api.getSkills().then(setSkills).catch(() => {});
  }, []);

  const handleToggle = async (id: string) => {
    try {
      const updated = await api.toggleSkill(id);
      setSkills((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-fg-primary">Skills</h3>

      {skills.length === 0 && (
        <p className="text-sm text-fg-muted">No skills installed.</p>
      )}

      <div className="flex flex-col gap-2">
        {skills.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-bg-tertiary px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-fg-primary">{s.manifest.name}</span>
              <span className="text-xs text-fg-muted">{s.manifest.description}</span>
            </div>
            <button
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors',
                (s as unknown as { enabled?: boolean }).enabled !== false ? 'bg-accent' : 'bg-fg-muted/30',
              )}
              onClick={() => handleToggle(s.id)}
            >
              <span
                className={cn(
                  'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                  (s as unknown as { enabled?: boolean }).enabled !== false && 'translate-x-5',
                )}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Integrations Tab (placeholder)
// ---------------------------------------------------------------------------

function IntegrationsTab() {
  // MCP Servers
  const [mcpServers, setMcpServers] = useState<Array<{ name: string; command: string; args: string[]; env: Record<string, string> }>>([]);
  const [showMcpForm, setShowMcpForm] = useState(false);
  const [mcpName, setMcpName] = useState('');
  const [mcpCommand, setMcpCommand] = useState('');
  const [mcpArgs, setMcpArgs] = useState('');

  // Plugins
  const [plugins, setPlugins] = useState<Array<{ name: string; version: string; description: string; enabled: boolean }>>([]);
  const [pluginSource, setPluginSource] = useState('');
  const [showPluginForm, setShowPluginForm] = useState(false);

  useEffect(() => {
    api.getMcpServers().then(setMcpServers).catch(() => {});
    api.getPlugins().then(setPlugins).catch(() => {});
  }, []);

  const handleAddMcp = async () => {
    if (!mcpName.trim() || !mcpCommand.trim()) return;
    try {
      await api.addMcpServer({
        name: mcpName,
        command: mcpCommand,
        args: mcpArgs ? mcpArgs.split(' ') : [],
      });
      const updated = await api.getMcpServers();
      setMcpServers(updated);
      setShowMcpForm(false);
      setMcpName('');
      setMcpCommand('');
      setMcpArgs('');
    } catch {
      // ignore
    }
  };

  const handleDeleteMcp = async (name: string) => {
    try {
      await api.deleteMcpServer(name);
      setMcpServers((prev) => prev.filter((s) => s.name !== name));
    } catch {
      // ignore
    }
  };

  const handleInstallPlugin = async () => {
    if (!pluginSource.trim()) return;
    try {
      await api.installPlugin(pluginSource);
      const updated = await api.getPlugins();
      setPlugins(updated);
      setShowPluginForm(false);
      setPluginSource('');
    } catch {
      // ignore
    }
  };

  const handleUninstallPlugin = async (name: string) => {
    try {
      await api.uninstallPlugin(name);
      setPlugins((prev) => prev.filter((p) => p.name !== name));
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* MCP Servers */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-fg-primary">MCP Servers</h3>
          <button
            className="rounded-md border border-border px-3 py-1.5 text-sm text-fg-secondary hover:bg-bg-tertiary"
            onClick={() => setShowMcpForm(!showMcpForm)}
          >
            {showMcpForm ? 'Cancel' : 'Add Server'}
          </button>
        </div>

        {showMcpForm && (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-tertiary p-4">
            <input
              className="rounded-md border border-border bg-bg-primary px-3 py-1.5 text-sm text-fg-primary placeholder:text-fg-muted"
              placeholder="Server name"
              value={mcpName}
              onChange={(e) => setMcpName(e.target.value)}
            />
            <input
              className="rounded-md border border-border bg-bg-primary px-3 py-1.5 text-sm text-fg-primary placeholder:text-fg-muted"
              placeholder="Command (e.g. npx)"
              value={mcpCommand}
              onChange={(e) => setMcpCommand(e.target.value)}
            />
            <input
              className="rounded-md border border-border bg-bg-primary px-3 py-1.5 text-sm text-fg-primary placeholder:text-fg-muted"
              placeholder="Arguments (space separated)"
              value={mcpArgs}
              onChange={(e) => setMcpArgs(e.target.value)}
            />
            <button
              className="self-start rounded-md bg-accent px-4 py-1.5 text-sm text-white hover:bg-accent/80"
              onClick={handleAddMcp}
            >
              Add
            </button>
          </div>
        )}

        {mcpServers.length === 0 && !showMcpForm && (
          <p className="text-sm text-fg-muted">No MCP servers configured.</p>
        )}

        <div className="flex flex-col gap-2">
          {mcpServers.map((s) => (
            <div key={s.name} className="flex items-center justify-between rounded-lg border border-border bg-bg-tertiary px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-fg-primary">{s.name}</span>
                <span className="text-xs text-fg-muted">{s.command} {s.args.join(' ')}</span>
              </div>
              <button
                className="rounded px-2 py-1 text-xs text-red-400 hover:bg-bg-primary"
                onClick={() => handleDeleteMcp(s.name)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Plugins */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-fg-primary">Plugins</h3>
          <button
            className="rounded-md border border-border px-3 py-1.5 text-sm text-fg-secondary hover:bg-bg-tertiary"
            onClick={() => setShowPluginForm(!showPluginForm)}
          >
            {showPluginForm ? 'Cancel' : 'Install Plugin'}
          </button>
        </div>

        {showPluginForm && (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-tertiary p-4">
            <input
              className="rounded-md border border-border bg-bg-primary px-3 py-1.5 text-sm text-fg-primary placeholder:text-fg-muted"
              placeholder="Plugin source (URL or package name)"
              value={pluginSource}
              onChange={(e) => setPluginSource(e.target.value)}
            />
            <button
              className="self-start rounded-md bg-accent px-4 py-1.5 text-sm text-white hover:bg-accent/80"
              onClick={handleInstallPlugin}
            >
              Install
            </button>
          </div>
        )}

        {plugins.length === 0 && !showPluginForm && (
          <p className="text-sm text-fg-muted">No plugins installed.</p>
        )}

        <div className="flex flex-col gap-2">
          {plugins.map((p) => (
            <div key={p.name} className="flex items-center justify-between rounded-lg border border-border bg-bg-tertiary px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-fg-primary">{p.name}</span>
                  <span className="rounded bg-bg-primary px-1.5 py-0.5 text-xs text-fg-muted">v{p.version}</span>
                </div>
                <span className="text-xs text-fg-muted">{p.description}</span>
              </div>
              <button
                className="rounded px-2 py-1 text-xs text-red-400 hover:bg-bg-primary"
                onClick={() => handleUninstallPlugin(p.name)}
              >
                Uninstall
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agents Tab
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<AgentProfile['category'], string> = {
  design: 'Design',
  product: 'Product',
  engineering: 'Engineering',
  research: 'Research',
  operations: 'Operations',
  custom: 'Custom',
};

const EXECUTION_MODES: AgentProfile['executionMode'][] = [
  'general-purpose', 'plan', 'coder', 'tomu-operator', 'explore', 'tomu-guide', 'statusline-setup',
];

const PRESET_COLORS = [
  '#6366f1', '#ec4899', '#22c55e', '#f59e0b', '#14b8a6',
  '#ef4444', '#3b82f6', '#8b5cf6', '#f97316', '#06b6d4',
  '#84cc16', '#6B7280',
];

// Agent editor modal (create / edit)
function AgentEditorModal({
  profile,
  allProfiles,
  onSave,
  onClose,
}: {
  profile: AgentProfile | null; // null = create new
  allProfiles: AgentProfile[];
  onSave: (profile: AgentProfile) => void;
  onClose: () => void;
}) {
  const isNew = profile === null;
  const [editorTab, setEditorTab] = useState<'general' | 'behavior'>('general');
  const [saving, setSaving] = useState(false);

  const defaultProfile: Omit<AgentProfile, 'builtIn'> = {
    id: '',
    name: '',
    category: 'custom',
    executionMode: 'general-purpose',
    enabled: true,
    color: '#6366f1',
    summary: '',
    focus: [],
    delegatesTo: [],
    prompt: '',
  };

  const [form, setForm] = useState<Omit<AgentProfile, 'builtIn'>>(
    profile ? { ...profile } : defaultProfile,
  );
  const [isDirty, setIsDirty] = useState(false);
  const [focusInput, setFocusInput] = useState('');

  const update = <K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleClose = () => {
    if (isDirty && !window.confirm('Discard unsaved changes?')) return;
    onClose();
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      let saved: AgentProfile;
      if (isNew) {
        saved = await api.createAgentProfile(form);
      } else {
        saved = await api.updateAgentProfile(profile!.id, form);
      }
      onSave(saved);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!profile || !window.confirm('Reset prompt to the original built-in content?')) return;
    setSaving(true);
    try {
      const reset = await api.resetAgentProfile(profile.id);
      setForm((prev) => ({ ...prev, prompt: reset.prompt }));
      setIsDirty(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const addFocusTag = () => {
    const tag = focusInput.trim();
    if (!tag || form.focus.includes(tag) || form.focus.length >= 5) return;
    update('focus', [...form.focus, tag]);
    setFocusInput('');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative z-10 flex h-[85vh] w-[640px] max-w-[95vw] flex-col overflow-hidden rounded-xl border border-border bg-bg-primary shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold text-fg-primary">
            {isNew ? 'Create Custom Agent' : `Edit Agent — ${profile!.name}`}
          </h3>
          <button className="rounded p-1 text-fg-muted hover:bg-bg-tertiary" onClick={handleClose}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-border px-5">
          {(['general', 'behavior'] as const).map((t) => (
            <button
              key={t}
              className={cn(
                'px-3 py-2.5 text-sm capitalize transition-colors',
                editorTab === t
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-fg-muted hover:text-fg-secondary',
              )}
              onClick={() => setEditorTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {editorTab === 'general' && (
            <div className="flex flex-col gap-4">
              {/* ID */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-fg-secondary">ID</label>
                <input
                  className={cn(
                    'rounded-md border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-fg-primary placeholder:text-fg-muted',
                    !isNew && 'cursor-not-allowed opacity-60',
                  )}
                  placeholder="e.g. my-agent"
                  value={form.id}
                  onChange={(e) => isNew && update('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  readOnly={!isNew}
                />
                <span className="text-[10px] text-fg-muted">Lowercase letters, numbers, hyphens only</span>
              </div>

              {/* Name */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-fg-secondary">Name</label>
                <input
                  className="rounded-md border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-fg-primary placeholder:text-fg-muted"
                  placeholder="Display name"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                />
              </div>

              {/* Category */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-fg-secondary">Category</label>
                <select
                  className="rounded-md border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-fg-primary"
                  value={form.category}
                  onChange={(e) => update('category', e.target.value as AgentProfile['category'])}
                >
                  {(Object.keys(CATEGORY_LABELS) as AgentProfile['category'][]).map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>

              {/* Color */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-fg-secondary">Color</label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      className={cn(
                        'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                        form.color === c ? 'border-fg-primary' : 'border-transparent',
                      )}
                      style={{ backgroundColor: c }}
                      onClick={() => update('color', c)}
                    />
                  ))}
                  <input
                    type="color"
                    className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent"
                    value={form.color}
                    onChange={(e) => update('color', e.target.value)}
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-fg-secondary">Summary</label>
                <input
                  className="rounded-md border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-fg-primary placeholder:text-fg-muted"
                  placeholder="Short description (max 100 chars)"
                  maxLength={100}
                  value={form.summary}
                  onChange={(e) => update('summary', e.target.value)}
                />
              </div>

              {/* Focus tags */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-fg-secondary">Focus Tags (max 5)</label>
                <div className="flex flex-wrap gap-1 mb-1">
                  {form.focus.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 rounded-full bg-bg-tertiary px-2 py-0.5 text-xs text-fg-secondary">
                      {tag}
                      <button className="text-fg-muted hover:text-red-400" onClick={() => update('focus', form.focus.filter((t) => t !== tag))}>×</button>
                    </span>
                  ))}
                </div>
                {form.focus.length < 5 && (
                  <div className="flex gap-1">
                    <input
                      className="flex-1 rounded-md border border-border bg-bg-tertiary px-3 py-1 text-xs text-fg-primary placeholder:text-fg-muted"
                      placeholder="Add tag..."
                      value={focusInput}
                      onChange={(e) => setFocusInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFocusTag(); } }}
                    />
                    <button
                      className="rounded-md border border-border px-2 py-1 text-xs text-fg-secondary hover:bg-bg-tertiary"
                      onClick={addFocusTag}
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              {/* Target Model */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-fg-secondary">Target Model</label>
                <input
                  className="rounded-md border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-fg-primary placeholder:text-fg-muted"
                  placeholder="Default (e.g. openai:gpt-4o)"
                  value={form.model ?? ''}
                  onChange={(e) => update('model', e.target.value || undefined)}
                />
              </div>
            </div>
          )}

          {editorTab === 'behavior' && (
            <div className="flex flex-col gap-4">
              {/* Execution Mode */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-fg-secondary">Execution Mode</label>
                <select
                  className={cn(
                    'rounded-md border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-fg-primary',
                    profile?.builtIn && 'cursor-not-allowed opacity-60',
                  )}
                  value={form.executionMode}
                  onChange={(e) => !profile?.builtIn && update('executionMode', e.target.value as AgentProfile['executionMode'])}
                  disabled={profile?.builtIn}
                >
                  {EXECUTION_MODES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Delegates To */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-fg-secondary">Delegates To</label>
                <div className="flex flex-col gap-1">
                  {allProfiles
                    .filter((p) => p.id !== form.id)
                    .map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm text-fg-secondary">
                        <input
                          type="checkbox"
                          checked={form.delegatesTo.includes(p.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              update('delegatesTo', [...form.delegatesTo, p.id]);
                            } else {
                              update('delegatesTo', form.delegatesTo.filter((id) => id !== p.id));
                            }
                          }}
                          className="accent-accent"
                        />
                        <span
                          className="h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: p.color }}
                        />
                        {p.name}
                      </label>
                    ))}
                </div>
              </div>

              {/* System Prompt */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-fg-secondary">System Prompt</label>
                  {profile?.builtIn && (
                    <button
                      className="rounded px-2 py-0.5 text-xs text-fg-muted hover:text-fg-secondary hover:bg-bg-tertiary"
                      onClick={handleReset}
                      disabled={saving}
                    >
                      Reset to default
                    </button>
                  )}
                </div>
                <textarea
                  className="min-h-[240px] w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 font-mono text-xs text-fg-primary leading-relaxed"
                  value={form.prompt}
                  onChange={(e) => update('prompt', e.target.value)}
                  spellCheck={false}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            className="rounded-md border border-border px-3 py-1.5 text-sm text-fg-secondary hover:bg-bg-tertiary"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            className={cn('rounded-md bg-accent px-4 py-1.5 text-sm text-white hover:bg-accent/80', saving && 'opacity-60 pointer-events-none')}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Agent card
function AgentCard({
  profile,
  allProfiles,
  onEdit,
  onToggle,
  onDelete,
}: {
  profile: AgentProfile;
  allProfiles: AgentProfile[];
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const delegates = profile.delegatesTo
    .map((id) => allProfiles.find((p) => p.id === id))
    .filter((p): p is AgentProfile => p != null);

  return (
    <div className="rounded-lg border border-border bg-bg-tertiary overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        {/* Color accent */}
        <div className="mt-0.5 h-full w-1 flex-shrink-0 self-stretch rounded-full" style={{ backgroundColor: profile.color, minHeight: '40px' }} />

        <div className="flex-1 min-w-0">
          {/* Name + badge */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-fg-primary">{profile.name}</span>
            {profile.builtIn && (
              <span className="rounded bg-bg-primary px-1.5 py-0.5 text-[10px] text-fg-muted">Built-in</span>
            )}
          </div>

          {/* Summary */}
          <p className="text-xs text-fg-muted line-clamp-2 mb-2">{profile.summary}</p>

          {/* Focus tags */}
          {profile.focus.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {profile.focus.map((tag) => (
                <span key={tag} className="rounded-full bg-bg-primary px-2 py-0.5 text-[10px] text-fg-muted">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Footer: delegates + actions */}
          <div className="flex items-center justify-between">
            {/* Delegate avatars */}
            <div className="flex items-center gap-1">
              {delegates.length > 0 && (
                <>
                  <span className="text-[10px] text-fg-muted mr-1">→</span>
                  {delegates.map((d) => (
                    <span
                      key={d.id}
                      title={d.name}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ backgroundColor: d.color }}
                    >
                      {d.name[0]}
                    </span>
                  ))}
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {!profile.builtIn && (
                <button
                  className="rounded px-2 py-1 text-xs text-red-400 hover:bg-bg-primary"
                  onClick={onDelete}
                >
                  Delete
                </button>
              )}
              <button
                className="rounded px-2 py-1 text-xs text-fg-secondary hover:bg-bg-primary"
                onClick={onEdit}
              >
                Edit
              </button>
              {/* Enable toggle */}
              <button
                className={cn(
                  'relative h-5 w-9 rounded-full transition-colors',
                  profile.enabled ? 'bg-accent' : 'bg-fg-muted/30',
                )}
                onClick={onToggle}
              >
                <span
                  className={cn(
                    'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
                    profile.enabled && 'translate-x-4',
                  )}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentsTab() {
  const [agentsConfig, setAgentsConfig] = useAtom(agentsConfigAtom);
  const [editingProfile, setEditingProfile] = useState<AgentProfile | null | undefined>(undefined); // undefined = closed, null = new
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getAgentsConfig().then(setAgentsConfig).catch(() => {});
  }, [setAgentsConfig]);

  const profiles = agentsConfig?.profiles ?? [];

  const updateGlobal = async (patch: { enabled?: boolean; allowSubagentDelegation?: boolean }) => {
    setSaving(true);
    try {
      const updated = await api.updateAgentsGlobal(patch);
      setAgentsConfig(updated);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleToggleProfile = async (id: string) => {
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return;
    try {
      const updated = await api.updateAgentProfile(id, { enabled: !profile.enabled });
      setAgentsConfig((prev) =>
        prev
          ? { ...prev, profiles: prev.profiles.map((p) => (p.id === id ? updated : p)) }
          : prev,
      );
    } catch {
      // ignore
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (!window.confirm('Delete this agent? This action cannot be undone.')) return;
    try {
      await api.deleteAgentProfile(id);
      setAgentsConfig((prev) =>
        prev ? { ...prev, profiles: prev.profiles.filter((p) => p.id !== id) } : prev,
      );
    } catch {
      // ignore
    }
  };

  const handleSaveProfile = (saved: AgentProfile) => {
    setAgentsConfig((prev) => {
      if (!prev) return prev;
      const exists = prev.profiles.some((p) => p.id === saved.id);
      return {
        ...prev,
        profiles: exists
          ? prev.profiles.map((p) => (p.id === saved.id ? saved : p))
          : [...prev.profiles, saved],
      };
    });
    setEditingProfile(undefined);
  };

  // Group profiles by category
  const grouped = profiles.reduce<Record<string, AgentProfile[]>>((acc, p) => {
    const key = p.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const categoryOrder: AgentProfile['category'][] = [
    'product', 'design', 'engineering', 'research', 'operations', 'custom',
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-fg-primary">Agents & Crew</h3>
          <p className="mt-0.5 text-xs text-fg-muted">Configure your AI agent team</p>
        </div>
        <button
          className="rounded-md border border-border px-3 py-1.5 text-sm text-fg-secondary hover:bg-bg-tertiary"
          onClick={() => setEditingProfile(null)}
        >
          + Create Custom Agent
        </button>
      </div>

      {/* Global toggles */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-tertiary p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-fg-primary">Enable Agent Crew</p>
            <p className="text-xs text-fg-muted">Allow agents to be spawned for tasks</p>
          </div>
          <button
            className={cn(
              'relative h-6 w-11 rounded-full transition-colors',
              agentsConfig?.enabled ? 'bg-accent' : 'bg-fg-muted/30',
            )}
            onClick={() => updateGlobal({ enabled: !agentsConfig?.enabled })}
            disabled={saving}
          >
            <span
              className={cn(
                'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                agentsConfig?.enabled && 'translate-x-5',
              )}
            />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-fg-primary">Allow Autonomous Delegation</p>
            <p className="text-xs text-fg-muted">Agents can delegate sub-tasks to other agents</p>
          </div>
          <button
            className={cn(
              'relative h-6 w-11 rounded-full transition-colors',
              agentsConfig?.allowSubagentDelegation ? 'bg-accent' : 'bg-fg-muted/30',
            )}
            onClick={() => updateGlobal({ allowSubagentDelegation: !agentsConfig?.allowSubagentDelegation })}
            disabled={saving}
          >
            <span
              className={cn(
                'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                agentsConfig?.allowSubagentDelegation && 'translate-x-5',
              )}
            />
          </button>
        </div>
      </div>

      {/* Agent cards by category */}
      {profiles.length === 0 && (
        <p className="text-sm text-fg-muted">No agents configured yet.</p>
      )}

      {categoryOrder
        .filter((cat) => grouped[cat]?.length)
        .map((cat) => (
          <div key={cat} className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
              {CATEGORY_LABELS[cat]}
            </h4>
            {grouped[cat].map((p) => (
              <AgentCard
                key={p.id}
                profile={p}
                allProfiles={profiles}
                onEdit={() => setEditingProfile(p)}
                onToggle={() => handleToggleProfile(p.id)}
                onDelete={() => handleDeleteProfile(p.id)}
              />
            ))}
          </div>
        ))}

      {/* Editor modal */}
      {editingProfile !== undefined && (
        <AgentEditorModal
          profile={editingProfile}
          allProfiles={profiles}
          onSave={handleSaveProfile}
          onClose={() => setEditingProfile(undefined)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings Modal
// ---------------------------------------------------------------------------

export function SettingsModal() {
  const setOpen = useSetAtom(settingsModalOpenAtom);
  const [activeTab, setActiveTab] = useState<Tab>('general');

  const renderTab = () => {
    switch (activeTab) {
      case 'general': return <GeneralTab />;
      case 'providers': return <ProvidersTab />;
      case 'memory': return <MemoryTab />;
      case 'people': return <PeopleTab />;
      case 'skills': return <SkillsTab />;
      case 'integrations': return <IntegrationsTab />;
      case 'agents': return <AgentsTab />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />

      {/* Modal */}
      <div className="relative z-10 flex h-[80vh] w-[800px] max-w-[90vw] overflow-hidden rounded-xl border border-border bg-bg-primary shadow-2xl">
        {/* Sidebar */}
        <nav className="flex w-48 flex-shrink-0 flex-col border-r border-border bg-bg-secondary p-4">
          <h2 className="mb-4 text-base font-semibold text-fg-primary">Settings</h2>
          <ul className="flex flex-col gap-0.5">
            {TABS.map((tab) => (
              <li key={tab.id}>
                <button
                  className={cn(
                    'w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors',
                    activeTab === tab.id
                      ? 'bg-accent/15 text-accent'
                      : 'text-fg-secondary hover:bg-bg-tertiary hover:text-fg-primary',
                  )}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderTab()}
        </div>

        {/* Close button */}
        <button
          className="absolute right-4 top-4 rounded p-1 text-fg-muted hover:bg-bg-tertiary hover:text-fg-primary"
          onClick={() => setOpen(false)}
          aria-label="Close settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
