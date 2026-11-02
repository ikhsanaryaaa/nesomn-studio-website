import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Layers, Box, Trash2, Plus } from 'lucide-react';
import { Topbar } from '@/components/shell/topbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Seo } from '@/components/seo';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';
import type { ProjectKind } from '@nesomn/shared';
import { AuthGate, PageState } from '@/components/page-state';

/** Daftar project (scene 2D/3D) milik user: buka kembali atau hapus. */
export default function ProjectsPage() {
  return (
    <AuthGate>
      <ProjectsContent />
    </AuthGate>
  );
}
function ProjectsContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [kind, setKind] = useState<ProjectKind>('scene2d');

  const editorPath = kind === 'scene3d' ? '/editor/3d' : '/editor/scene';

  const {
    data: projects,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['projects', kind],
    queryFn: () => api.projects.list(kind),
    enabled: isAuthenticated,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.projects.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', kind] });
      toast({ title: 'Project deleted' });
    },
    onError: () => toast({ title: 'Unable to delete project', variant: 'danger' }),
  });

  return (
    <>
      <Seo title="My Projects" description="Your saved scenes in Nesomn Studio." />
      <Topbar
        title="My Projects"
        right={
          <Button asChild size="sm">
            <Link to={editorPath}>
              <Plus className="workspace-action-icon" />
              {kind === 'scene3d' ? 'New 3D scene' : 'New scene'}
            </Link>
          </Button>
        }
      />
      <div className="page-wrap">
        <div className="projects-heading">
          <h1 className="projects-title">My Projects</h1>
          <Tabs value={kind} onValueChange={(v) => setKind(v as ProjectKind)}>
            <TabsList>
              <TabsTrigger value="scene2d">2D</TabsTrigger>
              <TabsTrigger value="scene3d">3D</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {!authLoading && !isAuthenticated ? (
          <p className="workspace-description">Log in to view your projects.</p>
        ) : isError ? (
          <PageState title="Unable to load projects" retry={() => void refetch()} />
        ) : isLoading ? (
          <div className="projects-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="projects-placeholder" />
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="projects-grid">
            {projects.map((p) => (
              <Card key={p.id} className="project-card">
                <Link to={`${editorPath}?project=${p.id}`} className="project-open">
                  {kind === 'scene3d' ? (
                    <Box className="workspace-project-icon" />
                  ) : (
                    <Layers className="workspace-project-icon" />
                  )}
                </Link>
                <CardContent className="project-caption">
                  <span className="project-name">{p.title}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Delete"
                    aria-label={'Remove ' + p.title}
                    onClick={() => {
                      if (window.confirm('Delete this project? This action cannot be undone.'))
                        remove.mutate(p.id);
                    }}
                    disabled={remove.isPending}
                  >
                    <Trash2 className="workspace-action-icon" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="projects-empty">
            <p className="workspace-description">No saved projects yet.</p>
            <Button asChild variant="secondary">
              <Link to={editorPath}>
                <Plus className="workspace-action-icon" />
                {kind === 'scene3d' ? 'Create your first 3D scene' : 'Create your first scene'}
              </Link>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
