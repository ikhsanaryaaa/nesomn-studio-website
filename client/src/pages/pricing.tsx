import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import { Topbar } from '@/components/shell/topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Seo } from '@/components/seo';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { api, ApiRequestError } from '@/lib/api';
import type { PlanDTO, BillingCycle } from '@nesomn/shared';

function formatIdr(value: string | number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

/** Daftar fitur ringkas dari editorAccess plan. */
function planFeatures(plan: PlanDTO): string[] {
  const f: string[] = [];
  if (plan.editorAccess.scene2d) f.push('Scene Editor 2D');
  if (plan.editorAccess.editor3d) f.push('3D Editor');
  if (plan.editorAccess.aiVideo) f.push('AI Video (Motion)');
  if (plan.editorAccess.proTemplates) f.push('Template Pro');
  if (plan.creditQuota > 0) f.push(`${plan.creditQuota} AI credits / siklus`);
  if (plan.commercial) f.push('Lisensi komersial');
  f.push(plan.maxConcurrentSessions ? `${plan.maxConcurrentSessions} sesi` : 'Sesi tak terbatas');
  return f;
}

export default function PricingPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [yearly, setYearly] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const cycle: BillingCycle = yearly ? 'yearly' : 'monthly';
  const plansQuery = useQuery({ queryKey: ['plans'], queryFn: () => api.billing.plans() });

  // Tampilkan plan individual sesuai siklus terpilih.
  const visible = useMemo(() => {
    const rows = plansQuery.data ?? [];
    return rows.filter((p) => p.segment === 'individual' && p.cycle === cycle);
  }, [plansQuery.data, cycle]);

  async function handleSubscribe(plan: PlanDTO) {
    if (plan.isEnterprise) {
      window.location.href = 'mailto:sales@nesomn.com?subject=Enterprise Inquiry';
      return;
    }
    if (Number(plan.priceIdr) === 0) {
      navigate('/account');
      return;
    }
    setPendingId(plan.id);
    try {
      const { checkoutUrl } = await api.billing.checkout({
        type: 'subscription',
        gateway: 'stub',
        planId: plan.id,
      });
      navigate(checkoutUrl.replace(window.location.origin, ''));
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'Gagal memulai checkout.';
      const needLogin = err instanceof ApiRequestError && err.status === 401;
      toast({
        title: needLogin ? 'Perlu masuk' : 'Checkout gagal',
        description: needLogin ? 'Silakan masuk untuk berlangganan.' : msg,
        variant: 'danger',
      });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <Seo
        title="Pricing"
        description="Pilih paket Nesomn Studio: Free Basic, Scene Editor, Full Access, atau Enterprise. Harga sudah termasuk pajak."
      />
      <Topbar title="Pricing" />
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Harga yang sederhana dan transparan</h1>
          <p className="max-w-xl text-muted-foreground">
            Mulai gratis, tingkatkan saat Anda butuh. Semua harga sudah termasuk pajak.
          </p>
          <div className="flex items-center gap-3">
            <span className={cn('text-sm font-medium', !yearly ? 'text-foreground' : 'text-muted-foreground')}>
              Monthly
            </span>
            <Switch checked={yearly} onCheckedChange={setYearly} aria-label="Toggle harga tahunan" id="pricing-cycle-toggle" />
            <span className={cn('text-sm font-medium', yearly ? 'text-foreground' : 'text-muted-foreground')}>
              Yearly
            </span>
            <Badge variant="save">Save 17%</Badge>
          </div>
        </div>

        {plansQuery.isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-4">
            {visible.map((plan) => {
              const isFree = Number(plan.priceIdr) === 0;
              const popular = plan.code.startsWith('full_');
              return (
                <Card
                  key={plan.id}
                  className={cn('relative flex flex-col', popular && 'border-accent shadow-glow surface-glow')}
                >
                  {popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge variant="popular">Popular</Badge>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    <div className="mt-2 flex items-baseline gap-1">
                      {isFree ? (
                        <span className="text-3xl font-bold">Rp0</span>
                      ) : (
                        <>
                          <span className="font-mono text-3xl font-bold">{formatIdr(plan.priceIdr)}</span>
                          <span className="text-sm text-muted-foreground">/{yearly ? 'thn' : 'bln'}</span>
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-4">
                    <ul className="flex flex-col gap-2.5">
                      {planFeatures(plan).map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm">
                          <Check className="size-4 shrink-0 text-success" />
                          <span className="text-foreground">{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      id={`subscribe-${plan.code}`}
                      variant={popular ? 'primary' : 'secondary'}
                      className="mt-auto w-full"
                      disabled={pendingId === plan.id}
                      onClick={() => handleSubscribe(plan)}
                    >
                      {pendingId === plan.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : isFree ? (
                        'Mulai Gratis'
                      ) : (
                        'Berlangganan'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
