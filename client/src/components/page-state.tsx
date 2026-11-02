import { Link, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { ArrowRight, Layers, LogIn } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { loginUrl } from '@/lib/public-flow';
import './page-state.css';

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
      {children && <div className="page-state-description">{children}</div>}
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth(),
    location = useLocation();
  if (auth.isLoading) return <PageState title="Checking your session…" loading />;
  if (auth.isError)
    return <PageState title="Unable to check your session" retry={() => void auth.refetch()} />;
  if (!auth.isAuthenticated)
    return (
      <div className="workspace-access">
        <section className="workspace-access-panel" aria-labelledby="workspace-access-title">
          <div className="workspace-access-symbol" aria-hidden="true">
            <Layers strokeWidth={1.5} />
          </div>
          <h1 id="workspace-access-title">Log in to your workspace</h1>
          <p>Log in to access your assets, projects, and account.</p>
          <div className="workspace-access-actions">
            <Button asChild>
              <Link to={loginUrl(location.pathname + location.search)}>
                <LogIn aria-hidden="true" />
                Log in
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/marketplace">Explore assets</Link>
            </Button>
          </div>
        </section>
      </div>
    );
  return children;
}
