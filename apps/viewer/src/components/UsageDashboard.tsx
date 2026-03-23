import { useState, useEffect, useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { cn } from '@tomu/ui';
import { usageDashboardOpenAtom } from '../store/atoms';
import { api } from '../lib/api';

type RangeOption = 7 | 30 | 90;

interface UsageData {
  total_input_tokens: number;
  total_output_tokens: number;
  total_requests: number;
  by_day: Array<{ date: string; input_tokens: number; output_tokens: number; requests: number }>;
  by_model: Array<{ model_id: string; provider_id: string; input_tokens: number; output_tokens: number; requests: number }>;
}

function formatTokens(n: number): string {
  if (n < 1_000) return String(n);
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

function estimateCost(inputTokens: number, outputTokens: number): string {
  // Rough estimate: $3/1M input, $15/1M output (mid-range pricing)
  const cost = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;
  return `$${cost.toFixed(2)}`;
}

export function UsageDashboard() {
  const setOpen = useSetAtom(usageDashboardOpenAtom);
  const [range, setRange] = useState<RangeOption>(30);
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getUsage(range);
      setData(result);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const maxDayTokens = data
    ? Math.max(...data.by_day.map((d) => d.input_tokens + d.output_tokens), 1)
    : 1;

  const totalModelTokens = data
    ? data.by_model.reduce((sum, m) => sum + m.input_tokens + m.output_tokens, 0) || 1
    : 1;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div className="relative z-10 flex h-full w-[480px] flex-col border-l border-border bg-bg-secondary">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-fg-primary">Usage</h2>
          <div className="flex items-center gap-2">
            <button
              className={cn(
                'rounded-md border border-border px-2.5 py-1 text-xs text-fg-secondary hover:bg-bg-tertiary',
                loading && 'pointer-events-none opacity-60',
              )}
              onClick={load}
              disabled={loading}
              aria-label="Refresh usage"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0115-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 01-15 6.7L3 16" />
              </svg>
            </button>
            <button
              className="rounded p-1 text-fg-muted hover:bg-bg-tertiary hover:text-fg-primary"
              onClick={() => setOpen(false)}
              aria-label="Close usage panel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Date range selector */}
          <div className="mb-4 flex gap-2">
            {([7, 30, 90] as const).map((d) => (
              <button
                key={d}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm',
                  range === d
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border text-fg-secondary hover:bg-bg-tertiary',
                )}
                onClick={() => setRange(d)}
              >
                {d}d
              </button>
            ))}
          </div>

          {!data ? (
            <p className="py-4 text-center text-xs text-fg-muted">
              {loading ? 'Loading...' : 'No data'}
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-bg-tertiary p-3">
                  <div className="text-xs text-fg-muted">Input Tokens</div>
                  <div className="mt-1 text-lg font-semibold text-fg-primary">{formatTokens(data.total_input_tokens)}</div>
                </div>
                <div className="rounded-lg border border-border bg-bg-tertiary p-3">
                  <div className="text-xs text-fg-muted">Output Tokens</div>
                  <div className="mt-1 text-lg font-semibold text-fg-primary">{formatTokens(data.total_output_tokens)}</div>
                </div>
                <div className="rounded-lg border border-border bg-bg-tertiary p-3">
                  <div className="text-xs text-fg-muted">Total Requests</div>
                  <div className="mt-1 text-lg font-semibold text-fg-primary">{data.total_requests.toLocaleString()}</div>
                </div>
                <div className="rounded-lg border border-border bg-bg-tertiary p-3">
                  <div className="text-xs text-fg-muted">Est. Cost</div>
                  <div className="mt-1 text-lg font-semibold text-fg-primary">{estimateCost(data.total_input_tokens, data.total_output_tokens)}</div>
                </div>
              </div>

              {/* Daily usage chart */}
              <div>
                <h3 className="mb-3 text-sm font-medium text-fg-secondary">Daily Usage</h3>
                {data.by_day.length === 0 ? (
                  <p className="text-xs text-fg-muted">No daily data available.</p>
                ) : (
                  <div className="flex items-end gap-[2px]" style={{ height: 120 }}>
                    {data.by_day.map((day) => {
                      const total = day.input_tokens + day.output_tokens;
                      const heightPct = (total / maxDayTokens) * 100;
                      const inputPct = total > 0 ? (day.input_tokens / total) * 100 : 0;
                      const barDate = new Date(day.date);
                      const label = `${barDate.getMonth() + 1}/${barDate.getDate()}`;
                      return (
                        <div
                          key={day.date}
                          className="group relative flex flex-1 flex-col items-center justify-end"
                          style={{ height: '100%' }}
                        >
                          <svg
                            className="w-full"
                            style={{ height: `${Math.max(heightPct, 1)}%`, minHeight: 2 }}
                            viewBox="0 0 10 100"
                            preserveAspectRatio="none"
                          >
                            <rect x="0" y="0" width="10" height={inputPct} className="fill-blue-500/60" />
                            <rect x="0" y={inputPct} width="10" height={100 - inputPct} className="fill-accent/60" />
                          </svg>
                          {/* Tooltip */}
                          <div className="pointer-events-none absolute bottom-full mb-1 hidden rounded bg-bg-primary px-2 py-1 text-[10px] text-fg-secondary shadow-lg group-hover:block">
                            <div>{label}</div>
                            <div>In: {formatTokens(day.input_tokens)}</div>
                            <div>Out: {formatTokens(day.output_tokens)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-1.5 flex items-center gap-3 text-[10px] text-fg-muted">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-sm bg-blue-500/60" /> Input
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-sm bg-accent/60" /> Output
                  </span>
                </div>
              </div>

              {/* Model breakdown */}
              <div>
                <h3 className="mb-3 text-sm font-medium text-fg-secondary">By Model</h3>
                {data.by_model.length === 0 ? (
                  <p className="text-xs text-fg-muted">No model data available.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.by_model.map((m) => {
                      const total = m.input_tokens + m.output_tokens;
                      const pct = (total / totalModelTokens) * 100;
                      return (
                        <div key={`${m.provider_id}-${m.model_id}`} className="rounded-lg border border-border bg-bg-tertiary p-3">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-xs font-medium text-fg-primary">{m.model_id}</span>
                            <span className="text-xs text-fg-muted">{pct.toFixed(1)}%</span>
                          </div>
                          <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-bg-primary">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex gap-3 text-[10px] text-fg-muted">
                            <span>In: {formatTokens(m.input_tokens)}</span>
                            <span>Out: {formatTokens(m.output_tokens)}</span>
                            <span>{m.requests} req</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
