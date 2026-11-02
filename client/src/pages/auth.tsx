import { useState, type FormEvent } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { setEditorIdentity } from '@/lib/editor-session';
import { api } from '@/lib/api';
import { safeReturnTo } from '@/lib/public-flow';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Seo } from '@/components/seo';

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
      setError(err instanceof Error ? err.message : 'Login belum berhasil. Silakan coba lagi.');
    } finally {
      setPending(false);
    }
  }
  async function google() {
    if (pending) return;
    setPending(true);
    setError('');
    const url = '/api/auth/google?returnTo=' + encodeURIComponent(returnTo);
    try {
      const response = await fetch(url, { credentials: 'include', redirect: 'manual' });
      if (response.type === 'opaqueredirect') {
        window.location.assign(url);
        return;
      }
      const body = await response.json();
      throw Error(
        body?.error?.message ?? 'Google login belum tersedia. Gunakan email atau coba lagi.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google login belum tersedia.');
      setPending(false);
    }
  }
  return (
    <div className="auth-layout page-wrap">
      <Seo title={register ? 'Register' : 'Login'} />
      <section className="auth-intro">
        <h1>{register ? 'Buat ruang untuk ide Anda.' : 'Kembali ke ruang kreatif Anda.'}</h1>
        <p>Scene, aset, dan project Anda. Dalam satu workspace.</p>
        <Link className="text-accent underline" to="/marketplace">
          Jelajahi aset terlebih dahulu
        </Link>
      </section>
      <section className="auth-form">
        <h2>{register ? 'Daftar akun' : 'Login ke Nesomn'}</h2>
        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5">
          {register && (
            <Input label="Nama" name="name" autoComplete="name" required maxLength={120} />
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
            <p className="text-sm text-muted-foreground">Password minimal 8 karakter.</p>
          )}
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          <Button disabled={pending} type="submit">
            {pending ? 'Memproses…' : register ? 'Buat akun' : 'Login'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => void google()}
          >
            Lanjutkan dengan Google
          </Button>
        </form>
        <p className="mt-6 text-sm">
          {register ? 'Sudah punya akun?' : 'Belum punya akun?'}{' '}
          <Link
            className="text-accent underline"
            to={(register ? '/login' : '/register') + '?returnTo=' + encodeURIComponent(returnTo)}
          >
            {register ? 'Login' : 'Daftar'}
          </Link>
        </p>
      </section>
    </div>
  );
}
