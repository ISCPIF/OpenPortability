'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import Header from '@/app/_components/Header';

export default function BlueSkyAuth() {
  const router = useRouter();
  const { data: session } = useSession();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (session?.user?.has_onboarded) {
      router.replace('/dashboard');
    }
    else if (session?.user?.bluesky_id) {
      router.replace('/upload');
    }
  }, [session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/bluesky', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          identifier, 
          password 
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Authentication failed');
      }

      // Clear password from memory
      setPassword('');
      router.push('/upload');
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
      // Clear password on error too
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
      <Header />
      
      <main className="container mx-auto px-4 pt-8">
        <div className="max-w-md mx-auto bg-white/10 backdrop-blur-lg rounded-lg shadow-lg p-8 mt-8">
          <h1 className="text-2xl font-bold text-center mb-8 bg-gradient-to-r from-pink-500 to-violet-500 text-transparent bg-clip-text">
            Connect your BlueSky Account
          </h1>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-gray-200 mb-2">
                Handle or Email
              </label>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-gray-600 focus:border-pink-500 focus:ring-2 focus:ring-pink-500 text-white placeholder-gray-400"
                placeholder="@handle.bsky.social"
                required
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-200 mb-2">
                App Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-gray-600 focus:border-pink-500 focus:ring-2 focus:ring-pink-500 text-white placeholder-gray-400"
                placeholder="Your app password"
                required
              />
              <p className="mt-2 text-sm text-gray-400">
                Use an{' '}
                <a
                  href="https://bsky.app/settings/app-passwords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-400 hover:text-pink-300 underline"
                >
                  App Password
                </a>
                {' '}from your BlueSky settings
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-2 text-white bg-gradient-to-r from-pink-500 to-purple-500 rounded-lg hover:from-pink-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isLoading ? 'Connecting...' : 'Connect BlueSky'}
              </button>

              <button
                type="button"
                onClick={() => router.push('/upload')}
                className="w-full px-4 py-2 text-gray-300 bg-transparent border border-gray-600 rounded-lg hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200"
              >
                Skip BlueSky Connection
              </button>
            </div>

            {error && (
              <div className="mt-4 text-red-400 text-sm text-center">
                {error}
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}