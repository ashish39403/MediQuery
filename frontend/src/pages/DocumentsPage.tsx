import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePlus2, FileText, Search, SlidersHorizontal, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { deleteDocument, getDocumentDetail, getDocuments } from '../api/documents';
import { DocumentRow } from '../components/documents/DocumentRow';
import { StatusBadge } from '../components/ui/Badge';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import type { MedicalDocument } from '../types/document';

export function DocumentsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const documents = useQuery({ queryKey: ['documents'], queryFn: getDocuments });
  const detail = useQuery({ queryKey: ['document-detail', selectedDocumentId], queryFn: () => getDocumentDetail(selectedDocumentId!), enabled: selectedDocumentId !== null });
  const remove = useMutation({ mutationFn: deleteDocument, onSuccess: (_, id) => {
    queryClient.setQueryData<MedicalDocument[]>(['documents'], (old = []) => old.filter((doc) => doc.id !== id));
    queryClient.invalidateQueries({ queryKey: ['stats'] });
    if (selectedDocumentId === id) setSelectedDocumentId(null);
  } });
  const visible = useMemo(() => documents.data?.filter((doc) => doc.filename.toLowerCase().includes(search.toLowerCase()) && (status === 'all' || doc.status === status)) ?? [], [documents.data, search, status]);

  const requestDelete = (id: number) => { if (window.confirm('Delete this document and remove it from the vector index?')) remove.mutate(id); };

  useEffect(() => {
    if (selectedDocumentId === null) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedDocumentId(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedDocumentId]);

  return (
    <>
      <PageHeader eyebrow="Knowledge base" title="Document library" description="Review every source available to MediQuery and monitor its indexing state." action={<Link to="/upload" className="button-primary"><FilePlus2 size={15} />Upload document</Link>} />
      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#e9eaf1] p-4 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca0b3]" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="field pl-10" placeholder="Search by document name…" /></label>
          <div className="relative"><SlidersHorizontal size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" /><select value={status} onChange={(e) => setStatus(e.target.value)} className="field min-w-40 appearance-none pl-10 pr-8 text-xs font-bold"><option value="all">All statuses</option><option value="indexed">Indexed</option><option value="processing">Processing</option><option value="failed">Failed</option></select></div>
        </div>
        <div className="hidden grid-cols-[minmax(230px,1.5fr)_110px_80px_160px_82px] gap-4 border-b border-[#e9eaf1] bg-[#fafafe] px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-[#898da4] md:grid"><span>Document</span><span>Status</span><span>Chunks</span><span>Uploaded</span><span>Actions</span></div>
        {documents.isLoading ? <LoadingState /> : documents.isError ? <ErrorState message={documents.error.message} onRetry={() => documents.refetch()} /> : visible.length ? <div>{visible.map((document) => <DocumentRow key={document.id} document={document} onView={setSelectedDocumentId} onDelete={requestDelete} />)}</div> : <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><Search size={24} className="text-[#b3b6c5]" /><p className="mt-3 text-sm font-bold">{documents.data?.length ? 'No documents match your filters' : 'No documents uploaded yet'}</p><p className="mt-1 text-xs text-muted">{documents.data?.length ? 'Try another search or status filter.' : 'Upload your first PDF to build the knowledge base.'}</p>{!documents.data?.length && <Link to="/upload" className="button-primary mt-4"><FilePlus2 size={14} />Upload PDF</Link>}</div>}
        <div className="flex items-center justify-between border-t border-[#eff0f5] px-5 py-4 text-[11px] text-muted"><span>Showing {visible.length} of {documents.data?.length ?? 0} documents</span><span>Page <strong className="text-ink">1</strong> of 1</span></div>
      </section>
      {remove.isError && <div className="mt-4 rounded-xl border border-[#ffd5d8] bg-[#fff5f6] px-4 py-3 text-xs text-[#b93643]">Delete failed: {remove.error.message}</div>}
      {selectedDocumentId !== null && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#121936]/45 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Document details"><button className="absolute inset-0" onClick={() => setSelectedDocumentId(null)} aria-label="Close document details" /><div className="relative z-10 max-h-[88dvh] w-full max-w-2xl overflow-hidden rounded-t-[24px] border border-[#e5e6ee] bg-white shadow-[0_24px_80px_rgba(22,24,47,.24)] sm:rounded-[24px]"><div className="flex items-center justify-between border-b border-[#ececf2] px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0ecff] text-primary"><FileText size={18} /></span><div><p className="text-sm font-bold">Document details</p><p className="mt-0.5 text-[11px] text-muted">Metadata and chunk previews from the API</p></div></div><button onClick={() => setSelectedDocumentId(null)} className="icon-button" aria-label="Close details"><X size={17} /></button></div>{detail.isLoading ? <LoadingState /> : detail.isError ? <ErrorState compact message={detail.error.message} onRetry={() => detail.refetch()} /> : detail.data && <div className="scrollbar-thin max-h-[calc(88dvh-74px)] overflow-y-auto p-5"><div className="flex flex-col gap-3 rounded-2xl bg-[#fafafe] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-bold">{detail.data.filename}</p><p className="mt-1 text-[11px] text-muted">Uploaded {new Date(detail.data.createdAt).toLocaleString()}</p></div><StatusBadge status={detail.data.status} /></div><div className="mt-5 flex items-center justify-between"><div><p className="text-xs font-bold">Indexed chunks</p><p className="mt-1 text-[11px] text-muted">Page-aware source previews</p></div><span className="rounded-lg bg-[#f0ecff] px-2.5 py-1 text-xs font-bold text-primary">{detail.data.chunkCount}</span></div><div className="mt-3 space-y-2">{detail.data.chunks.length ? detail.data.chunks.map((chunk) => <div key={chunk.chunkIndex} className="rounded-xl border border-[#e8e9f1] p-3"><div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted"><span>Chunk {chunk.chunkIndex + 1}</span><span>Page {chunk.pageNumber ?? '-'}</span></div><p className="mt-2 text-xs leading-5 text-[#4e536d]">{chunk.preview}</p></div>) : <p className="rounded-xl bg-[#fafafe] p-4 text-center text-xs text-muted">No chunks available for this document.</p>}</div></div>}</div></div>}
    </>
  );
}
