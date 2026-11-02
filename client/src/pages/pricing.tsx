import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import { Topbar } from '@/components/shell/topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageState } from '@/components/page-state';
import { loginUrl } from '@/lib/public-flow';
import { Switch } from '@/components/ui/switch';
import { Seo } from '@/components/seo';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { api, ApiRequestError } from '@/lib/api';
import type { PlanDTO, BillingCycle } from '@nesomn/shared';

function formatIdr(value: string | number) {
  return new Intl.NumberFormat('en-ID', {
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
  if (plan.editorAccess.proTemplates) f.push('Pro templates');
  if (plan.creditQuota > 0) f.push(`${plan.creditQuota} AI credits / cycle`);
  if (plan.commercial) f.push('Commercial licence');
  f.push(
    plan.maxConcurrentSessions
      ? `Concurrent sessions: ${plan.maxConcurrentSessions}`
      : 'Unlimited sessions',
  );
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
        gateway: 'qris',
        planId: plan.id,
      });
      navigate(checkoutUrl);
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'Unable to start checkout.';
      const needLogin = err instanceof ApiRequestError && err.status === 401;
      if (needLogin) navigate(loginUrl('/pricing'));
      toast({
        title: needLogin ? 'Login required' : 'Checkout failed',
        description: needLogin ? 'Please log in to subscribe.' : msg,
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
        description="Choose a Nesomn Studio plan: Free Basic, Scene Editor, Full Access, or Enterprise."
      />
      <Topbar title="Pricing" />
      <div className="page-wrap">
        <div className="page-heading">
          <h1 className="pricing-title">Simple, transparent pricing</h1>
          <p className="pricing-description">Start for free. Upgrade when you need more.</p>
          <div className="pricing-cycle">
            <span
              className={cn('pricing-cycle-label', !yearly ? 'pricing-text' : 'workspace-muted')}
            >
              Monthly
            </span>
            <Switch
              checked={yearly}
              onCheckedChange={setYearly}
              aria-label="Toggle yearly billing"
              id="pricing-cycle-toggle"
            />
            <span
              className={cn('pricing-cycle-label', yearly ? 'pricing-text' : 'workspace-muted')}
            >
              Yearly
            </span>
          </div>
        </div>

        {plansQuery.isError ? (
          <PageState title="Unable to load plans" retry={() => void plansQuery.refetch()} />
        ) : plansQuery.isLoading ? (
          <div className="pricing-loading">
            <Loader2 className="pricing-loading-icon" />
          </div>
        ) : !visible.length ? (
          <PageState title="No plans are available for this billing cycle" />
        ) : (
          <div className="pricing-grid">
            {visible.map((plan) => {
              const isFree = Number(plan.priceIdr) === 0;
              const popular = plan.code.startsWith('full_');
              return (
                <Card
                  key={plan.id}
                  className={cn('pricing-plan', popular && 'pricing-plan-popular')}
                >
                  <CardHeader>
                    <CardTitle className="pricing-plan-name">{plan.name}</CardTitle>
                    <div className="pricing-price">
                      {isFree ? (
                        <span className="pricing-free">Rp0</span>
                      ) : (
                        <>
                          <span className="pricing-amount">{formatIdr(plan.priceIdr)}</span>
                          <span className="workspace-description">/{yearly ? 'yr' : 'mo'}</span>
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pricing-plan-content">
                    <ul className="pricing-features">
                      {planFeatures(plan).map((f) => (
                        <li key={f} className="pricing-feature">
                          <Check className="pricing-feature-icon" />
                          <span className="pricing-text">{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      id={`subscribe-${plan.code}`}
                      variant={popular ? 'primary' : 'secondary'}
                      className="pricing-select-plan"
                      disabled={pendingId !== null}
                      onClick={() => handleSubscribe(plan)}
                    >
                      {pendingId === plan.id ? (
                        <Loader2 className="pricing-select-loading" />
                      ) : isFree ? (
                        'Start for free'
                      ) : (
                        'Subscribe'
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
