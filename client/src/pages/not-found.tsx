import { Link } from 'react-router';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Seo } from '@/components/seo';

export default function NotFoundPage() {
  return (
    <>
      <Seo title="404 - Halaman tidak ditemukan" />
      <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
        <span className="text-gradient-accent text-7xl font-bold tracking-tight">
          404
        </span>
        <h1 className="text-2xl font-semibold">Halaman tidak ditemukan</h1>
        <p className="max-w-sm text-muted-foreground">
          Halaman yang Anda cari mungkin telah dipindahkan atau tidak pernah
          ada.
        </p>
        <Button asChild>
          <Link to="/">
            <Home />
            Kembali ke Beranda
          </Link>
        </Button>
      </div>
    </>
  );
}
