'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

const LOCKOUT_ERROR_PREFIX = 'LOCKED_UNTIL:';

function getSignInErrorMessage(errorCode?: string | null): string {
  if (!errorCode) {
    return 'An error occurred. Please try again.';
  }

  if (errorCode.startsWith(LOCKOUT_ERROR_PREFIX)) {
    const lockedUntil = new Date(errorCode.slice(LOCKOUT_ERROR_PREFIX.length));

    if (Number.isNaN(lockedUntil.getTime())) {
      return 'Too many failed attempts. Please wait a few minutes before trying again.';
    }

    const formattedLockedUntil = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(lockedUntil);

    return `Too many failed attempts. Try again after ${formattedLockedUntil}.`;
  }

  if (errorCode === 'CredentialsSignin') {
    return 'Invalid email or password.';
  }

  if (errorCode === 'AccessDenied') {
    return 'You do not have permission to sign in with this account.';
  }

  return 'An error occurred while signing in. Please try again.';
}

export default function SignInPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const callbackUrl =
        new URLSearchParams(window.location.search).get('callbackUrl') ||
        '/dashboard';

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(getSignInErrorMessage(result.error));
        setIsLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError(getSignInErrorMessage());
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8
      bg-[url('/images/signin/signin_mobile.jpeg')] md:bg-[url('/images/signin/signin_web.png')]
      bg-cover bg-center bg-no-repeat bg-fixed
      before:absolute before:inset-0 before:bg-linear-to-t before:from-black/60 before:via-black/40 before:to-black/20
      animate-fadeIn"
    >
      <div className="w-full max-w-md relative z-10">
        <div className="bg-blue-700/40 dark:bg-gray-900/95 bg:backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              GSMS
            </h1>
            <h2 className="mt-6 text-2xl font-bold tracking-tight text-white">
              Sign in to your account
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 placeholder:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="owner@business.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md border text-white! border-gray-300 px-3 py-2 pr-10 placeholder:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
