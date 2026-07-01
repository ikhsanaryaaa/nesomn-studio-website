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

// Tema gelap admin selaras DESIGN.md (dark studio, satu aksen biru-indigo).
// Token dipetakan dari palet DESIGN.md §2 ke token Ant Design + darkAlgorithm.
// Sidebar (sider) tidak direstrukturisasi; hanya ikut warna surface agar konsisten.
const darkTheme = {
  ...RefineThemes.Blue,
  algorithm: theme.darkAlgorithm,
  token: {
    ...RefineThemes.Blue.token,
    // Warna dasar (DESIGN.md §2.1)
    colorBgLayout: '#0b0b0d', // --background
    colorBgContainer: '#161618', // --surface
    colorBgElevated: '#1e1e21', // --surface-2
    colorBorder: '#2d2d30', // --border
    colorBorderSecondary: '#232326',
    colorText: '#fafafa', // --foreground
    colorTextSecondary: '#94949b', // --muted-foreground
    colorTextTertiary: '#62626a', // --faint-foreground
    // Aksen brand (DESIGN.md §2.2)
    colorPrimary: '#3b5bff', // --accent
    colorLink: '#3b5bff',
    colorLinkHover: '#566fff',
    // Semantic (DESIGN.md §2.3)
    colorSuccess: '#22c55e',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#38bdf8',
    // Radius & tipografi (DESIGN.md §3-4)
    borderRadius: 10,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontSize: 14,
    controlHeight: 38,
  },
  components: {
    Layout: {
      siderBg: '#161618',
      headerBg: '#0b0b0d',
      bodyBg: '#0b0b0d',
      triggerBg: '#1e1e21',
    },
    Menu: {
      itemBg: 'transparent',
      subMenuItemBg: 'transparent',
      itemSelectedBg: '#1a1f3d', // --accent-subtle
      itemSelectedColor: '#fafafa',
      itemHoverBg: '#1e1e21', // --surface-2
      itemBorderRadius: 8,
    },
    Table: {
      headerBg: '#161618',
      headerColor: '#94949b',
      rowHoverBg: '#1e1e21',
      borderColor: '#2d2d30',
      colorBgContainer: '#131315',
    },
    Card: {
      colorBgContainer: '#161618',
      colorBorderSecondary: '#2d2d30',
      borderRadiusLG: 14,
    },
    Button: {
      borderRadius: 10,
      controlHeight: 38,
      primaryShadow: 'none',
      defaultBg: '#1e1e21',
      defaultBorderColor: '#2d2d30',
    },
    Input: {
      colorBgContainer: '#1e1e21',
      activeBorderColor: '#3b5bff',
      hoverBorderColor: '#414145',
      borderRadius: 10,
    },
    InputNumber: {
      colorBgContainer: '#1e1e21',
      activeBorderColor: '#3b5bff',
      borderRadius: 10,
    },
    Select: {
      colorBgContainer: '#1e1e21',
      colorBgElevated: '#28282b', // --surface-3 (dropdown)
      optionSelectedBg: '#1a1f3d',
      borderRadius: 10,
    },
    Modal: {
      contentBg: '#1e1e21',
      headerBg: '#1e1e21',
      borderRadiusLG: 20,
    },
    Tag: {
      borderRadiusSM: 6,
    },
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
