// src/app/_components/reconnect/states/ShowOptionsState.tsx
import { motion } from 'framer-motion';
import ReconnexionOptions from '@/app/_components/reconnection/ReconnexionOptions';

type ShowOptionsStateProps = {
  session: any;
  globalStats: any;
  handleAutomaticReconnection: () => void;
  handleManualReconnection: () => void;
};

export default function ShowOptionsState({
  session,
  globalStats,
  handleAutomaticReconnection,
  handleManualReconnection,
}: ShowOptionsStateProps) {
  return (
    <motion.div
      key="options"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <ReconnexionOptions
        onAutomatic={handleAutomaticReconnection}
        onManual={handleManualReconnection}
        globalStats={globalStats}
        has_onboarded={session?.user?.has_onboarded}
      />
    </motion.div>
  );
}