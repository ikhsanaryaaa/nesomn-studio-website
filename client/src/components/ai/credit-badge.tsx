import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * Badge saldo credit user + biaya model terpilih. Saldo diambil dari
 * server (sumber kebenaran). cost ditampilkan bila model dipilih.
 */
export function CreditBadge({ cost }: { cost?: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ai-credit'],
    queryFn: () => api.ai.credit(),
  });

  const balance = data?.balance ?? 0;
  const insufficient = typeof cost === 'number' && cost > balance;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm">
      <Sparkles className="size-4 text-accent" />
      <span className="font-medium">
        {isLoading ? '...' : balance.toLocaleString('id-ID')}
      </span>
      <span className="text-muted-foreground">credit</span>
      {typeof cost === 'number' && cost > 0 && (
        <span className={`ml-1 text-xs ${insufficient ? 'text-danger' : 'text-muted-foreground'}`}>
          (-{cost})
        </span>
      )}
    </div>
  );
}
