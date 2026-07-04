import type { DocumentStatus } from '../../types/document';

const labels: Record<DocumentStatus, string> = {
  uploaded: 'Uploaded', processing: 'Processing', indexed: 'Indexed', failed: 'Failed',
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return <span className={`status-badge status-${status}`}><i />{labels[status]}</span>;
}

