export function LoadingState({ label = 'Loading your workspace…' }: { label?: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-sm text-muted">
      <span className="loader" />
      {label}
    </div>
  );
}

