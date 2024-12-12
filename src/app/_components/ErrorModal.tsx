'use client';

interface ErrorModalProps {
  isOpen: boolean;
  error: string | null;
  onClose: () => void;
}

export default function ErrorModal({ isOpen, error, onClose }: ErrorModalProps) {
  if (!isOpen || !error) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 max-w-md mx-4 relative">
        <button
          onClick={onClose}
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
            Erreur lors de l'upload
          </h3>
        </div>

        <p className="text-gray-300 mb-6">
          {error}
        </p>

        <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
          <p className="text-sm text-white font-medium mb-2">Conditions d'acceptation du fichier :</p>
          <ul className="list-disc list-inside text-sm space-y-1 text-gray-300">
            <li>Format accepté : fichier .zip ou fichiers .js individuels</li>
            <li>Taille maximale : 50MB</li>
            <li>Fichiers requis : following.js et follower.js</li>
            <li>Les fichiers doivent contenir des données Twitter valides</li>
          </ul>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}