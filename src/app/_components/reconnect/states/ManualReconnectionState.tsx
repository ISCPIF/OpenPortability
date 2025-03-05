// src/app/_components/reconnect/states/ManualReconnectionState.tsx
import { motion } from 'framer-motion';
import ManualReconnexion from '@/app/_components/ManualReconnexion';

type ManualReconnectionStateProps = {
  session: any;
  accountsToProcess: any[];
  handleStartMigration: (accounts: string[]) => void;
  handleAutomaticReconnection: () => void;
};

export default function ManualReconnectionState({
  session,
  accountsToProcess,
  handleStartMigration,
  handleAutomaticReconnection,
}: ManualReconnectionStateProps) {
  return (
    <motion.div
      key="manual"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <ManualReconnexion
        matches={accountsToProcess}
        onStartMigration={handleStartMigration}
        onToggleAutomaticReconnect={handleAutomaticReconnection}
        session={{
          user: {
            bluesky_username: session?.user?.bluesky_username ?? null,
            mastodon_username: session?.user?.mastodon_username ?? null
          }
        }}
      />
    </motion.div>
  );
}