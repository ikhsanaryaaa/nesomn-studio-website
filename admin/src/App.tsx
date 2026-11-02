import { Refine } from '@refinedev/core';
import { ThemedLayoutV2, ErrorComponent, useNotificationProvider } from '@refinedev/antd';
import routerProvider, { NavigateToResource, CatchAllNavigate } from '@refinedev/react-router';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router';
import { ConfigProvider, App as AntdApp, theme } from 'antd';
import {
  DatabaseOutlined,
  AppstoreOutlined,
  CreditCardOutlined,
  GiftOutlined,
  TeamOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  DesktopOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';

import '@refinedev/antd/dist/reset.css';

import { dataProvider } from './providers/dataProvider.ts';
import { authProvider } from './providers/authProvider.ts';
import { LoginPage } from './pages/login.tsx';
import { Authenticated } from './components/authenticated.tsx';
import { resources } from './resources.tsx';
import { adminRoutes } from './routes.tsx';

import { useAdminTheme, AdminThemeControl } from './theme';

export default function App() {
  const dark = useAdminTheme();
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim();
  const studioTheme = {
    algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: token('--color-accent'),
      colorInfo: token('--color-accent'),
      colorBgLayout: token('--color-background'),
      colorBgContainer: token('--color-surface'),
      colorBgElevated: token('--color-surface-2'),
      colorText: token('--color-foreground'),
      colorTextSecondary: token('--color-muted-foreground'),
      colorTextPlaceholder: token('--color-faint-foreground'),
      colorPrimaryText: token('--color-accent'),
      colorError: token('--color-danger'),
      colorWarning: token('--color-warning'),
      colorSuccess: token('--color-success'),
      colorBorder: token('--color-border'),
      fontFamily: token('--font-sans'),
      borderRadius: 10,
      controlHeight: 44,
    },
    components: { Button: { primaryColor: token('--color-accent-foreground') } },
  };
  return (
    <BrowserRouter basename="/admin">
      <ConfigProvider theme={studioTheme}>
        <AntdApp>
          <div className="admin-theme-bar">
            <a href="/" aria-label="Nesomn Studio beranda">
              <img
                className="brand-logo"
                alt="Nesomn Studio"
                src={dark ? '/admin/nesomn-logo-white.svg' : '/admin/nesomn-logo-black.svg'}
              />
            </a>
            <AdminThemeControl />
          </div>
          <Refine
            dataProvider={dataProvider}
            authProvider={authProvider}
            routerProvider={routerProvider}
            notificationProvider={useNotificationProvider}
            resources={resources}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: true,
              disableTelemetry: true,
            }}
          >
            <Routes>
              <Route
                element={
                  <Authenticated key="auth">
                    <ThemedLayoutV2
                      initialSiderCollapsed={false}
                      Title={({ collapsed }) => (
                        <img
                          src={
                            dark ? '/admin/nesomn-logo-white.svg' : '/admin/nesomn-logo-black.svg'
                          }
                          alt="Nesomn"
                          style={{
                            height: 28,
                            width: collapsed ? 28 : 'auto',
                            objectFit: 'contain',
                          }}
                        />
                      )}
                    >
                      <Outlet />
                    </ThemedLayoutV2>
                  </Authenticated>
                }
              >
                <Route index element={<NavigateToResource resource="assets-scene" />} />
                {adminRoutes}
                <Route path="*" element={<ErrorComponent />} />
              </Route>

              <Route
                element={
                  <Authenticated key="anon" fallback={<Outlet />}>
                    <NavigateToResource resource="assets-scene" />
                  </Authenticated>
                }
              >
                <Route path="/login" element={<LoginPage />} />
              </Route>

              <Route path="*" element={<CatchAllNavigate to="/login" />} />
            </Routes>
          </Refine>
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  );
}

// Ikon di-reekspor agar resources.tsx ringkas (dipakai juga di sana).
export const icons = {
  DatabaseOutlined,
  AppstoreOutlined,
  CreditCardOutlined,
  GiftOutlined,
  TeamOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  DesktopOutlined,
  FileSearchOutlined,
};
