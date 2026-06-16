import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Topbar } from '@/components/shell/topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Seo } from '@/components/seo';
import { cn } from '@/lib/utils';

interface PlanFeature {
  label: string;
  included: boolean;
}

interface Plan {
  name: string;
  priceMonthly: number;
  priceYearly: number;
  popular?: boolean;
  features: PlanFeature[];
}

const PLANS: Plan[] = [
  {
    name: 'Free Basic',
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      { label: 'Scene Editor (terbatas)', included: true },
      { label: 'Export 1080p', included: true },
      { label: 'AI credits bulanan', included: false },
      { label: 'Lisensi komersial', included: false },
    ],
  },
  {
    name: 'Scene Editor',
    priceMonthly: 149000,
    priceYearly: 1490000,
    features: [
      { label: 'Scene Editor penuh', included: true },
      { label: '500 AI credits / bulan', included: true },
      { label: 'Lisensi komersial', included: true },
      { label: '3D Editor', included: false },
    ],
  },
  {
    name: 'Full Access',
    priceMonthly: 299000,
    priceYearly: 2990000,
    popular: true,
    features: [
      { label: 'Scene + 3D Editor', included: true },
      { label: '500 AI credits / bulan', included: true },
      { label: 'Lisensi komersial', included: true },
      { label: 'Priority AI queue', included: true },
    ],
  },
  {
    name: 'Enterprise',
    priceMonthly: -1,
    priceYearly: -1,
    features: [
      { label: 'Semua fitur Full Access', included: true },
      { label: 'Sesi tak terbatas', included: true },
      { label: 'Dedicated support', included: true },
      { label: 'Custom integration', included: true },
    ],
  },
];

function formatIdr(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);

  return (
    <>
      <Seo
        title="Pricing"
        description="Pilih paket Nesomn Studio: Free Basic, Scene Editor, Full Access, atau Enterprise. Harga sudah termasuk pajak."
      />
      <Topbar title="Pricing" />
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Harga yang sederhana dan transparan
          </h1>
          <p className="max-w-xl text-muted-foreground">
            Mulai gratis, tingkatkan saat Anda butuh. Semua harga sudah
            termasuk pajak.
          </p>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'text-sm font-medium',
                !yearly ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              Monthly
            </span>
            <Switch
              checked={yearly}
              onCheckedChange={setYearly}
              aria-label="Toggle harga tahunan"
              id="pricing-cycle-toggle"
            />
            <span
              className={cn(
                'text-sm font-medium',
                yearly ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              Yearly
            </span>
            <Badge variant="save">Save 17%</Badge>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const price = yearly ? plan.priceYearly : plan.priceMonthly;
            const isEnterprise = price < 0;
            const isFree = price === 0;
            return (
              <Card
                key={plan.name}
                className={cn(
                  'relative flex flex-col',
                  plan.popular &&
                    'border-accent shadow-glow surface-glow',
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="popular">Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <div className="mt-2 flex items-baseline gap-1">
                    {isEnterprise ? (
                      <span className="text-2xl font-bold">Custom</span>
                    ) : isFree ? (
                      <span className="text-3xl font-bold">Rp0</span>
                    ) : (
                      <>
                        <span className="font-mono text-3xl font-bold">
                          {formatIdr(price)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          /{yearly ? 'thn' : 'bln'}
                        </span>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <ul className="flex flex-col gap-2.5">
                    {plan.features.map((f) => (
                      <li
                        key={f.label}
                        className="flex items-center gap-2 text-sm"
                      >
                        {f.included ? (
                          <Check className="size-4 shrink-0 text-success" />
                        ) : (
                          <X className="size-4 shrink-0 text-faint-foreground" />
                        )}
                        <span
                          className={
                            f.included
                              ? 'text-foreground'
                              : 'text-faint-foreground'
                          }
                        >
                          {f.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={plan.popular ? 'primary' : 'secondary'}
                    className="mt-auto w-full"
                  >
                    {isEnterprise ? 'Contact Sales' : 'Get Started'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
