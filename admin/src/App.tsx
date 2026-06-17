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
import { ConfigProvider, App as AntdApp } from 'antd';
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

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <ConfigProvider theme={RefineThemes.Blue}>
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
                    <ThemedLayoutV2 Title={() => <strong>Nesomn Admin</strong>}>
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
