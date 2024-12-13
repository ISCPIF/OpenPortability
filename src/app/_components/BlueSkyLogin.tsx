'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BskyAgent } from '@atproto/api';
import { signIn } from 'next-auth/react';

interface BlueSkyLoginProps {
  onLoginComplete?: (agent: BskyAgent) => void;
}

export default function BlueSkyLogin({ onLoginComplete }: BlueSkyLoginProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const clearSensitiveData = useCallback(() => {
    if (passwordRef.current) {
      passwordRef.current.value = '';
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const identifier = identifierRef.current?.value;
      const password = passwordRef.current?.value;

      if (!identifier || !password) {
        throw new Error('Please fill in all fields');
      }

      const response = await fetch('/api/auth/bluesky', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Clear sensitive data
      clearSensitiveData();

      // Utiliser signIn de NextAuth avec le provider bluesky
      const result = await signIn('bluesky', {
        redirect: false,
        identifier: data.handle,
        did: data.did,
        name: data.profile.displayName,
        image: data.profile.avatar,
        callbackUrl: '/dashboard'
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      // Si la connexion est réussie, rediriger
      if (result?.ok) {
        router.push(result.url || '/dashboard');
      }

      if (onLoginComplete) {
        const agent = new BskyAgent({
          service: 'https://bsky.social'
        });
        if (data.accessJwt && data.refreshJwt) {
          await agent.resumeSession({
            did: data.did,
            handle: identifier,
            accessJwt: data.accessJwt,
            refreshJwt: data.refreshJwt,
            active: true
          });
        }
        onLoginComplete(agent);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-8 bg-gradient-to-b from-gray-800 to-transparent rounded-2xl border border-gray-700">
      <div className="flex items-center gap-3">
        <svg
          className="w-10 h-10 text-pink-500"
          viewBox="0 0 288 288"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M0 144C0 64.5 64.5 0 144 0s144 64.5 144 144-64.5 144-144 144S0 223.5 0 144zm144-42c-23.2 0-42 18.8-42 42s18.8 42 42 42 42-18.8 42-42-18.8-42-42-42zm0 115.5c-40.3 0-73.5-33.2-73.5-73.5s33.2-73.5 73.5-73.5 73.5 33.2 73.5 73.5-33.2 73.5-73.5 73.5z"
            fill="currentColor"
          />
        </svg>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-pink-400 text-transparent bg-clip-text">
          Connectez-vous à BlueSky
        </h2>
      </div>

      <p className="text-gray-300 text-center max-w-md">
        Connectez votre compte BlueSky pour synchroniser vos données et profiter d'une expérience complète.
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="identifier" className="block text-sm font-medium text-gray-300 mb-1">
            Identifiant BlueSky
          </label>
          <input
            ref={identifierRef}
            type="text"
            id="identifier"
            className="w-full px-4 py-2 rounded bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            placeholder="handle.bsky.social"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
            Mot de passe d'application
          </label>
          <input
            ref={passwordRef}
            type="password"
            id="password"
            className="w-full px-4 py-2 rounded bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            required
          />
          <p className="mt-2 text-sm text-gray-400">
            Utilisez un{' '}
            <a
              href="https://bsky.app/settings/app-passwords"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pink-400 hover:text-pink-300 underline"
            >
              mot de passe d'application
            </a>
            {' '}pour plus de sécurité
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-2 px-4 rounded font-medium transition-colors duration-200 
            ${isLoading 
              ? 'bg-gray-600 cursor-not-allowed' 
              : 'bg-pink-600 hover:bg-pink-700 active:bg-pink-800'} 
            text-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 focus:ring-offset-gray-800`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Connexion en cours...
            </span>
          ) : 'Se connecter avec BlueSky'}
        </button>
      </form>

      <div className="text-sm text-gray-400 space-y-2 text-center">
        <p>
          Nous ne stockons jamais votre mot de passe. Nous utilisons uniquement les tokens d'authentification sécurisés fournis par BlueSky.
        </p>
        <p>
          Pas encore de compte BlueSky ?{' '}
          <a
            href="https://bsky.app/signup"
            target="_blank"
            rel="noopener noreferrer"
            className="text-pink-400 hover:text-pink-300 underline"
          >
            Créez-en un ici
          </a>
        </p>
      </div>
    </div>
  );
}