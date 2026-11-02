import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * Badge saldo credit user + biaya model terpilih. Saldo diambil dari
 * server (sumber kebenaran). cost ditampilkan bila model dipilih.
 */
export function CreditBadge({ cost }: { cost?: number }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ai-credit'],
    queryFn: () => api.ai.credit(),
  });

  const balance = data?.balance;
  const insufficient = typeof cost === 'number' && balance !== undefined && cost > balance;

  return (
    <div className="ai-credit-badge">
      <Sparkles className="ai-credit-icon" />
      <span className="editor-emphasis">
        {isError ? (
          <button type="button" className="ai-credit-retry" onClick={() => void refetch()}>
            Unable to load balance · Try again
          </button>
        ) : isLoading ? (
          '...'
        ) : (
          balance?.toLocaleString('en-ID')
        )}
      </span>
      <span className="editor-muted">credit</span>
      {typeof cost === 'number' && cost > 0 && (
        <span className={`ai-credit-cost ${insufficient ? 'ai-credit-cost--insufficient' : ''}`}>
          (-{cost})
        </span>
      )}
    </div>
  );
}
