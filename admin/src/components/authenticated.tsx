import { useIsAuthenticated, useGo } from '@refinedev/core';
import { useEffect, type ReactNode } from 'react';
import { Spin } from 'antd';

/**
 * Penjaga rute: cek sesi via authProvider.check().
 * - children dirender bila status auth sesuai harapan.
 * - fallback dipakai untuk rute publik (mis. /login) saat belum login.
 */
export function Authenticated({
  children,
  fallback,
}: {
  key?: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { isLoading, data } = useIsAuthenticated();
  const go = useGo();
  const authenticated = data?.authenticated ?? false;

  useEffect(() => {
    if (isLoading) return;
    if (!authenticated && !fallback) {
      go({ to: '/login', type: 'replace' });
    }
  }, [isLoading, authenticated, fallback, go]);

  if (isLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!authenticated) {
    return <>{fallback ?? null}</>;
  }

  return <>{children}</>;
}
