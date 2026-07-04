import type { DashboardStats, DocumentDetail, MedicalDocument } from '../types/document';
import { apiClient } from './client';

interface ApiDocument {
  id: number;
  filename: string;
  original_filename: string;
  status: MedicalDocument['status'];
  chunk_count: number;
  created_at: string;
  error_message?: string | null;
}

interface ApiDocumentDetail extends ApiDocument {
  chunks: Array<{ chunk_index: number; page_number: number | null; preview: string }>;
}

const normalizeDocument = (document: ApiDocument): MedicalDocument => ({
  id: document.id,
  filename: document.original_filename || document.filename,
  status: document.status,
  chunkCount: document.chunk_count,
  createdAt: document.created_at,
  errorMessage: document.error_message ?? undefined,
});

export async function getDocuments(): Promise<MedicalDocument[]> {
  const { data } = await apiClient.get<ApiDocument[]>('/api/documents');
  return data.map(normalizeDocument);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await apiClient.get<{
    total_documents: number; indexed_chunks: number; conversations: number; average_response_time: number;
  }>('/api/dashboard/stats');
  return {
    totalDocuments: data.total_documents,
    indexedChunks: data.indexed_chunks,
    conversations: data.conversations,
    averageResponseTime: data.average_response_time,
  };
}

export async function getDocumentDetail(id: number): Promise<DocumentDetail> {
  const { data } = await apiClient.get<ApiDocumentDetail>(`/api/documents/${id}`);
  return {
    ...normalizeDocument(data),
    chunks: data.chunks.map((chunk) => ({
      chunkIndex: chunk.chunk_index,
      pageNumber: chunk.page_number,
      preview: chunk.preview,
    })),
  };
}

export async function deleteDocument(id: number): Promise<void> {
  await apiClient.delete(`/api/documents/${id}`);
}

export async function uploadDocument(file: File, onProgress: (progress: number) => void): Promise<MedicalDocument> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<ApiDocument>('/api/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => onProgress(event.total ? Math.round((event.loaded * 100) / event.total) : 0),
  });
  return {
    ...normalizeDocument(data),
    fileSize: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
  };
}
