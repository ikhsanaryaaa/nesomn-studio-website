import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AuthGate, PageState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { Seo } from '@/components/seo';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';
import { rp } from '@/lib/public-flow';
function DataState<T>({
  query,
  children,
}: {
  query: { isLoading: boolean; isError: boolean; data: T | undefined; refetch: () => unknown };
  children: (data: T) => ReactNode;
}) {
  if (query.isLoading) return <PageState loading title="Loading…" />;
  if (query.isError)
    return <PageState title="Unable to load data" retry={() => void query.refetch()} />;
  return query.data === undefined ? (
    <PageState title="Data is not available yet" />
  ) : (
    children(query.data)
  );
}
export default function AccountPage() {
  return (
    <AuthGate>
      <AccountWorkspace />
    </AuthGate>
  );
}
function AccountWorkspace() {
  const navigate = useNavigate(),
    auth = useAuth(),
    qc = useQueryClient();
  const [packPending, setPackPending] = useState(false),
    [error, setError] = useState('');
  const credit = useQuery({ queryKey: ['ai-credit'], queryFn: () => api.ai.credit() }),
    subscription = useQuery({
      queryKey: ['subscription'],
      queryFn: () => api.billing.subscription(),
    }),
    plans = useQuery({ queryKey: ['plans'], queryFn: () => api.billing.plans() }),
    packs = useQuery({ queryKey: ['credit-packs'], queryFn: () => api.billing.creditPacks() }),
    history = useQuery({ queryKey: ['billing-history'], queryFn: () => api.billing.history() }),
    sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api.sessions() });
  const cancel = useMutation({
    mutationFn: () => api.billing.cancel(),
    onSuccess: () => void subscription.refetch(),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.revokeSession(id),
    onSuccess: (_value, id) => {
      if (sessions.data?.find((s) => s.id === id)?.current) {
        qc.clear();
        navigate('/login');
      } else void sessions.refetch();
    },
  });
  async function topup(id: string) {
    if (packPending) return;
    setPackPending(true);
    setError('');
    try {
      const result = await api.billing.checkout({
        type: 'topup',
        gateway: 'qris',
        creditPackId: id,
      });
      navigate(result.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create an invoice.');
    } finally {
      setPackPending(false);
    }
  }
  return (
    <div className="page-wrap">
      <Seo title="Account" />
      <header className="page-heading">
        <div>
          <h1>Your workspace.</h1>
          <p>{auth.user?.name}</p>
        </div>
        <div className="workspace-actions">
          <Button asChild variant="secondary">
            <Link to="/editor/projects">My Projects</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/library">Asset Library</Link>
          </Button>
        </div>
      </header>
      <div className="account-summary">
        <section>
          <h2>AI credits</h2>
          <DataState query={credit}>
            {(data) => (
              <p className="account-value">
                {data.balance.toLocaleString('en-ID')} <span>credits</span>
              </p>
            )}
          </DataState>
        </section>
        <section>
          <h2>Subscription</h2>
          <DataState query={subscription}>
            {(data) =>
              data ? (
                <>
                  <p className="account-value">
                    {plans.data?.find((p) => p.id === data.planId)?.name ?? 'Your subscription'}
                  </p>
                  {plans.isError && <p>Unable to load the plan name.</p>}
                  <p>Status: {data.status}</p>
                  <p>
                    Current period ends{' '}
                    {data.currentPeriodEnd
                      ? new Date(data.currentPeriodEnd).toLocaleDateString('en-ID')
                      : 'Not available yet'}
                  </p>
                  {data.status === 'active' && (
                    <Button
                      variant="secondary"
                      disabled={cancel.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Cancel subscription renewal? Your access remains valid until the end of the period recorded by the server.',
                          )
                        )
                          cancel.mutate();
                      }}
                    >
                      Cancel renewal
                    </Button>
                  )}
                  {cancel.isError && <p role="alert">{cancel.error.message}</p>}
                </>
              ) : (
                <>
                  <p>No active subscription.</p>
                  <Link className="workspace-link" to="/pricing">
                    View plans
                  </Link>
                </>
              )
            }
          </DataState>
        </section>
      </div>
      <section className="account-section">
        <div className="section-heading">
          <h2>Top-up credits</h2>
        </div>
        <DataState query={packs}>
          {(data) =>
            data.length ? (
              <div className="pack-list">
                {data.map((p) => (
                  <div key={p.id}>
                    <div>
                      <h3>{p.name}</h3>
                      <p>
                        {p.credits} credits · {rp(p.priceIdr)}
                      </p>
                    </div>
                    <Button disabled={packPending} onClick={() => void topup(p.id)}>
                      {packPending ? 'Processing…' : 'Choose a plan'}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <PageState title="No credit packs are available yet" />
            )
          }
        </DataState>
        {error && (
          <p role="alert" className="workspace-error">
            {error}
          </p>
        )}
        <p className="workspace-followup-note">
          The unique payment code is shown before the QRIS code. Credits are added after server
          confirmation.
        </p>
      </section>
      <section className="account-section">
        <div className="section-heading">
          <h2>Payment history</h2>
        </div>
        <DataState query={history}>
          {(data) =>
            data.length ? (
              <ul className="history-list">
                {data.map((order) => (
                  <li key={order.id}>
                    <div>
                      <strong>{order.type}</strong>
                      <p>
                        {new Date(order.createdAt).toLocaleDateString('en-ID')} · {order.gateway}
                      </p>
                    </div>
                    <div>
                      <p>
                        {rp(order.amountIdr)}{' '}
                        <span className="workspace-caption">before the unique payment code</span>
                      </p>
                      <span className="payment-status">{order.status}</span>
                      {order.gateway === 'qris' && (
                        <Link className="workspace-link" to={'/checkout?order=' + order.id}>
                          View invoice
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <PageState title="No payment history yet" />
            )
          }
        </DataState>
      </section>
      <section className="account-section">
        <div className="section-heading">
          <h2>Device sessions</h2>
        </div>
        <DataState query={sessions}>
          {(data) =>
            data.length ? (
              <ul className="session-list">
                {data.map((s) => (
                  <li key={s.id}>
                    <div>
                      <p>{s.userAgent ?? 'Unknown device'}</p>
                      <p className="workspace-description">
                        {s.current ? 'This session · ' : ''}
                        {new Date(s.lastSeenAt).toLocaleString('en-ID')}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate(s.id)}
                    >
                      {s.current ? 'Log out of this session' : 'Revoke session'}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <PageState title="No sessions to display" />
            )
          }
        </DataState>
        {revoke.isError && <p role="alert">{revoke.error.message}</p>}
      </section>
    </div>
  );
}
