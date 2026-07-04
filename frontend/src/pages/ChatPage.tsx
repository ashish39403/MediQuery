import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  Check,
  ChevronDown,
  FileText,
  MessageSquareMore,
  MessageSquarePlus,
  PanelRightClose,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { askQuestion, deleteConversation, getConversations } from '../api/chat';
import { getDocuments } from '../api/documents';
import { CitationCard } from '../components/chat/CitationCard';
import type { ChatMessage, Citation, Conversation } from '../types/chat';

const welcomeMessages: ChatMessage[] = [{
  id: 'welcome',
  role: 'assistant',
  createdAt: new Date().toISOString(),
  content: 'I am ready to search your indexed medical documents. Select one or more sources, then ask a specific question. I will keep the answer grounded and show exactly where it came from.',
}];

const suggestions = [
  'Summarize the main findings in the selected documents.',
  'What important warnings are mentioned?',
  'List the key recommendations with sources.',
];

export function ChatPage() {
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(welcomeMessages);
  const [selectedDocuments, setSelectedDocuments] = useState<number[]>([]);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [showDocuments, setShowDocuments] = useState(false);
  const [mobileChatsOpen, setMobileChatsOpen] = useState(false);
  const [mobileSourceOpen, setMobileSourceOpen] = useState(false);
  const selectionInitialized = useRef(false);

  const documents = useQuery({ queryKey: ['documents'], queryFn: getDocuments });
  const conversations = useQuery({ queryKey: ['conversations'], queryFn: getConversations });
  const selectedNames = useMemo(
    () => documents.data
      ?.filter((document) => selectedDocuments.includes(document.id))
      .map((document) => document.filename) ?? [],
    [documents.data, selectedDocuments],
  );

  useEffect(() => {
    if (!documents.data) return;
    const indexedIds = documents.data
      .filter((document) => document.status === 'indexed')
      .map((document) => document.id);
    if (!selectionInitialized.current) {
      setSelectedDocuments(indexedIds);
      selectionInitialized.current = true;
      return;
    }
    setSelectedDocuments((selected) => selected.filter((id) => indexedIds.includes(id)));
  }, [documents.data]);

  const ask = useMutation({
    mutationFn: ({ text }: { text: string }) => (
      askQuestion(text, selectedDocuments, currentConversationId)
    ),
    onSuccess: (response) => {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.answer,
        citations: response.citations,
        createdAt: new Date().toISOString(),
      }]);
      setActiveCitation(response.citations[0] ?? null);
      setCurrentConversationId(response.conversationId);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (error) => setMessages((current) => [...current, {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `I couldn't complete that request. ${error.message}`,
      createdAt: new Date().toISOString(),
    }]),
  });

  const startNewConversation = () => {
    setMessages(welcomeMessages);
    setCurrentConversationId(null);
    setActiveCitation(null);
    setQuestion('');
    setMobileChatsOpen(false);
    setMobileSourceOpen(false);
    setPendingDeleteId(null);
  };

  const removeConversation = useMutation({
    mutationFn: deleteConversation,
    onSuccess: (_, id) => {
      queryClient.setQueryData<Conversation[]>(
        ['conversations'],
        (current = []) => current.filter((conversation) => conversation.id !== id),
      );
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      setPendingDeleteId(null);
      if (currentConversationId === id) startNewConversation();
    },
  });

  const submit = (text = question) => {
    const clean = text.trim();
    if (!clean || ask.isPending || !selectedDocuments.length) return;
    setMessages((current) => [...current, {
      id: crypto.randomUUID(),
      role: 'user',
      content: clean,
      createdAt: new Date().toISOString(),
    }]);
    setQuestion('');
    ask.mutate({ text: clean });
  };

  const toggleDocument = (id: number) => {
    setSelectedDocuments((selected) => (
      selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]
    ));
  };

  const conversationListProps = {
    conversations: conversations.data,
    errorMessage: conversations.isError ? conversations.error.message : undefined,
    currentConversationId,
    pendingDeleteId,
    deletePending: removeConversation.isPending,
    deleteError: removeConversation.isError ? removeConversation.error.message : undefined,
    onRequestDelete: (id: number) => {
      removeConversation.reset();
      setPendingDeleteId(id);
    },
    onCancelDelete: () => {
      removeConversation.reset();
      setPendingDeleteId(null);
    },
    onConfirmDelete: (id: number) => removeConversation.mutate(id),
  };

  return (
    <div className="flex h-[calc(100dvh-6.25rem)] min-h-[600px] flex-col lg:h-[calc(100vh-4.5rem)] lg:min-h-[690px]">
      <header className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">Grounded workspace</p>
          <h1 className="font-display text-[28px] font-extrabold tracking-[-0.045em]">Ask MediQuery</h1>
          <p className="mt-1.5 text-xs text-muted">Every answer is traceable to your selected sources.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button onClick={() => setMobileChatsOpen(true)} className="button-secondary px-3 xl:hidden">
            <MessageSquareMore size={15} /> Chats
          </button>
          <div className="relative min-w-0 flex-1 sm:min-w-48">
            <button
              onClick={() => setShowDocuments(!showDocuments)}
              disabled={documents.isLoading || documents.isError}
              className="button-secondary w-full justify-between"
            >
              <span>{selectedDocuments.length} document{selectedDocuments.length !== 1 ? 's' : ''} selected</span>
              <ChevronDown size={14} />
            </button>
            {showDocuments && (
              <div className="absolute right-0 top-12 z-20 w-full min-w-72 rounded-2xl border border-[#e5e5ee] bg-white p-2 shadow-[0_18px_50px_rgba(30,27,57,.16)] sm:w-72">
                {documents.data?.filter((document) => document.status === 'indexed').length
                  ? documents.data.filter((document) => document.status === 'indexed').map((document) => (
                    <button key={document.id} onClick={() => toggleDocument(document.id)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-[#f7f5ff]">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${selectedDocuments.includes(document.id) ? 'border-primary bg-primary text-white' : 'border-[#dfe0e8]'}`}>
                        {selectedDocuments.includes(document.id) && <Check size={12} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold">{document.filename}</span>
                    </button>
                  ))
                  : <div className="p-4 text-center"><p className="text-xs font-bold">No indexed documents</p><p className="mt-1 text-[10px] leading-4 text-muted">Upload and index a PDF first.</p></div>}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="card grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[230px_minmax(400px,1fr)_290px]">
        <aside className="hidden min-h-0 flex-col border-r border-[#ececf2] bg-[#fcfcfe] xl:flex">
          <div className="border-b border-[#ececf2] p-4">
            <button onClick={startNewConversation} className="button-secondary w-full text-primary"><MessageSquarePlus size={15} />New conversation</button>
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto p-2">
            <p className="px-2 py-3 text-[10px] font-bold uppercase tracking-wider text-[#9ca0b3]">Recent</p>
            <ConversationList {...conversationListProps} />
          </div>
          <div className="border-t border-[#ececf2] p-3 text-[10px] leading-4 text-muted">Delete removes the conversation and all of its messages.</div>
        </aside>

        <main className="flex min-h-0 flex-col bg-white">
          <div className="scrollbar-thin flex-1 space-y-6 overflow-y-auto p-5 sm:p-7">
            {documents.isError && <div className="rounded-xl border border-[#ffd5d8] bg-[#fff5f6] p-4 text-xs text-[#b93643]">Could not load documents: {documents.error.message}</div>}
            {messages.map((message) => (
              <Message
                key={message.id}
                message={message}
                onCitation={(citation) => {
                  setActiveCitation(citation);
                  setMobileSourceOpen(true);
                }}
              />
            ))}
            {ask.isPending && (
              <div className="flex items-start gap-3"><Avatar role="assistant" /><div className="rounded-2xl rounded-tl-md border border-[#ececf3] bg-[#fafafe] px-4 py-3"><div className="flex items-center gap-2 text-xs text-muted"><span className="loader h-4 w-4" />Searching selected documents…</div></div></div>
            )}
            {messages.length === 1 && (
              <div className="ml-0 grid gap-2 sm:ml-11 sm:grid-cols-3">
                {suggestions.map((suggestion) => (
                  <button key={suggestion} disabled={!selectedDocuments.length} onClick={() => submit(suggestion)} className="rounded-xl border border-[#e8e7f0] bg-white p-3 text-left text-[10px] font-semibold leading-4 text-[#555a73] transition hover:border-[#bdb2f3] hover:bg-[#faf9ff] hover:text-primary disabled:cursor-not-allowed disabled:opacity-50">{suggestion}</button>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-[#ececf2] bg-white p-3 sm:p-4">
            <div className="rounded-2xl border border-[#dfe0e9] bg-white p-2 shadow-[0_7px_20px_rgba(38,39,69,.07)]">
              <textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} rows={2} placeholder="Ask a question about your documents…" className="w-full resize-none border-0 bg-transparent px-2 py-1 text-sm leading-6 outline-none placeholder:text-[#afb2c1]" />
              <div className="flex items-center justify-between">
                <p className="hidden max-w-[80%] truncate pl-2 text-[10px] text-muted sm:block">Grounded in {selectedNames.length ? selectedNames.join(', ') : 'no selected documents'}</p>
                <button onClick={() => submit()} disabled={!question.trim() || ask.isPending || !selectedDocuments.length} className="button-primary ml-auto h-9 w-9 rounded-xl p-0" aria-label="Send message"><Send size={15} /></button>
              </div>
            </div>
            <p className="mt-2 text-center text-[9px] text-[#9ca0b3]">MediQuery can make mistakes. Verify important medical information with a professional.</p>
          </div>
        </main>

        <aside className="hidden min-h-0 flex-col border-l border-[#ececf2] bg-[#fcfcfe] xl:flex">
          <div className="flex items-center justify-between border-b border-[#ececf2] px-4 py-4"><div><p className="text-xs font-bold">Source preview</p><p className="mt-1 text-[10px] text-muted">Retrieved evidence</p></div><PanelRightClose size={16} className="text-[#9ca0b3]" /></div>
          {activeCitation ? <SourcePreview citation={activeCitation} /> : <div className="flex flex-1 flex-col items-center justify-center p-6 text-center"><Sparkles size={22} className="text-[#b4a9ef]" /><p className="mt-3 text-xs font-bold">Sources appear here</p><p className="mt-1 text-[10px] leading-4 text-muted">Ask a question to inspect the retrieved chunks.</p></div>}
        </aside>
      </div>

      {mobileChatsOpen && (
        <div className="fixed inset-0 z-[70] flex items-end bg-[#121936]/45 backdrop-blur-sm xl:hidden">
          <button className="absolute inset-0" onClick={() => setMobileChatsOpen(false)} aria-label="Close conversations" />
          <div className="relative z-10 max-h-[82dvh] w-full overflow-hidden rounded-t-[24px] bg-white shadow-[0_-20px_60px_rgba(22,24,47,.2)]">
            <div className="flex items-center justify-between border-b border-[#ececf2] px-5 py-4"><div><p className="text-sm font-bold">Saved conversations</p><p className="mt-1 text-[10px] text-muted">Manage your chat history</p></div><button onClick={() => setMobileChatsOpen(false)} className="icon-button" aria-label="Close conversations"><X size={17} /></button></div>
            <div className="border-b border-[#ececf2] p-4"><button onClick={startNewConversation} className="button-secondary w-full text-primary"><MessageSquarePlus size={15} />New conversation</button></div>
            <div className="scrollbar-thin max-h-[calc(82dvh-132px)] overflow-y-auto p-3"><ConversationList {...conversationListProps} /></div>
          </div>
        </div>
      )}

      {mobileSourceOpen && activeCitation && (
        <div className="fixed inset-0 z-[70] flex items-end bg-[#121936]/45 backdrop-blur-sm xl:hidden">
          <button className="absolute inset-0" onClick={() => setMobileSourceOpen(false)} aria-label="Close source preview" />
          <div className="relative z-10 max-h-[78dvh] w-full overflow-hidden rounded-t-[24px] bg-white shadow-[0_-20px_60px_rgba(22,24,47,.2)]">
            <div className="flex items-center justify-between border-b border-[#ececf2] px-5 py-4"><div><p className="text-sm font-bold">Source preview</p><p className="mt-1 text-[10px] text-muted">Retrieved evidence</p></div><button onClick={() => setMobileSourceOpen(false)} className="icon-button" aria-label="Close source preview"><X size={17} /></button></div>
            <SourcePreview citation={activeCitation} />
          </div>
        </div>
      )}
    </div>
  );
}

function ConversationList({ conversations, errorMessage, currentConversationId, pendingDeleteId, deletePending, deleteError, onRequestDelete, onCancelDelete, onConfirmDelete }: {
  conversations?: Conversation[];
  errorMessage?: string;
  currentConversationId: number | null;
  pendingDeleteId: number | null;
  deletePending: boolean;
  deleteError?: string;
  onRequestDelete: (id: number) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: number) => void;
}) {
  if (errorMessage) return <p className="rounded-xl bg-[#fff0f1] p-3 text-[10px] leading-4 text-[#b93643]">Could not load chats: {errorMessage}</p>;
  if (!conversations?.length) return <p className="px-3 py-6 text-center text-[10px] leading-4 text-muted">No saved conversations yet.</p>;

  return <>{conversations.map((conversation) => (
    <div key={conversation.id} className={`group mb-1 rounded-xl p-3 transition ${currentConversationId === conversation.id ? 'bg-[#f0edff]' : 'hover:bg-[#f5f5fa]'}`}>
      {pendingDeleteId === conversation.id ? (
        <div>
          <p className="text-[11px] font-bold text-[#b93643]">Delete this chat?</p>
          <p className="mt-1 text-[10px] text-muted">All messages in this conversation will be removed.</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => onConfirmDelete(conversation.id)} disabled={deletePending} className="rounded-lg bg-[#dc4b58] px-2.5 py-1.5 text-[10px] font-bold text-white disabled:opacity-60" aria-label={`Confirm delete ${conversation.title}`}>Delete</button>
            <button onClick={onCancelDelete} className="rounded-lg border border-[#dedfe8] bg-white px-2.5 py-1.5 text-[10px] font-bold text-muted">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1"><p className={`line-clamp-2 text-[11px] font-bold leading-4 ${currentConversationId === conversation.id ? 'text-primary' : 'text-[#4f546d]'}`}>{conversation.title}</p><p className="mt-1.5 text-[10px] text-muted">{conversation.updatedAt}</p></div>
          <button onClick={() => onRequestDelete(conversation.id)} className="icon-button h-7 w-7 shrink-0 opacity-70 hover:border-[#ffd4d8] hover:bg-[#fff7f7] hover:text-[#dc4b58] group-hover:opacity-100" aria-label={`Delete chat ${conversation.title}`}><Trash2 size={12} /></button>
        </div>
      )}
    </div>
  ))}{deleteError && <p className="mt-2 rounded-xl bg-[#fff0f1] p-3 text-[10px] leading-4 text-[#b93643]">Delete failed: {deleteError}</p>}</>;
}

function Avatar({ role }: { role: ChatMessage['role'] }) {
  return <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${role === 'assistant' ? 'bg-primary text-white' : 'bg-[#e8eaf1] text-[#60657d]'}`}>{role === 'assistant' ? <Bot size={16} /> : <UserRound size={15} />}</span>;
}

function Message({ message, onCitation }: { message: ChatMessage; onCitation: (citation: Citation) => void }) {
  return <div className={`flex items-start gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}><Avatar role={message.role} /><div className={`max-w-[86%] ${message.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}><div className={`whitespace-pre-line rounded-2xl px-4 py-3 text-xs leading-6 ${message.role === 'user' ? 'rounded-tr-md bg-gradient-to-br from-[#7655eb] to-[#5a36da] text-white' : 'rounded-tl-md border border-[#ececf3] bg-[#fafafe] text-[#393e58]'}`}>{message.content}</div>{message.citations?.length ? <div className="mt-3 w-full"><p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8e92a8]"><FileText size={12} />Citations ({message.citations.length})</p><div className="grid gap-2 sm:grid-cols-2">{message.citations.map((citation, index) => <CitationCard key={citation.id} citation={citation} index={index + 1} onClick={() => onCitation(citation)} />)}</div></div> : null}</div></div>;
}

function SourcePreview({ citation }: { citation: Citation }) {
  return <div className="scrollbar-thin max-h-[calc(78dvh-70px)] flex-1 overflow-y-auto p-4"><div className="mb-4 flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eeeaff] text-primary"><FileText size={17} /></span><div className="min-w-0"><p className="truncate text-[11px] font-bold">{citation.documentName}</p><p className="mt-0.5 text-[10px] text-muted">Page {citation.pageNumber ?? '-'}</p></div></div><div className="rounded-xl border border-[#e4e5ed] bg-white p-4"><p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-primary">Matched passage</p><p className="text-xs leading-6 text-[#4f546d]">{citation.chunkText}</p></div><div className="mt-4 rounded-xl bg-[#eaf9f2] p-3"><p className="text-[10px] font-bold text-[#17875f]">Relevance score</p><div className="mt-2 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[#2fbb83]" style={{ width: `${citation.score * 100}%` }} /></div><span className="text-[11px] font-bold text-[#17875f]">{Math.round(citation.score * 100)}%</span></div></div></div>;
}
