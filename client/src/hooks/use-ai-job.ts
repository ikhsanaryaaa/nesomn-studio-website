import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AiJobDTO } from '@nesomn/shared';

/**
 * Polling status 1 job AI sampai mencapai status terminal (done/failed).
 * Mengembalikan job terkini; berhenti polling saat selesai. jobId null
 * menonaktifkan query.
 */
export function useAiJob(jobId: string | null) {
  const query = useQuery<AiJobDTO>({
    queryKey: ['ai-job', jobId],
    queryFn: () => api.ai.getJob(jobId as string),
    enabled: Boolean(jobId),
    // Polling tiap 1.5 detik selama job belum selesai.
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === 'done' || status === 'failed' ? false : 1500;
    },
  });

  const status = query.data?.status;
  return {
    job: query.data ?? null,
    isPending: status === 'pending' || status === 'processing',
    isDone: status === 'done',
    isFailed: status === 'failed',
    isLoading: query.isLoading,
  };
}
