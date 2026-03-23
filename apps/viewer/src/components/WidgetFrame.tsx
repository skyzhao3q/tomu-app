import { useEffect, useRef, useCallback } from 'react';

interface WidgetFrameProps {
  widgetId: string;
  html: string;
  title?: string;
}

function getThemeStyles(): string {
  const style = getComputedStyle(document.documentElement);
  const vars = ['--bg-primary', '--bg-secondary', '--fg-primary', '--fg-secondary', '--accent'];
  const rules = vars
    .map((v) => `${v}: ${style.getPropertyValue(v).trim()};`)
    .join('\n    ');
  return `<style>:root {\n    ${rules}\n  }</style>`;
}

export function WidgetFrame({ widgetId, html, title }: WidgetFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const heightRef = useRef(300);

  const handleMessage = useCallback(
    (e: MessageEvent) => {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;

      const data = e.data;
      if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;

      switch (data.type) {
        case 'widget-resize':
          if (typeof data.height === 'number') {
            const clamped = Math.min(data.height, 600);
            heightRef.current = clamped;
            if (iframeRef.current) {
              iframeRef.current.style.height = `${clamped}px`;
            }
          }
          break;
        case 'send-prompt':
          if (typeof data.text === 'string') {
            // TODO: dispatch to chat
            console.log('[WidgetFrame] send-prompt:', data.text);
          }
          break;
        case 'open-link':
          if (typeof data.url === 'string') {
            window.open(data.url, '_blank');
          }
          break;
      }
    },
    [],
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  const srcdoc = getThemeStyles() + html;

  return (
    <div className="my-1.5 overflow-hidden rounded-lg border border-border">
      {title && (
        <div className="border-b border-border bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-fg-secondary">
          {title}
        </div>
      )}
      <iframe
        ref={iframeRef}
        srcDoc={srcdoc}
        sandbox="allow-scripts"
        data-widget-id={widgetId}
        className="w-full border-0 bg-bg-primary"
        style={{ height: 300, maxHeight: 600 }}
        title={title ?? `Widget ${widgetId}`}
      />
    </div>
  );
}
