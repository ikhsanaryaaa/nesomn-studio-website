import { Refine } from '@refinedev/core';
import {
  ThemedLayoutV2,
  ErrorComponent,
  useNotificationProvider,
  RefineThemes,
} from '@refinedev/antd';
import routerProvider, {
  NavigateToResource,
  CatchAllNavigate,
} from '@refinedev/react-router';
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

// Tema gelap admin: gabungkan preset biru Refine dengan algoritma dark antd.
// Token kustom menjaga kontras permukaan (sider/header) tetap nyaman dibaca.
const darkTheme = {
  ...RefineThemes.Blue,
  algorithm: theme.darkAlgorithm,
  token: {
    ...RefineThemes.Blue.token,
    colorBgLayout: '#0f1115',
    colorBgContainer: '#171a21',
    colorBgElevated: '#1f232c',
    colorBorder: '#2a2f3a',
  },
};

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <ConfigProvider theme={darkTheme}>
        <AntdApp>
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
                          src="/nesomn-logo-white.svg"
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
                <Route index element={<NavigateToResource resource="assets" />} />
                {adminRoutes}
                <Route path="*" element={<ErrorComponent />} />
              </Route>

              <Route
                element={
                  <Authenticated key="anon" fallback={<Outlet />}>
                    <NavigateToResource resource="assets" />
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
