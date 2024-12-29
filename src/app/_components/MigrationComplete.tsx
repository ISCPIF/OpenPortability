'use client';

import { useTranslations } from 'next-intl';

interface MigrationCompleteProps {
  profile: {
    handle: string;
    displayName?: string;
  };
  onRetry?: () => void;
  onCreateAccount?: () => void;
  error?: string;
}

export default function MigrationComplete({ profile, onRetry, onCreateAccount, error }: MigrationCompleteProps) {
  const t = useTranslations('migrationComplete');

  if (error) {
    return (
      <div className="flex flex-col items-center gap-6 p-8 bg-gradient-to-b from-red-500/10 to-transparent rounded-2xl border border-red-500/20">
        <div className="flex items-center gap-3">
          <svg 
            className="w-10 h-10 text-red-500"
            fill="none"
            strokeWidth="2"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <h2 className="text-2xl font-bold text-red-600">
            {t('error.title')}
          </h2>
        </div>

        <p className="text-gray-600 dark:text-gray-300 text-center">
          {error}
        </p>

        <div className="flex gap-4">
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-lg hover:shadow-xl"
          >
            <svg 
              className="w-5 h-5"
              fill="none"
              strokeWidth="2"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            {t('error.retry')}
          </button>
          
          <button
            onClick={onCreateAccount}
            className="flex items-center gap-2 px-6 py-3 border border-blue-500 text-blue-500 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <svg 
              className="w-5 h-5"
              fill="none"
              strokeWidth="2"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
            {t('error.createAccount')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 p-8 bg-gradient-to-b from-green-500/10 to-transparent rounded-2xl border border-green-500/20">
      <div className="flex items-center gap-3">
        <svg 
          className="w-10 h-10 text-green-500"
          fill="none"
          strokeWidth="2"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h2 className="text-2xl font-bold text-green-600">
          {t('success.title')}
        </h2>
      </div>

      <p className="text-gray-600 dark:text-gray-300 text-center">
        {t('success.description', { handle: profile.handle })}
        {profile.displayName && (
          <span>
            {' '}
            {t('success.displayName', { name: profile.displayName })}
          </span>
        )}
      </p>

      <a
        href={`https://bsky.app/profile/${profile.handle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        <svg 
          className="w-5 h-5"
          fill="none"
          strokeWidth="2"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
        {t('success.viewProfile')}
      </a>
    </div>
  );
}