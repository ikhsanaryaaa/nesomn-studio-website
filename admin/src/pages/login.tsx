import { AuthPage } from '@refinedev/antd';

/**
 * Halaman login admin memakai komponen AuthPage bawaan Refine/antd,
 * terhubung ke authProvider (POST /api/auth/login). Registrasi & lupa
 * password disembunyikan: akun admin dibuat lewat seed M1.
 */
export const LoginPage = () => (
  <AuthPage
    type="login"
    registerLink={false}
    forgotPasswordLink={false}
    rememberMe={false}
    title="Nesomn Studio Admin"
  />
);
