import { useState, useRef, useEffect, useCallback } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { cn } from '@tomu/ui';
import { currentModelAtom, providersAtom, settingsAtom } from '../store/atoms';
import { api } from '../lib/api';

export function ModelSelector() {
  const [open, setOpen] = useState(false);
  const [currentModel, setCurrentModel] = useAtom(currentModelAtom);
  const providers = useAtomValue(providersAtom);
  const settings = useAtomValue(settingsAtom);
  const setSettings = useSetAtom(settingsAtom);
  const ref = useRef<HTMLDivElement>(null);

  const enabledProviders = providers.filter((p) => p.enabled && p.models.length > 0);

  // Find display name for current model
  const currentModelName = (() => {
    for (const p of enabledProviders) {
      const m = p.models.find((m) => m.id === currentModel);
      if (m) {
        const name = m.name || m.id;
        return name.length > 20 ? name.slice(0, 18) + '\u2026' : name;
      }
    }
    return 'Model';
  })();

  const handleSelect = useCallback(
    (modelId: string) => {
      setCurrentModel(modelId);
      setOpen(false);
      const providerId = enabledProviders.find((p) => p.models.some((m) => m.id === modelId))?.id;
      api.updateSettings({ ...settings, default_model_id: modelId, default_provider_id: providerId })
        .then(setSettings)
        .catch(() => {});
    },
    [setCurrentModel, enabledProviders, settings, setSettings],
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (enabledProviders.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex-shrink-0 rounded-md px-2 py-1 text-xs transition-colors',
          'text-fg-muted hover:bg-bg-tertiary hover:text-fg-primary',
          open && 'bg-bg-tertiary text-fg-primary',
        )}
      >
        <span className="flex items-center gap-1">
          {currentModelName}
          <svg
            className={cn('h-3 w-3 transition-transform', open && 'rotate-180')}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[220px] rounded-lg border border-border bg-bg-secondary shadow-lg">
          <div className="max-h-64 overflow-y-auto py-1">
            {enabledProviders.map((provider) => (
              <div key={provider.id}>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
                  {provider.name}
                </div>
                {provider.models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => handleSelect(model.id)}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors',
                      model.id === currentModel
                        ? 'bg-accent/10 text-accent'
                        : 'text-fg-secondary hover:bg-bg-tertiary hover:text-fg-primary',
                    )}
                  >
                    <span className="truncate">{model.name || model.id}</span>
                    {model.id === currentModel && (
                      <svg
                        className="ml-auto h-3.5 w-3.5 flex-shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
