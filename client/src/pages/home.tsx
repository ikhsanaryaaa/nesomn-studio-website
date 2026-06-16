import { Link } from 'react-router';
import { ArrowRight, Sparkles, Box, Layers, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Seo } from '@/components/seo';

const FEATURES = [
  {
    icon: Layers,
    title: 'Scene Editor 2D',
    desc: 'Susun mockup, atur layer, ganti warna, dan ekspor desain langsung dari browser.',
  },
  {
    icon: Box,
    title: '3D Editor',
    desc: 'Kustomisasi mockup produk 3D, atur material, kamera, dan render image atau video.',
  },
  {
    icon: Wand2,
    title: 'AI-powered',
    desc: 'Generate scene dan motion dengan AI. Cukup deskripsikan, biarkan studio yang bekerja.',
  },
];

export default function HomePage() {
  return (
    <>
      <Seo title="Nesomn Studio" />

      {/* Hero */}
      <section className="surface-glow relative overflow-hidden">
        <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 py-24 text-center">
          <Badge variant="beta">Browser-based. No software needed.</Badge>
          <h1 className="max-w-3xl text-5xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
            Design the mockup.{' '}
            <span className="text-gradient-accent">Build the scene</span> with
            AI.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Nesomn Studio menyatukan editor 2D, 3D, dan generasi AI dalam satu
            ruang kerja kreatif yang cepat dan elegan.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/editor/scene">
                Mulai Berkarya
                <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link to="/pricing">
                <Sparkles />
                Lihat Harga
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-5 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <Card key={title} interactive>
              <CardContent className="flex flex-col gap-3 p-6">
                <span className="flex size-11 items-center justify-center rounded-lg bg-accent-subtle">
                  <Icon className="size-5 text-accent" />
                </span>
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
