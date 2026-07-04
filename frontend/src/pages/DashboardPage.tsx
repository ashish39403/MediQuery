import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Boxes, Clock3, FilePlus2, Files, MessageSquareText, Sparkles, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDashboardStats, getDocuments } from '../api/documents';
import { getHealth } from '../api/health';
import { DocumentRow } from '../components/documents/DocumentRow';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';

const cards = [
  { key: 'totalDocuments', label: 'Total documents', icon: Files, color: 'violet' },
  { key: 'indexedChunks', label: 'Indexed chunks', icon: Boxes, color: 'blue' },
  { key: 'conversations', label: 'Conversations', icon: MessageSquareText, color: 'amber' },
  { key: 'averageResponseTime', label: 'Avg. response', icon: Zap, color: 'green' },
] as const;

export function DashboardPage() {
  const stats = useQuery({ queryKey: ['stats'], queryFn: getDashboardStats });
  const documents = useQuery({ queryKey: ['documents'], queryFn: getDocuments });
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth, retry: 1, refetchInterval: 30_000 });
  const latestIndexed = documents.data?.find((document) => document.status === 'indexed');

  return (
    <>
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">Overview</p><h1 className="font-display text-[30px] font-extrabold tracking-[-0.045em] text-ink sm:text-[34px]">Welcome to MediQuery</h1><p className="mt-2 text-sm text-muted">Ask questions from your medical documents with citation-backed answers.</p></div>
        <div className="flex items-center gap-3 rounded-2xl border border-[#e8e9f1] bg-white px-4 py-3 shadow-card"><span className={`relative flex h-2.5 w-2.5 rounded-full ${health.isSuccess ? 'bg-emerald-500' : health.isLoading ? 'animate-pulse bg-amber-400' : 'bg-[#ed5965]'}`} /> <div><p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Backend status</p><p className={`mt-0.5 text-xs font-bold ${health.isSuccess ? 'text-[#17875f]' : health.isLoading ? 'text-[#b86e13]' : 'text-[#c83e4b]'}`}>{health.isSuccess ? health.data.service : health.isLoading ? 'Checking connection…' : 'Backend unavailable'}</p></div></div>
      </header>

      {stats.isLoading ? <LoadingState /> : stats.isError ? <div className="card"><ErrorState compact message={stats.error.message} onRetry={() => stats.refetch()} /></div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ key, label, icon: Icon, color }, index) => {
        const value = stats.data?.[key] ?? 0;
        const helper = key === 'totalDocuments' ? 'Available sources' : key === 'indexedChunks' ? 'Searchable passages' : key === 'conversations' ? 'Saved chat sessions' : value > 0 ? 'Measured by API' : 'Not measured yet';
        return <div key={key} className={`card animate-in delay-${index} p-5`}><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-muted">{label}</p><p className="mt-3 font-display text-[26px] font-extrabold tracking-[-0.04em]">{key === 'averageResponseTime' ? (value > 0 ? `${value}s` : '-') : value.toLocaleString()}</p></div><span className={`stat-icon stat-${color}`}><Icon size={20} /></span></div><p className="mt-3 text-[11px] font-bold text-[#6f7490]">{helper}</p></div>;
      })}</div>}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,.75fr)]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#eff0f5] px-5 py-4"><div><h2 className="text-sm font-bold">Recent documents</h2><p className="mt-1 text-[11px] text-muted">Your latest knowledge-base activity</p></div><Link to="/documents" className="flex items-center gap-1 text-[11px] font-bold text-primary">View all <ArrowUpRight size={13} /></Link></div>
          {documents.isLoading ? <LoadingState /> : documents.isError ? <ErrorState compact message={documents.error.message} onRetry={() => documents.refetch()} /> : documents.data?.length ? <div>{documents.data.slice(0, 4).map((document) => <DocumentRow key={document.id} document={document} compact />)}</div> : <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center"><Files size={22} className="text-[#b3b6c5]" /><p className="mt-3 text-sm font-bold">No documents yet</p><p className="mt-1 text-xs text-muted">Upload a PDF to create your knowledge base.</p><Link to="/upload" className="button-primary mt-4"><FilePlus2 size={14} />Upload PDF</Link></div>}
        </section>
        <section className="card p-5"><div className="mb-4 flex items-center gap-2"><Sparkles size={16} className="text-primary" /><h2 className="text-sm font-bold">Quick actions</h2></div><div className="space-y-3">
          <QuickAction to="/upload" icon={FilePlus2} title="Upload a document" description="Add a PDF to your knowledge base" />
          <QuickAction to="/chat" icon={MessageSquareText} title="Start a new chat" description="Ask across selected documents" />
          <QuickAction to="/documents" icon={Files} title="Browse documents" description="Manage metadata and files" />
        </div><div className="mt-5 rounded-xl bg-[#f7f7fb] p-3"><div className="flex items-center gap-2 text-[11px] font-bold"><Clock3 size={13} className="text-primary" />{latestIndexed ? `Last indexed ${new Date(latestIndexed.createdAt).toLocaleString()}` : 'No indexed documents'}</div><p className="mt-1.5 text-[10px] leading-4 text-muted">{latestIndexed ? 'The latest indexed source is ready for retrieval.' : 'Upload and index a PDF before starting a grounded chat.'}</p></div></section>
      </div>
    </>
  );
}

function QuickAction({ to, icon: Icon, title, description }: { to: string; icon: typeof FilePlus2; title: string; description: string }) {
  return <Link to={to} className="group flex items-center gap-3 rounded-xl border border-[#ebeaf2] p-3 transition hover:border-[#cfc7f3] hover:bg-[#faf9ff]"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0ecff] text-primary transition group-hover:scale-105"><Icon size={17} /></span><div><p className="text-xs font-bold">{title}</p><p className="mt-1 text-[10px] text-muted">{description}</p></div><ArrowUpRight size={14} className="ml-auto text-[#b3b6c5] group-hover:text-primary" /></Link>;
}
