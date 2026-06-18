import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { FeatureAccess } from '@nesomn/shared';

const DEFAULT_ACCESS: FeatureAccess = {
  scene2d: true,
  editor3d: false,
  proTemplates: false,
  aiVideo: false,
};

/**
 * Hak akses fitur user dari plan aktif (server-side). Dipakai untuk gating
 * UI (mis. sembunyikan 3D editor / AI video bila tak punya akses). Default
 * Free saat belum login atau saat data belum termuat.
 */
export function useFeatureAccess() {
  const query = useQuery<FeatureAccess>({
    queryKey: ['feature-access'],
    queryFn: () => api.access(),
    staleTime: 60_000,
  });

  return {
    access: query.data ?? DEFAULT_ACCESS,
    isLoading: query.isLoading,
  };
}
