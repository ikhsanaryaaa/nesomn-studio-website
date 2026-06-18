import { useQuery } from '@tanstack/react-query';
import { CreditCard, FolderOpen, Library, Monitor } from 'lucide-react';
import { Topbar } from '@/components/shell/topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Seo } from '@/components/seo';
import { api } from '@/lib/api';

function EmptyState({ icon: Icon, text }: { icon: typeof FolderOpen; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-surface-2">
        <Icon className="size-5 text-muted-foreground" />
      </span>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function formatIdr(value: string | number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatDate(value: string | Date | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_VARIANT: Record<string, 'popular' | 'save' | 'neutral'> = {
  paid: 'save',
  pending: 'neutral',
  failed: 'neutral',
  refunded: 'neutral',
};

export default function AccountPage() {
  const credit = useQuery({ queryKey: ['ai-credit'], queryFn: () => api.ai.credit() });
  const subscription = useQuery({ queryKey: ['subscription'], queryFn: () => api.billing.subscription() });
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api.billing.plans() });
  const history = useQuery({ queryKey: ['billing-history'], queryFn: () => api.billing.history() });
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api.sessions() });

  const balance = credit.data?.balance ?? 0;
  const activePlan = plans.data?.find((p) => p.id === subscription.data?.planId);
  const planName = activePlan?.name ?? 'Free Basic';
  const isPro = Boolean(subscription.data);

  async function handleCancel() {
    await api.billing.cancel();
    subscription.refetch();
  }

  return (
    <>
      <Seo
        title="Account"
        description="Dashboard akun Nesomn Studio: credit, plan, project, dan sesi."
      />
      <Topbar title="Account" />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Dashboard</h1>

        {/* Ringkasan */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">AI Credits</CardTitle>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-2xl font-bold">
                  {credit.isLoading ? '...' : balance.toLocaleString('id-ID')}
                </span>
                <span className="text-sm text-muted-foreground">credit</span>
              </div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Plan Aktif</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold">{planName}</span>
                {isPro && <Badge variant="popular">Pro</Badge>}
              </div>
            </CardHeader>
            {isPro && (
              <CardContent className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                  Berlaku sampai {formatDate(subscription.data?.currentPeriodEnd ?? null)}
                </p>
                {subscription.data?.status === 'active' ? (
                  <Button size="sm" variant="ghost" onClick={handleCancel} id="cancel-subscription">
                    Batalkan langganan
                  </Button>
                ) : (
                  <Badge variant="neutral">Dibatalkan, aktif sampai periode habis</Badge>
                )}
              </CardContent>
            )}
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Sesi Aktif</CardTitle>
              <span className="font-mono text-2xl font-bold">{sessions.data?.length ?? 0}</span>
            </CardHeader>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="billing">
          <TabsList>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="projects">My Projects</TabsTrigger>
            <TabsTrigger value="library">Asset Library</TabsTrigger>
          </TabsList>

          <TabsContent value="billing">
            <Card>
              {history.data && history.data.length > 0 ? (
                <CardContent className="flex flex-col divide-y divide-border p-0">
                  {history.data.map((o) => (
                    <div key={o.id} className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium capitalize">{o.type}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm">{formatIdr(o.amountIdr)}</span>
                        <Badge variant={STATUS_VARIANT[o.status] ?? 'neutral'}>{o.status}</Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              ) : (
                <EmptyState icon={CreditCard} text="Belum ada riwayat pembayaran." />
              )}
            </Card>
          </TabsContent>

          <TabsContent value="sessions">
            <Card>
              {sessions.data && sessions.data.length > 0 ? (
                <CardContent className="flex flex-col divide-y divide-border p-0">
                  {sessions.data.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-5 py-3.5">
                      <span className="truncate text-sm">{s.userAgent ?? 'Perangkat tak dikenal'}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(s.lastSeenAt)}</span>
                    </div>
                  ))}
                </CardContent>
              ) : (
                <EmptyState icon={Monitor} text="Daftar sesi aktif akan muncul di sini." />
              )}
            </Card>
          </TabsContent>

          <TabsContent value="projects">
            <Card>
              <EmptyState
                icon={FolderOpen}
                text="Belum ada project. Mulai dari Scene Editor atau 3D Editor."
              />
            </Card>
          </TabsContent>

          <TabsContent value="library">
            <Card>
              <EmptyState
                icon={Library}
                text="Asset library kosong. Aset yang Anda miliki akan muncul di sini."
              />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
