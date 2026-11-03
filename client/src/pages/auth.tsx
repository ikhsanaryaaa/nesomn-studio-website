import { apiUrl } from '@/lib/site-config';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { setEditorIdentity } from '@/lib/editor-session';
import { api } from '@/lib/api';
import { safeReturnTo } from '@/lib/public-flow';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Seo } from '@/components/seo';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import './auth.css';

export default function AuthPage({ register = false }: { register?: boolean }) {
  const [params] = useSearchParams(),
    navigate = useNavigate(),
    qc = useQueryClient();
  const [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const returnTo = safeReturnTo(params.get('returnTo'));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError('');
    try {
      const payload = {
        email: String(data.get('email')),
        password: String(data.get('password')),
        name: String(data.get('name') ?? ''),
      };
      const user = await (register ? api.register(payload) : api.login(payload));
      setEditorIdentity(user.id);
      qc.clear();
      qc.setQueryData(['me'], user);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log in. Please try again.');
    } finally {
      setPending(false);
    }
  }
  async function google() {
    if (pending) return;
    setPending(true);
    setError('');
    const url = apiUrl('/auth/google?returnTo=') + encodeURIComponent(returnTo);
    try {
      const response = await fetch(url, { credentials: 'include', redirect: 'manual' });
      if (response.type === 'opaqueredirect') {
        window.location.assign(url);
        return;
      }
      const body = await response.json();
      throw Error(body?.error?.message ?? 'Google login is unavailable. Use email or try again.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google login is unavailable.');
      setPending(false);
    }
  }
  return (
    <div className="auth-screen">
      <Seo title={register ? 'Sign up' : 'Log in'} />
      <div className="auth-studio-frame">
        <section className="auth-studio-intro">
          <Link to="/" className="auth-brand" aria-label="Nesomn Studio home">
            <img src="/nesomn-logo-black.svg" alt="" className="brand-logo brand-logo-light" />
            <img src="/nesomn-logo-white.svg" alt="" className="brand-logo brand-logo-dark" />
            <span>Nesomn Studio</span>
          </Link>
          <div className="auth-intro-copy">
            <h1>
              {register ? 'Make room for your ideas.' : 'Welcome back to your creative workspace.'}
            </h1>
            <p>Your scenes, assets, and projects. One workspace.</p>
            <Link className="auth-explore" to="/marketplace">
              Explore assets first
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <div className="auth-brand-art" aria-hidden="true">
            <img src="/nesomn-logo-black.svg" alt="" className="brand-logo-light" />
            <img src="/nesomn-logo-white.svg" alt="" className="brand-logo-dark" />
          </div>
        </section>
        <section className="auth-studio-form" aria-label={register ? 'Sign up' : 'Log in'}>
          <div className="auth-form-content">
            <h2>{register ? 'Create an account' : 'Log in to Nesomn'}</h2>
            <p className="auth-form-description">
              {register
                ? 'Create an account to start creating in your workspace.'
                : 'Log in to continue your work.'}
            </p>
            <form onSubmit={(e) => void submit(e)} className="auth-fields">
              {register && (
                <Input label="Name" name="name" autoComplete="name" required maxLength={120} />
              )}
              <Input
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
              />
              <Input
                label="Password"
                name="password"
                type="password"
                autoComplete={register ? 'new-password' : 'current-password'}
                required
                minLength={register ? 8 : 1}
                maxLength={1024}
              />
              {register && (
                <p className="workspace-description">
                  Your password must contain at least 8 characters.
                </p>
              )}
              {error && (
                <p role="alert" className="workspace-error">
                  {error}
                </p>
              )}
              <Button disabled={pending} type="submit">
                {pending ? 'Processing…' : register ? 'Create account' : 'Log in'}
                <ArrowRight aria-hidden="true" />
              </Button>
              <div className="auth-divider">
                <span>or</span>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => void google()}
              >
                Continue with Google
              </Button>
            </form>
            <p className="auth-switch">
              {register ? 'Already have an account?' : "Don't have an account?"}{' '}
              <Link
                className="workspace-link"
                to={
                  (register ? '/login' : '/register') + '?returnTo=' + encodeURIComponent(returnTo)
                }
              >
                {register ? 'Log in' : 'Sign up'}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
