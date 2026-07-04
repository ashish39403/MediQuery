export type DocumentStatus = 'uploaded' | 'processing' | 'indexed' | 'failed';

export interface MedicalDocument {
  id: number;
  filename: string;
  fileSize?: string;
  status: DocumentStatus;
  chunkCount: number | null;
  createdAt: string;
  progress?: number;
  errorMessage?: string;
}

export interface DashboardStats {
  totalDocuments: number;
  indexedChunks: number;
  conversations: number;
  averageResponseTime: number;
}

export interface DocumentChunkSummary {
  chunkIndex: number;
  pageNumber: number | null;
  preview: string;
}

export interface DocumentDetail extends MedicalDocument {
  chunks: DocumentChunkSummary[];
}
