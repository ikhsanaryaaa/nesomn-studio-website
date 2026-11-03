import { useLogin } from '@refinedev/core';
import { Button, Card, TextField, Callout } from '@radix-ui/themes';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { AdminThemeControl, useAdminTheme } from '../theme';

export function LoginPage() {
  const { mutate, isLoading } = useLogin();
  const dark = useAdminTheme();
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError('');
    mutate(
      { email: data.get('email'), password: data.get('password') },
      {
        onSuccess: (result) => {
          if (!result.success) setError(result.error?.message ?? 'Unable to sign in.');
        },
        onError: () => setError('Unable to connect. Please try again.'),
      },
    );
  }
  return (
    <div className="admin-login">
      <header>
        <a href={import.meta.env.VITE_SHOP_URL || '/'}>
          <img
            className="brand-logo"
            src={import.meta.env.BASE_URL + 'nesomn-logo-' + (dark ? 'white' : 'black') + '.svg'}
            alt="Nesomn Studio"
          />
        </a>
        <AdminThemeControl />
      </header>
      <main id="admin-content" className="admin-login-main">
        <div className="admin-login-intro">
          <span className="admin-eyebrow">Nesomn administration</span>
          <h1>
            A clear view.
            <br />
            <span>More control.</span>
          </h1>
          <p>Manage your catalogue, creative tools, and studio operations from one workspace.</p>
          <div className="admin-login-security">
            <ShieldCheck size={20} />
            <span>Restricted to authorised administrators.</span>
          </div>
        </div>
        <Card className="admin-login-card">
          <span className="admin-eyebrow">Welcome back</span>
          <h2>Sign in to your workspace</h2>
          <p>Use your administrator account to continue.</p>
          <form onSubmit={submit}>
            {error && (
              <Callout.Root color="red" role="alert">
                <Callout.Text>{error}</Callout.Text>
              </Callout.Root>
            )}
            <label htmlFor="admin-email">Email address</label>
            <TextField.Root
              id="admin-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              size="3"
              placeholder="you@studio.com"
            />
            <label htmlFor="admin-password">Password</label>
            <TextField.Root
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              size="3"
              placeholder="Enter your password"
            />
            <Button size="3" type="submit" loading={isLoading}>
              Sign in <ArrowRight size={18} />
            </Button>
          </form>
          <small>Need access? Contact your studio administrator.</small>
        </Card>
      </main>
      <footer>Nesomn Studio · Administration</footer>
    </div>
  );
}
