import type { ChatResponse, Conversation } from '../types/chat';
import { apiClient } from './client';

function relativeTime(date: string): string {
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60_000));
  if (elapsedMinutes < 1) return 'Just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes} min${elapsedMinutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(elapsedMinutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export async function getConversations(): Promise<Conversation[]> {
  const { data } = await apiClient.get<Array<{ id: number; title: string; created_at: string }>>('/api/conversations');
  return data.map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    updatedAt: relativeTime(conversation.created_at),
  }));
}

export async function deleteConversation(id: number): Promise<void> {
  await apiClient.delete(`/api/conversations/${id}`);
}

export async function askQuestion(question: string, documentIds: number[], conversationId: number | null): Promise<ChatResponse> {
  const { data } = await apiClient.post<{
    answer: string;
    conversation_id: number;
    citations: Array<{
      document_id: number; document_name: string; page_number: number | null;
      chunk_text: string; score: number; chunk_index: number;
    }>;
  }>('/api/chat', { question, document_ids: documentIds, conversation_id: conversationId });
  return {
    answer: data.answer,
    conversationId: data.conversation_id,
    citations: data.citations.map((citation, index) => ({
      id: index + 1,
      documentId: citation.document_id,
      documentName: citation.document_name,
      pageNumber: citation.page_number,
      chunkText: citation.chunk_text,
      score: citation.score,
    })),
  };
}
