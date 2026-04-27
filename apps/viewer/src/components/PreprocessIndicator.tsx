export function PreprocessIndicator() {
  return (
    <div
      className="flex items-center gap-2 py-1"
      style={{ animation: 'fadeInUp 0.3s ease forwards' }}
    >
      <div className="flex gap-1">
        {[0, 0.2, 0.4].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 rounded-full bg-fg-muted"
            style={{ animation: `thinkingDot 1.2s ease-in-out ${delay}s infinite` }}
          />
        ))}
      </div>
      <span className="text-xs text-fg-muted">Thinking...</span>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes thinkingDot {
          0%, 80%, 100% { opacity: 0.2; transform: translateY(0); }
          40%            { opacity: 0.8; transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
}
