import { AlertCircle, RefreshCw } from 'lucide-react';

export function ErrorState({ title = 'Unable to reach the backend', message, onRetry, compact = false }: { title?: string; message?: string; onRetry?: () => void; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 text-center ${compact ? 'min-h-40 py-6' : 'min-h-64 py-10'}`}>
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff0f1] text-[#d64b57]"><AlertCircle size={20} /></span>
      <p className="mt-3 text-sm font-bold text-ink">{title}</p>
      <p className="mt-1 max-w-md text-xs leading-5 text-muted">{message ?? 'Make sure the FastAPI server is running on the configured API URL.'}</p>
      {onRetry && <button onClick={onRetry} className="button-secondary mt-4"><RefreshCw size={14} />Try again</button>}
    </div>
  );
}
