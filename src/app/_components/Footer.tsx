'use client';

const Footer = () => {
  return (
    <footer className="w-full py-6 mt-auto bg-[#2a39a9] border-t border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center text-center">
          <p className="text-sm text-foreground font-space-grotesk mb-2">
            Cette plateforme est hébergée par le{' '}
            <a 
              href="https://iscpif.fr/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              CNRS/ISC-PIF
            </a>{' '}
            et développée en partenariat avec le collectif{' '}
            <a 
              href="https://helloquittex.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              HelloQuitteX
            </a>
          </p>
          <div className="text-xs text-gray-500 font-space-grotesk">
            &copy; {new Date().getFullYear()} HelloQuitteX. Tous droits réservés.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;