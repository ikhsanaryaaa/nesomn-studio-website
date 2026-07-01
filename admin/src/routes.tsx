import { Route } from 'react-router';

import {
  Asset3dList,
  Asset3dCreate,
  Asset3dEdit,
  Asset3dShow,
} from './pages/assets-3d.tsx';
import {
  AssetSceneList,
  AssetSceneCreate,
  AssetSceneEdit,
  AssetSceneShow,
} from './pages/assets-scene.tsx';
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
    {/* Assets 3D (product_3d_editor): resource & CRUD terpisah. */}
    <Route path="/assets-3d">
      <Route index element={<Asset3dList />} />
      <Route path="create" element={<Asset3dCreate />} />
      <Route path="edit/:id" element={<Asset3dEdit />} />
      <Route path="show/:id" element={<Asset3dShow />} />
    </Route>

    {/* Assets Scene (scene_editor): resource & CRUD terpisah. */}
    <Route path="/assets">
      <Route index element={<AssetSceneList />} />
      <Route path="create" element={<AssetSceneCreate />} />
      <Route path="edit/:id" element={<AssetSceneEdit />} />
      <Route path="show/:id" element={<AssetSceneShow />} />
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
