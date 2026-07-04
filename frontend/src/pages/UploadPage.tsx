import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileText, ShieldCheck } from 'lucide-react';
import { getDocuments, uploadDocument } from '../api/documents';
import { DocumentDropzone } from '../components/documents/DocumentDropzone';
import { DocumentRow } from '../components/documents/DocumentRow';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import type { MedicalDocument } from '../types/document';

export function UploadPage() {
  const queryClient = useQueryClient();
  const documents = useQuery({ queryKey: ['documents'], queryFn: getDocuments });
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const upload = useMutation({
    mutationFn: (file: File) => { setCurrentFile(file.name); setProgress(0); return uploadDocument(file, setProgress); },
    onSuccess: (newDocument) => {
      queryClient.setQueryData<MedicalDocument[]>(['documents'], (old = []) => [newDocument, ...old]);
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      window.setTimeout(() => { setCurrentFile(''); setProgress(0); upload.reset(); }, 1800);
    },
  });

  return (
    <>
      <PageHeader eyebrow="Knowledge base" title="Upload a medical document" description="Add trusted PDF sources. We extract page-aware text, create embeddings, and index it for grounded answers." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_350px]">
        <div className="space-y-6">
          <section className="card p-5 sm:p-7"><DocumentDropzone onSelect={(file) => upload.mutate(file)} disabled={upload.isPending} /></section>
          {(currentFile || upload.isError) && <section className="card animate-in p-5"><div className="mb-4 flex items-center justify-between"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1efff] text-primary"><FileText size={18} /></span><div className="min-w-0"><p className="truncate text-xs font-bold">{currentFile || 'Upload'}</p><p className="mt-1 text-[10px] text-muted">{upload.isSuccess ? 'Upload and indexing complete' : upload.isError ? 'Upload failed' : 'Uploading and indexing…'}</p></div></div><span className={`ml-3 shrink-0 text-xs font-bold ${upload.isError ? 'text-[#dc4b58]' : 'text-primary'}`}>{upload.isError ? 'Error' : upload.isSuccess ? 'Done' : `${progress}%`}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#eeedf5]"><div className={`h-full rounded-full transition-all duration-300 ${upload.isError ? 'bg-[#ed5965]' : 'bg-gradient-to-r from-[#8266f0] to-[#5d3de0]'}`} style={{ width: `${upload.isError ? 100 : upload.isSuccess ? 100 : progress}%` }} /></div>{upload.isSuccess && <p className="mt-3 flex items-center gap-2 text-[11px] font-bold text-[#168c63]"><CheckCircle2 size={14} />Document is ready for grounded chat</p>}{upload.isError && <p className="mt-3 text-[11px] font-medium text-[#c83e4b]">{upload.error.message}</p>}</section>}
          <section className="card overflow-hidden"><div className="border-b border-[#eff0f5] px-5 py-4"><h2 className="text-sm font-bold">Recent uploads</h2><p className="mt-1 text-[11px] text-muted">Track ingestion and indexing progress</p></div>{documents.isLoading ? <LoadingState /> : documents.isError ? <ErrorState compact message={documents.error.message} onRetry={() => documents.refetch()} /> : documents.data?.length ? <div>{documents.data.slice(0, 3).map((document) => <DocumentRow key={document.id} document={document} compact />)}</div> : <div className="px-5 py-10 text-center"><p className="text-xs font-bold">No uploads yet</p><p className="mt-1 text-[11px] text-muted">Your uploaded PDFs will appear here.</p></div>}</section>
        </div>
        <aside className="space-y-5">
          <section className="card p-5"><span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e9f8f2] text-[#1a996e]"><ShieldCheck size={20} /></span><h2 className="text-sm font-bold">Private by design</h2><p className="mt-2 text-xs leading-5 text-muted">Your files are sent only to your configured backend and are never exposed in the browser bundle.</p></section>
          <section className="card p-5"><h2 className="text-sm font-bold">What happens next?</h2><ol className="mt-4 space-y-4">{['Validate and store the PDF', 'Extract text with page numbers', 'Split into semantic chunks', 'Embed and add to FAISS'].map((step, index) => <li key={step} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#f0ecff] text-[10px] font-bold text-primary">{index + 1}</span><span className="pt-1 text-xs font-medium text-[#555a73]">{step}</span></li>)}</ol></section>
        </aside>
      </div>
    </>
  );
}
