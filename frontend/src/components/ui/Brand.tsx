import { ShieldCheck } from 'lucide-react';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="brand-mark"><ShieldCheck size={19} strokeWidth={2.4} /></span>
      {!compact && <span className="font-display text-[17px] font-extrabold tracking-[-0.035em] text-ink">MediQuery <span className="text-primary">RAG</span></span>}
    </div>
  );
}

