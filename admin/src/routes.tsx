import { Route } from 'react-router';

import { AssetList, AssetCreate, AssetEdit, AssetShow } from './pages/assets.tsx';
import { BundleList, BundleCreate, BundleEdit, BundleShow } from './pages/bundles.tsx';
import { PlanList, PlanCreate, PlanEdit } from './pages/plans.tsx';
import { CreditPackList, CreditPackCreate, CreditPackEdit } from './pages/credit-packs.tsx';
import { UserList, UserShow } from './pages/users.tsx';
import { ProviderList, ProviderCreate, ProviderEdit } from './pages/ai-providers.tsx';
import { UsageList } from './pages/usage.tsx';
import { SessionList } from './pages/sessions.tsx';
import { AuditLogList } from './pages/audit-logs.tsx';

/**
 * Rute resource admin. Dipasang di dalam layout terproteksi di App.tsx.
 * Path selaras dengan definisi resource di resources.tsx.
 */
export const adminRoutes = (
  <>
    {/* Assets Mockup (mockup2d) -> Scene Editor */}
    <Route path="/assets-mockup">
      <Route index element={<AssetList types={['mockup2d']} title="Assets Mockup" />} />
      <Route path="create" element={<AssetCreate allowedTypes={['mockup2d']} />} />
      <Route path="edit/:id" element={<AssetEdit allowedTypes={['mockup2d']} />} />
      <Route path="show/:id" element={<AssetShow />} />
    </Route>

    {/* Assets 3D (mockup3d, asset3d) -> 3D Editor */}
    <Route path="/assets-3d">
      <Route index element={<AssetList types={['mockup3d', 'asset3d']} title="Assets 3D" />} />
      <Route path="create" element={<AssetCreate allowedTypes={['mockup3d', 'asset3d']} />} />
      <Route path="edit/:id" element={<AssetEdit allowedTypes={['mockup3d', 'asset3d']} />} />
      <Route path="show/:id" element={<AssetShow />} />
    </Route>

    {/* Assets (font, graphic, motion) -> Marketplace */}
    <Route path="/assets">
      <Route
        index
        element={<AssetList types={['font', 'graphic', 'motion']} title="Assets (Marketplace)" />}
      />
      <Route path="create" element={<AssetCreate allowedTypes={['font', 'graphic', 'motion']} />} />
      <Route path="edit/:id" element={<AssetEdit allowedTypes={['font', 'graphic', 'motion']} />} />
      <Route path="show/:id" element={<AssetShow />} />
    </Route>

    <Route path="/bundles">
      <Route index element={<BundleList />} />
      <Route path="create" element={<BundleCreate />} />
      <Route path="edit/:id" element={<BundleEdit />} />
      <Route path="show/:id" element={<BundleShow />} />
    </Route>

    <Route path="/plans">
      <Route index element={<PlanList />} />
      <Route path="create" element={<PlanCreate />} />
      <Route path="edit/:id" element={<PlanEdit />} />
    </Route>

    <Route path="/credit-packs">
      <Route index element={<CreditPackList />} />
      <Route path="create" element={<CreditPackCreate />} />
      <Route path="edit/:id" element={<CreditPackEdit />} />
    </Route>

    <Route path="/users">
      <Route index element={<UserList />} />
      <Route path="show/:id" element={<UserShow />} />
    </Route>

    <Route path="/ai-providers">
      <Route index element={<ProviderList />} />
      <Route path="create" element={<ProviderCreate />} />
      <Route path="edit/:id" element={<ProviderEdit />} />
    </Route>

    <Route path="/usage" element={<UsageList />} />
    <Route path="/sessions" element={<SessionList />} />
    <Route path="/audit-logs" element={<AuditLogList />} />
  </>
);
