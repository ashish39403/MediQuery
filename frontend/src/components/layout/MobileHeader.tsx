import { Menu } from 'lucide-react';
import { Brand } from '../ui/Brand';

export function MobileHeader({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#e9eaf2] bg-white/90 px-5 backdrop-blur lg:hidden">
      <Brand />
      <button onClick={onMenu} className="icon-button" aria-label="Open navigation"><Menu size={20} /></button>
    </header>
  );
}
