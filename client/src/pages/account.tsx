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
  if (query.isLoading) return <PageState loading title="Memuat…" />;
  if (query.isError)
    return <PageState title="Data tidak dapat dimuat" retry={() => void query.refetch()} />;
  return query.data === undefined ? (
    <PageState title="Data belum tersedia" />
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
      setError(err instanceof Error ? err.message : 'Invoice belum dapat dibuat.');
    } finally {
      setPackPending(false);
    }
  }
  return (
    <div className="page-wrap">
      <Seo title="Account" />
      <header className="page-heading">
        <div>
          <h1>Ruang kerja Anda.</h1>
          <p>{auth.user?.name}</p>
        </div>
        <div className="flex flex-wrap gap-3">
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
                {data.balance.toLocaleString('id-ID')} <span>credits</span>
              </p>
            )}
          </DataState>
        </section>
        <section>
          <h2>Langganan</h2>
          <DataState query={subscription}>
            {(data) =>
              data ? (
                <>
                  <p className="account-value">
                    {plans.data?.find((p) => p.id === data.planId)?.name ?? 'Langganan Anda'}
                  </p>
                  {plans.isError && <p>Nama plan belum dapat dimuat.</p>}
                  <p>Status: {data.status}</p>
                  <p>
                    Periode sampai{' '}
                    {data.currentPeriodEnd
                      ? new Date(data.currentPeriodEnd).toLocaleDateString('id-ID')
                      : 'Belum tersedia'}
                  </p>
                  {data.status === 'active' && (
                    <Button
                      variant="secondary"
                      disabled={cancel.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Batalkan perpanjangan langganan? Akses mengikuti akhir periode di server.',
                          )
                        )
                          cancel.mutate();
                      }}
                    >
                      Batalkan perpanjangan
                    </Button>
                  )}
                  {cancel.isError && <p role="alert">{cancel.error.message}</p>}
                </>
              ) : (
                <>
                  <p>Tidak ada langganan aktif.</p>
                  <Link className="text-accent underline" to="/pricing">
                    Lihat paket
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
                      {packPending ? 'Memproses…' : 'Pilih paket'}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <PageState title="Belum ada paket top-up tersedia" />
            )
          }
        </DataState>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          Kode unik ditampilkan sebelum QRIS. Credits aktif setelah konfirmasi server.
        </p>
      </section>
      <section className="account-section">
        <div className="section-heading">
          <h2>Riwayat pembayaran</h2>
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
                        {new Date(order.createdAt).toLocaleDateString('id-ID')} · {order.gateway}
                      </p>
                    </div>
                    <div>
                      <p>
                        {rp(order.amountIdr)}{' '}
                        <span className="text-xs text-muted-foreground">sebelum kode unik</span>
                      </p>
                      <span className="payment-status">{order.status}</span>
                      {order.gateway === 'qris' && (
                        <Link className="text-accent underline" to={'/checkout?order=' + order.id}>
                          Lihat invoice
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <PageState title="Belum ada riwayat pembayaran" />
            )
          }
        </DataState>
      </section>
      <section className="account-section">
        <div className="section-heading">
          <h2>Sesi perangkat</h2>
        </div>
        <DataState query={sessions}>
          {(data) =>
            data.length ? (
              <ul className="session-list">
                {data.map((s) => (
                  <li key={s.id}>
                    <div>
                      <p>{s.userAgent ?? 'Perangkat tidak dikenal'}</p>
                      <p className="text-sm text-muted-foreground">
                        {s.current ? 'Sesi ini · ' : ''}
                        {new Date(s.lastSeenAt).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate(s.id)}
                    >
                      {s.current ? 'Keluar sesi ini' : 'Cabut sesi'}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <PageState title="Tidak ada sesi untuk ditampilkan" />
            )
          }
        </DataState>
        {revoke.isError && <p role="alert">{revoke.error.message}</p>}
      </section>
    </div>
  );
}
