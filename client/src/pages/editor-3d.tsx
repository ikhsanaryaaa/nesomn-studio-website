import { useState } from 'react';
import { Box, Camera, Video } from 'lucide-react';
import { Topbar } from '@/components/shell/topbar';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Seo } from '@/components/seo';

export default function Editor3DPage() {
  const [grain, setGrain] = useState([20]);

  return (
    <>
      <Seo
        title="3D Editor"
        description="Editor mockup 3D berbasis browser di Nesomn Studio."
      />
      <Topbar
        title="3D Editor"
        right={
          <>
            <Button size="sm" variant="secondary">
              <Camera />
              Render Image
            </Button>
            <Button size="sm">
              <Video />
              Render Video
            </Button>
          </>
        }
      />
      <div className="flex h-[calc(100%-3.5rem)]">
        {/* Viewport placeholder */}
        <div className="flex flex-1 items-center justify-center bg-background">
          <div className="flex max-w-md flex-col items-center gap-4 text-center">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-surface-2">
              <Box className="size-7 text-muted-foreground" />
            </span>
            <h1 className="text-xl font-semibold">Viewport 3D</h1>
            <p className="text-sm text-muted-foreground">
              React Three Fiber viewport akan tampil di sini. Render fungsional
              menyusul di milestone berikutnya.
            </p>
          </div>
        </div>

        {/* Panel kontrol */}
        <aside className="w-72 shrink-0 border-l border-border bg-surface p-4">
          <h2 className="mb-4 text-sm font-semibold">Controls</h2>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="text-[13px] text-muted-foreground">
                Background
              </span>
              <div className="flex gap-2">
                {['bg-background', 'bg-surface-2', 'bg-white', 'bg-accent'].map(
                  (c) => (
                    <button
                      key={c}
                      className={`size-7 rounded-md border border-border ${c}`}
                      aria-label={`Pilih warna ${c}`}
                    />
                  ),
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">
                  Grain
                </span>
                <span className="font-mono text-xs text-foreground">
                  {grain[0]}
                </span>
              </div>
              <Slider
                value={grain}
                onValueChange={setGrain}
                max={100}
                step={1}
              />
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
