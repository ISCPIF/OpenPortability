// src/app/_components/reconnect/states/LoadingState.tsx
import LoadingIndicator from '@/app/_components/LoadingIndicator';
import { useTranslations } from 'next-intl';

export default function LoadingState() {
  const t = useTranslations('migrate');
  
  return (
    <div className="min-h-screen bg-[#2a39a9] relative w-full max-w-[90rem] m-auto">
      <div className="container mx-auto py-12">
        <div className="container flex flex-col m-auto text-center text-[#E2E4DF]">
          <div className="m-auto relative my-32 lg:my-40">
            <LoadingIndicator msg={t('loading')} />
          </div>
        </div>
      </div>
    </div>
  );
}