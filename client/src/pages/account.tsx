import { CreditCard, FolderOpen, Library, Monitor } from 'lucide-react';
import { Topbar } from '@/components/shell/topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { Seo } from '@/components/seo';

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

export default function AccountPage() {
  const credits = 320;
  const maxCredits = 500;
  const pct = Math.round((credits / maxCredits) * 100);

  return (
    <>
      <Seo
        title="Account"
        description="Dashboard akun Nesomn Studio: credit, plan, project, dan sesi."
      />
      <Topbar title="Account" />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>

        {/* Ringkasan */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                AI Credits
              </CardTitle>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-2xl font-bold">{credits}</span>
                <span className="text-sm text-muted-foreground">
                  / {maxCredits}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full bg-gradient-accent"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                Plan Aktif
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold">Full Access</span>
                <Badge variant="popular">Pro</Badge>
              </div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                Project
              </CardTitle>
              <span className="font-mono text-2xl font-bold">0</span>
            </CardHeader>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="projects">
          <TabsList>
            <TabsTrigger value="projects">My Projects</TabsTrigger>
            <TabsTrigger value="library">Asset Library</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>
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
          <TabsContent value="billing">
            <Card>
              <EmptyState
                icon={CreditCard}
                text="Belum ada riwayat pembayaran."
              />
            </Card>
          </TabsContent>
          <TabsContent value="sessions">
            <Card>
              <EmptyState
                icon={Monitor}
                text="Daftar sesi aktif akan muncul di sini."
              />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
