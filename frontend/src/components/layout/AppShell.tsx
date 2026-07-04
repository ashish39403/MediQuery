import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';

export function AppShell() {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavigationOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavigationOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileNavigationOpen]);

  return (
    <div className="min-h-screen bg-[#f8f9fd] text-ink">
      <Sidebar mobileOpen={mobileNavigationOpen} onClose={() => setMobileNavigationOpen(false)} />
      <MobileHeader onMenu={() => setMobileNavigationOpen(true)} />
      <main className="min-h-screen min-w-0 overflow-x-hidden px-4 pb-8 pt-5 sm:px-6 lg:ml-[248px] lg:px-10 lg:py-9 xl:px-12">
        <div className="mx-auto max-w-[1450px]"><Outlet /></div>
      </main>
    </div>
  );
}
