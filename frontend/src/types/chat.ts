export interface Citation {
  id: number;
  documentId: number;
  documentName: string;
  pageNumber: number | null;
  chunkText: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  createdAt: string;
}

export interface Conversation {
  id: number;
  title: string;
  updatedAt: string;
}

export interface ChatResponse {
  answer: string;
  conversationId: number;
  citations: Citation[];
}
