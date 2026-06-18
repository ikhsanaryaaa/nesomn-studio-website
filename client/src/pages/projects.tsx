import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Layers, Trash2, Plus } from 'lucide-react';
import { Topbar } from '@/components/shell/topbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Seo } from '@/components/seo';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';

/** Daftar project (scene) milik user: buka kembali atau hapus. */
export default function ProjectsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', 'scene2d'],
    queryFn: () => api.projects.list('scene2d'),
    enabled: isAuthenticated,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.projects.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', 'scene2d'] });
      toast({ title: 'Project dihapus' });
    },
    onError: () => toast({ title: 'Gagal menghapus project', variant: 'danger' }),
  });

  return (
    <>
      <Seo title="My Projects" description="Scene 2D tersimpan milik Anda di Nesomn Studio." />
      <Topbar
        title="My Projects"
        right={
          <Button asChild size="sm">
            <Link to="/editor/scene">
              <Plus className="size-4" />
              Scene baru
            </Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">My Projects</h1>

        {!authLoading && !isAuthenticated ? (
          <p className="text-sm text-muted-foreground">Login untuk melihat project Anda.</p>
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] w-full" />
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {projects.map((p) => (
              <Card key={p.id} className="overflow-hidden">
                <Link
                  to={`/editor/scene?project=${p.id}`}
                  className="flex aspect-[4/3] items-center justify-center bg-surface-2 transition-colors hover:bg-surface-3"
                >
                  <Layers className="size-8 text-muted-foreground" />
                </Link>
                <CardContent className="flex items-center justify-between gap-2 p-3">
                  <span className="truncate text-[13px] font-medium">{p.title}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Hapus"
                    onClick={() => remove.mutate(p.id)}
                    disabled={remove.isPending}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">Belum ada project tersimpan.</p>
            <Button asChild variant="secondary">
              <Link to="/editor/scene">
                <Plus className="size-4" />
                Buat scene pertama
              </Link>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
