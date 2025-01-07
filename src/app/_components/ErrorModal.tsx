'use client';

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation';

interface ErrorModalProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
  showExtractInstructions?: boolean;  // Nouvelle prop
}

export default function ErrorModal({ isOpen, message, onClose, showExtractInstructions = false }: ErrorModalProps) {
  const t = useTranslations('errorModal');
  const router = useRouter();
  
  if (!isOpen || !message) return null;

  const handleClose = () => {
    onClose();
    router.refresh();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 max-w-3xl mx-4 relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="flex items-center gap-3 mb-4">
          <svg 
            className="w-8 h-8 text-red-500"
            fill="none" 
            strokeWidth="1.5" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <h3 className="text-xl font-semibold text-white">
            {t('title')}
          </h3>
        </div>

        <p className="text-gray-300 mb-6">{message}</p>

        {showExtractInstructions && (
          <div className="space-y-6">
            <div className="aspect-video w-full">
              <iframe
                className="w-full h-full rounded-lg"
                src="https://www.youtube.com/embed/zN5JRZOgMY8"
                title="Comment télécharger votre archive Twitter"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-white mb-4">
                {t('extractArchive.title')}
              </h4>
              
              <div className="space-y-4">
                <div>
                  <h5 className="text-white font-medium mb-2">{t('extractArchive.windows')} :</h5>
                  <ol className="text-gray-300 list-decimal list-inside">
                    <li>{t('extractArchive.steps.windows.step1')}</li>
                    <li>{t('extractArchive.steps.windows.step2')}</li>
                    <li>{t('extractArchive.steps.windows.step3')}</li>
                    <li>{t('extractArchive.steps.windows.step4')}</li>
                  </ol>
                </div>

                <div>
                  <h5 className="text-white font-medium mb-2">{t('extractArchive.mac')} :</h5>
                  <ol className="text-gray-300 list-decimal list-inside">
                    <li>{t('extractArchive.steps.mac.step1')}</li>
                    <li>{t('extractArchive.steps.mac.step2')}</li>
                  </ol>
                </div>

                <div>
                  <h5 className="text-white font-medium mb-2">{t('extractArchive.linux')} :</h5>
                  <ol className="text-gray-300 list-decimal list-inside">
                    <li>{t('extractArchive.steps.linux.step1')}</li>
                    <li>{t('extractArchive.steps.linux.step2')}</li>
                    <li>{t('extractArchive.steps.linux.step3')}</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}