import { Elysia } from 'elysia';
import { authPlugin } from '../../middleware/auth.ts';
import { assetAdminRoutes } from './assets.routes.ts';
import { bundleAdminRoutes } from './bundles.routes.ts';
import { planAdminRoutes } from './plans.routes.ts';
import { creditPackAdminRoutes } from './credit-packs.routes.ts';
import { aiProviderAdminRoutes } from './ai-providers.routes.ts';
import { userAdminRoutes } from './users.routes.ts';
import { subscriptionAdminRoutes } from './subscriptions.routes.ts';
import { creditLedgerAdminRoutes } from './credit-ledger.routes.ts';
import { sessionAdminRoutes } from './sessions.routes.ts';
import { auditLogAdminRoutes } from './audit-logs.routes.ts';
import { uploadAdminRoutes } from './uploads.routes.ts';

/**
 * Seluruh endpoint admin di bawah prefix /admin dan guard requireAdmin.
 * Guard diterapkan di level grup sehingga setiap sub-router otomatis tertutup
 * untuk non-admin (RBAC). Data hanya lewat API ini, tidak ada akses DB langsung
 * dari panel admin.
 */
export const adminRoutes = new Elysia({ prefix: '/admin' })
  .use(authPlugin)
  .guard({ requireAdmin: true }, (app) =>
    app
      .use(assetAdminRoutes)
      .use(bundleAdminRoutes)
      .use(planAdminRoutes)
      .use(creditPackAdminRoutes)
      .use(aiProviderAdminRoutes)
      .use(userAdminRoutes)
      .use(subscriptionAdminRoutes)
      .use(creditLedgerAdminRoutes)
      .use(sessionAdminRoutes)
      .use(auditLogAdminRoutes)
      .use(uploadAdminRoutes),
  );
