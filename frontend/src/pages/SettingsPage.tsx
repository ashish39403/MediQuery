import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, Bot, Braces, CheckCircle2, Database, KeyRound, ServerCog } from 'lucide-react';
import { getHealth } from '../api/health';
import { PageHeader } from '../components/ui/PageHeader';

export function SettingsPage() {
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth, retry: 1 });

  return (
    <>
      <PageHeader eyebrow="Configuration" title="Settings" description="Review the runtime configuration exposed by your backend. Secret values always remain server-side." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_370px]">
        <section className="card overflow-hidden"><div className="border-b border-[#ececf2] px-5 py-5 sm:px-6"><div className="flex flex-wrap items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0ecff] text-primary"><ServerCog size={18} /></span><div><h2 className="text-sm font-bold">Backend configuration</h2><p className="mt-1 text-[11px] text-muted">OpenAI-compatible settings remain server-side</p></div><span className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${health.isSuccess ? 'bg-[#eaf9f2] text-[#168c63]' : health.isLoading ? 'bg-[#fff5e5] text-[#b86e13]' : 'bg-[#fff0f1] text-[#c83e4b]'}`}>{health.isSuccess ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}{health.isSuccess ? 'Backend online' : health.isLoading ? 'Checking…' : 'Backend offline'}</span></div></div><div className="divide-y divide-[#eff0f5]">
          <SettingRow icon={Braces} label="API protocol" value="OpenAI-compatible" />
          <SettingRow icon={Bot} label="Chat model" value="Read from backend environment" />
          <SettingRow icon={Database} label="Embedding model" value="Read from backend environment" />
          <SettingRow icon={KeyRound} label="API key" value="Never exposed to this frontend" />
        </div></section>
        <aside className="space-y-5"><section className="rounded-[18px] border border-[#f2dfad] bg-[#fffaf0] p-5"><div className="flex items-start gap-3"><AlertTriangle size={19} className="mt-0.5 shrink-0 text-[#d98a18]" /><div><h2 className="text-sm font-bold text-[#674911]">Keys are backend-only</h2><p className="mt-2 text-xs leading-5 text-[#846832]">Never add API keys to <code className="rounded bg-white/80 px-1 py-0.5">VITE_*</code> variables. Browser-prefixed variables are public at build time.</p></div></div></section><section className="card p-5"><h2 className="text-sm font-bold">Environment variables</h2><div className="mt-4 space-y-2">{['OPENAI_API_KEY', 'OPENAI_BASE_URL', 'CHAT_MODEL', 'EMBEDDING_MODEL'].map((variable) => <div key={variable} className="rounded-lg bg-[#f7f7fb] px-3 py-2 font-mono text-[10px] text-[#50556e]">{variable}</div>)}</div></section></aside>
      </div>
    </>
  );
}

function SettingRow({ icon: Icon, label, value }: { icon: typeof Bot; label: string; value: string }) { return <div className="flex items-center gap-4 px-6 py-5"><Icon size={17} className="text-[#8e83c7]" /><div><p className="text-xs font-bold">{label}</p><p className="mt-1 text-[11px] text-muted">{value}</p></div></div>; }
