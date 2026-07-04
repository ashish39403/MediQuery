import { FileText, MoveUpRight } from 'lucide-react';
import type { Citation } from '../../types/chat';

export function CitationCard({ citation, index, active, onClick }: { citation: Citation; index: number; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-xl border p-3 text-left transition ${active ? 'border-[#a897f0] bg-[#f8f6ff] ring-2 ring-[#8064f3]/10' : 'border-[#e9e9f1] bg-white hover:border-[#cfc8f2]'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#eeeaff] text-[10px] font-bold text-primary">{index}</span><FileText size={13} className="shrink-0 text-primary" /><span className="truncate text-[11px] font-bold">{citation.documentName}</span></div>
        <MoveUpRight size={12} className="text-[#a0a4b8]" />
      </div>
      <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-muted">{citation.chunkText}</p>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted"><span>Page {citation.pageNumber ?? '—'}</span><span className="font-bold text-[#26966c]">{Math.round(citation.score * 100)}% match</span></div>
    </button>
  );
}

