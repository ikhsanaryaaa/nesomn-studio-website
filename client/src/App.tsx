import { Routes, Route } from 'react-router';
import { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from '@/components/shell/app-layout';
import { Toaster } from '@/components/ui/toaster';
import { queryClient } from '@/lib/query';
import HomePage from '@/pages/home';
import PricingPage from '@/pages/pricing';
import MarketplacePage from '@/pages/marketplace';
import AssetDetailPage from '@/pages/asset-detail';
import BundleBuilderPage from '@/pages/bundle-builder';
import LibraryPage from '@/pages/library';
import AccountPage from '@/pages/account';
import CheckoutPage from '@/pages/checkout';
import NotFoundPage from '@/pages/not-found';

// Editor berat (Konva/R3F) di-lazy-load agar tidak masuk bundle prerender publik.
const SceneEditorPage = lazy(() => import('@/pages/scene-editor'));
const Editor3DPage = lazy(() => import('@/pages/editor-3d'));
const ProjectsPage = lazy(() => import('@/pages/projects'));

/** Fallback ringan saat chunk editor sedang dimuat. */
function EditorFallback() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Memuat editor...
    </div>
  );
}

/**
 * Root aplikasi: providers global (TanStack Query) + route tree.
 *
 * Catatan: halaman di-import eager (bukan React.lazy) agar kompatibel
 * dengan prerender sinkron (renderToString). Code-split untuk editor
 * berat (Konva/R3F) dipasang di M5/M6.
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="marketplace" element={<MarketplacePage />} />
          <Route path="marketplace/:slug" element={<AssetDetailPage />} />
          <Route path="bundle-builder" element={<BundleBuilderPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route
            path="editor/scene"
            element={
              <Suspense fallback={<EditorFallback />}>
                <SceneEditorPage />
              </Suspense>
            }
          />
          <Route
            path="editor/scene/:slug"
            element={
              <Suspense fallback={<EditorFallback />}>
                <SceneEditorPage />
              </Suspense>
            }
          />
          <Route
            path="editor/3d"
            element={
              <Suspense fallback={<EditorFallback />}>
                <Editor3DPage />
              </Suspense>
            }
          />
          <Route
            path="editor/3d/:slug"
            element={
              <Suspense fallback={<EditorFallback />}>
                <Editor3DPage />
              </Suspense>
            }
          />
          <Route
            path="editor/projects"
            element={
              <Suspense fallback={<EditorFallback />}>
                <ProjectsPage />
              </Suspense>
            }
          />
          <Route path="account" element={<AccountPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <Toaster />
    </QueryClientProvider>
  );
}
