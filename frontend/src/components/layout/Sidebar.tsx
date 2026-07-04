import { FilePlus2, Files, LayoutDashboard, MessageSquareText, Settings, ShieldAlert, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Brand } from '../ui/Brand';

const items = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/upload', label: 'Upload documents', icon: FilePlus2 },
  { to: '/chat', label: 'Ask MediQuery', icon: MessageSquareText },
  { to: '/documents', label: 'Document library', icon: Files },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  return (
    <>
      <button
        type="button"
        aria-label="Close navigation overlay"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[#121936]/35 backdrop-blur-sm lg:hidden ${mobileOpen ? 'block' : 'hidden'}`}
      />
      <aside
        aria-label="Primary navigation"
        className={`fixed inset-y-0 left-0 z-50 w-[280px] max-w-[86vw] flex-col border-r border-[#e9eaf2] bg-white px-4 py-6 shadow-[18px_0_50px_rgba(29,27,57,.12)] lg:z-40 lg:flex lg:w-[248px] lg:shadow-none ${mobileOpen ? 'flex' : 'hidden'}`}
      >
      <div className="flex items-center justify-between px-3"><Brand /><button onClick={onClose} className="icon-button lg:hidden" aria-label="Close navigation"><X size={18} /></button></div>
      <nav className="mt-10 space-y-1.5">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.17em] text-[#a0a4b8]">Workspace</p>
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            <Icon size={18} strokeWidth={1.9} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto rounded-2xl border border-[#ecebf5] bg-[#fafafe] p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-ink"><ShieldAlert size={15} className="text-primary" />Medical disclaimer</div>
        <p className="text-[11px] leading-[1.65] text-muted">Answers are grounded in uploaded documents and do not replace professional medical advice.</p>
      </div>
      <div className="mt-4 rounded-xl bg-[#f7f7fb] px-3 py-2 text-[11px] font-medium text-muted">Local document workspace</div>
    </aside>
    </>
  );
}
