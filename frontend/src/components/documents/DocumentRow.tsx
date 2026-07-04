import { Eye, FileText, MoreHorizontal, Trash2 } from 'lucide-react';
import type { MedicalDocument } from '../../types/document';
import { StatusBadge } from '../ui/Badge';

const formatDate = (date: string) => new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(date));

export function DocumentRow({ document, onDelete, onView, compact = false }: { document: MedicalDocument; onDelete?: (id: number) => void; onView?: (id: number) => void; compact?: boolean }) {
  const secondaryText = document.fileSize ?? (document.chunkCount !== null ? `${document.chunkCount.toLocaleString()} indexed chunks` : 'No chunks indexed');

  if (compact) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[#eff0f5] px-4 py-4 last:border-0 sm:px-5">
        <DocumentIdentity document={document} secondaryText={secondaryText} />
        <StatusBadge status={document.status} />
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-[#eff0f5] p-4 last:border-0 md:hidden">
        <div className="flex items-start justify-between gap-3"><DocumentIdentity document={document} secondaryText={secondaryText} /><StatusBadge status={document.status} /></div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-[#fafafe] px-3 py-2.5">
          <div><p className="text-[10px] uppercase tracking-wider text-muted">Uploaded</p><p className="mt-1 text-[11px] font-medium text-[#62677f]">{formatDate(document.createdAt)}</p></div>
          <div className="flex items-center gap-2">
            {onView && <button onClick={() => onView(document.id)} className="button-secondary px-3 py-2" aria-label={`View ${document.filename}`}><Eye size={14} />Details</button>}
            {onDelete && <button onClick={() => onDelete(document.id)} className="icon-button hover:border-[#ffd4d8] hover:bg-[#fff7f7] hover:text-[#dc4b58]" aria-label={`Delete ${document.filename}`}><Trash2 size={14} /></button>}
          </div>
        </div>
      </div>
      <div className="hidden grid-cols-[minmax(230px,1.5fr)_110px_80px_160px_82px] items-center gap-4 border-b border-[#eff0f5] px-5 py-4 last:border-0 md:grid">
        <DocumentIdentity document={document} secondaryText={secondaryText} />
        <StatusBadge status={document.status} />
        <span className="text-xs font-medium text-[#62677f]">{document.chunkCount?.toLocaleString() ?? '-'}</span>
        <span className="text-[11px] text-muted">{formatDate(document.createdAt)}</span>
        <div className="flex items-center gap-1.5">
          {onView && <button onClick={() => onView(document.id)} className="icon-button h-8 w-8" aria-label={`View ${document.filename}`}><Eye size={14} /></button>}
          {onDelete ? <button onClick={() => onDelete(document.id)} className="icon-button h-8 w-8 hover:border-[#ffd4d8] hover:bg-[#fff7f7] hover:text-[#dc4b58]" aria-label={`Delete ${document.filename}`}><Trash2 size={14} /></button> : <button className="icon-button h-8 w-8"><MoreHorizontal size={14} /></button>}
        </div>
      </div>
    </>
  );
}

function DocumentIdentity({ document, secondaryText }: { document: MedicalDocument; secondaryText: string }) {
  return <div className="flex min-w-0 items-center gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${document.status === 'failed' ? 'bg-[#fff0f0] text-[#ed5965]' : 'bg-[#f1efff] text-primary'}`}><FileText size={18} /></span><div className="min-w-0"><p className="truncate text-xs font-bold text-ink">{document.filename}</p><p className="mt-1 truncate text-[11px] text-muted">{secondaryText}</p></div></div>;
}
