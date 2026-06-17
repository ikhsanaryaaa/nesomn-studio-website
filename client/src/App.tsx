import { Routes, Route } from 'react-router';
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
import SceneEditorPage from '@/pages/scene-editor';
import Editor3DPage from '@/pages/editor-3d';
import AccountPage from '@/pages/account';
import NotFoundPage from '@/pages/not-found';

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
          <Route path="editor/scene" element={<SceneEditorPage />} />
          <Route path="editor/3d" element={<Editor3DPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <Toaster />
    </QueryClientProvider>
  );
}
