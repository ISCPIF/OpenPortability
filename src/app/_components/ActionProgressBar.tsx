'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';

interface Action {
  id: number;
  title: string;
  status: 'pending' | 'in-progress' | 'completed';
  progress: number;
  stats?: {
    followingCount: number;
    followersCount: number;
  };
}

const UPLOAD_SUCCESS_EVENT = 'uploadSuccess';

export default function ActionProgressBar() {
  const { data: session } = useSession();
  const [actions, setActions] = useState<Action[]>([
    {
      id: 1,
      title: 'Twitter Login',
      status: 'pending',
      progress: 0,
    },
    {
      id: 2,
      title: 'Data Upload',
      status: 'pending',
      progress: 0,
    },
    {
      id: 3,
      title: 'Mastodon Login',
      status: 'pending',
      progress: 0,
    },
    {
      id: 4,
      title: 'Link Accounts',
      status: 'pending',
      progress: 0,
    },
  ]);

  useEffect(() => {
    if (session?.twitterAccessToken) {
      setActions(prev => prev.map(action => 
        action.id === 1 ? { ...action, status: 'completed', progress: 100 } : action
      ));
    }
    if (session?.mastodonAccessToken) {
      setActions(prev => prev.map(action => 
        action.id === 3 ? { ...action, status: 'completed', progress: 100 } : action
      ));
    }
    // If both tokens are present, mark the linking step and upload as completed
    if (session?.twitterAccessToken && session?.mastodonAccessToken) {
      setActions(prev => prev.map(action => 
        (action.id === 4) ? { ...action, status: 'completed', progress: 100 } : action
      ));
    }
  }, [session]);

  // Listen for upload success event
  useEffect(() => {
    const handleUploadSuccess = (event: CustomEvent<{ followingCount: number; followersCount: number }>) => {
      setActions(prev => prev.map(action => 
        action.id === 2 ? {
          ...action,
          status: 'completed',
          progress: 100,
          stats: {
            followingCount: event.detail.followingCount,
            followersCount: event.detail.followersCount
          }
        } : action
      ));
    };

    const handleUploadStart = () => {
      setActions(prev => prev.map(action => 
        action.id === 2 ? { ...action, status: 'in-progress', progress: 50 } : action
      ));
    };

    const handleUploadError = () => {
      setActions(prev => prev.map(action => 
        action.id === 2 ? { ...action, status: 'pending', progress: 0 } : action
      ));
    };

    window.addEventListener('uploadStart', handleUploadStart);
    window.addEventListener('uploadSuccess', handleUploadSuccess as EventListener);
    window.addEventListener('uploadError', handleUploadError);

    return () => {
      window.removeEventListener('uploadStart', handleUploadStart);
      window.removeEventListener('uploadSuccess', handleUploadSuccess as EventListener);
      window.removeEventListener('uploadError', handleUploadError);
    };
  }, []);

  return (
    <div className="p-4 rounded-xl">
      <div className="relative flex items-center justify-between px-8 mb-8">
        {/* Timeline steps */}
        {actions.map((action, index) => (
          <div key={action.id} className="relative flex flex-col items-center z-10">
            {/* Step indicator */}
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center
              ${action.status === 'completed' ? 'bg-green-400/20' : 
                action.status === 'in-progress' ? 'bg-blue-400/20' : 
                'bg-gray-700'}
              transition-colors duration-300
              border-4 border-pink-600
              shadow-lg
            `}>
              {action.status === 'completed' ? (
                <CheckCircle2 className="w-6 h-6 text-green-400 drop-shadow" />
              ) : action.status === 'in-progress' ? (
                <Circle className="w-6 h-6 text-blue-400 animate-pulse drop-shadow" />
              ) : (
                <Circle className="w-6 h-6 text-gray-300 drop-shadow" />
              )}
            </div>

            {/* Step title and stats */}
            <div className="absolute -bottom-8 w-24 text-center">
              <span className={`
                text-sm font-medium whitespace-nowrap
                ${action.status === 'completed' ? 'text-green-300 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]' : 
                  action.status === 'in-progress' ? 'text-blue-300 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]' : 
                  'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]'}
                transition-colors duration-300
              `}>
                {action.title}
                {action.id === 2 && action.stats && (
                  <div className="text-xs opacity-75 mt-1">
                    {action.stats.followingCount} following
                    <br />
                    {action.stats.followersCount} followers
                  </div>
                )}
              </span>
            </div>
          </div>
        ))}

        {/* Progress lines between steps */}
        <div className="absolute top-5 left-0 right-0 flex justify-between px-16">
          {actions.slice(0, -1).map((action, index) => (
            <div key={`line-${index}`} className="w-full mx-2">
              <div className="h-0.5 bg-gray-700 relative">
                <div
                  className={`
                    absolute top-0 left-0 h-full transition-all duration-500
                    ${action.status === 'completed' ? 'bg-green-400' :
                      action.status === 'in-progress' ? 'bg-blue-400' :
                      'bg-transparent'}
                  `}
                  style={{ width: `${action.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}