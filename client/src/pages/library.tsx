import { useQuery } from '@tanstack/react-query';
import { Topbar } from '@/components/shell/topbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Seo } from '@/components/seo';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';

export default function LibraryPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: items, isLoading } = useQuery({
    queryKey: ['library'],
    queryFn: () => api.library(),
    enabled: isAuthenticated,
  });

  const download = async (id: string) => {
    try {
      const { url } = await api.downloadUrl(id);
      window.open(url, '_blank');
    } catch {
      toast({ title: 'Gagal membuat tautan download', variant: 'danger' });
    }
  };

  return (
    <>
      <Seo title="Asset Library" description="Aset yang Anda miliki di Nesomn Studio." />
      <Topbar title="Asset Library" />
      <div className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Asset Library</h1>

        {!authLoading && !isAuthenticated ? (
          <p className="text-sm text-muted-foreground">Login untuk melihat aset Anda.</p>
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5] w-full" />
            ))}
          </div>
        ) : items && items.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <div className="aspect-[4/5] bg-surface-2">
                  {item.previews[0] && (
                    <img src={item.previews[0]} alt={item.title} className="h-full w-full object-cover" />
                  )}
                </div>
                <CardContent className="flex flex-col gap-2 p-3">
                  <span className="truncate text-[13px] font-medium">{item.title}</span>
                  <Button size="sm" variant="secondary" onClick={() => download(item.id)}>
                    Download
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Belum ada aset. Klaim aset gratis atau beli dari Marketplace.
          </p>
        )}
      </div>
    </>
  );
}
