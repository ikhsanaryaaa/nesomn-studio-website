import { Link, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { loginUrl } from '@/lib/public-flow';

export function PageState({
  title,
  children,
  retry,
  loading = false,
}: {
  title: string;
  children?: ReactNode;
  retry?: () => void;
  loading?: boolean;
}) {
  return (
    <div className="page-state" role={retry ? 'alert' : loading ? 'status' : undefined}>
      <h2>{title}</h2>
      {children && <div className="text-muted-foreground">{children}</div>}
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Coba lagi
        </Button>
      )}
    </div>
  );
}
export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth(),
    location = useLocation();
  if (auth.isLoading) return <PageState title="Memeriksa sesi…" loading />;
  if (auth.isError)
    return <PageState title="Sesi belum dapat diperiksa" retry={() => void auth.refetch()} />;
  if (!auth.isAuthenticated)
    return (
      <PageState title="Masuk ke workspace Anda">
        <p>Login untuk mengakses aset, project, dan akun milik Anda.</p>
        <Button asChild>
          <Link to={loginUrl(location.pathname + location.search)}>Login</Link>
        </Button>
      </PageState>
    );
  return children;
}
