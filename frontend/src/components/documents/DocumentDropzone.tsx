import { useRef, useState, type DragEvent } from 'react';
import { FileText, UploadCloud } from 'lucide-react';

export function DocumentDropzone({ onSelect, disabled }: { onSelect: (file: File) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const validate = (file?: File) => {
    setError('');
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return setError('Please choose a PDF file.');
    if (file.size > 50 * 1024 * 1024) return setError('This file is larger than the 50 MB limit.');
    onSelect(file);
  };

  const drop = (event: DragEvent) => {
    event.preventDefault(); setDragging(false); validate(event.dataTransfer.files[0]);
  };

  return (
    <div>
      <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}
        className={`group flex min-h-[275px] w-full flex-col items-center justify-center rounded-[20px] border-2 border-dashed px-6 text-center transition ${dragging ? 'border-primary bg-[#f7f4ff]' : 'border-[#dcdde8] bg-[#fcfcfe] hover:border-[#a99bf0] hover:bg-[#faf9ff]'} disabled:opacity-60`}>
        <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f1edff] text-primary transition group-hover:-translate-y-1"><UploadCloud size={29} strokeWidth={1.8} /></span>
        <span className="font-display text-base font-bold text-ink">Drop your medical PDF here</span>
        <span className="mt-2 text-xs text-muted">or click to browse from your computer</span>
        <span className="button-primary mt-5"><FileText size={15} />Choose PDF</span>
        <span className="mt-4 text-[11px] text-[#a0a4b8]">PDF only · Maximum file size 50 MB</span>
      </button>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => validate(e.target.files?.[0])} />
      {error && <p className="mt-3 text-xs font-medium text-[#dc4b58]">{error}</p>}
    </div>
  );
}

