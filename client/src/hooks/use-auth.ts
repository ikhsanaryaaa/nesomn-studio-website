import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiRequestError } from '@/lib/api';
import type { UserDTO } from '@nesomn/shared';

import { setEditorIdentity } from '@/lib/editor-session';

const ME_KEY = ['me'] as const;

/**
 * Hook auth tipis: query `/me` untuk menentukan status login.
 * Error 401 dianggap "belum login" (bukan error fatal).
 */
export function useAuth() {
  const query = useQuery<UserDTO | null>({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        const user = await api.me();
        setEditorIdentity(user.id);
        return user;
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 401) {
          setEditorIdentity(null);
          return null;
        }
        throw err;
      }
    },
    staleTime: 60_000,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    isAuthenticated: !!query.data,
    refetch: query.refetch,
  };
}

/** Logout lalu segarkan status auth. */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      setEditorIdentity(null);
      queryClient.clear();
      queryClient.setQueryData(ME_KEY, null);
      queryClient.invalidateQueries({ queryKey: ME_KEY });
    },
  });
}
