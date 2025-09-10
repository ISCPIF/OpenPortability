// src/app/_components/reconnect/states/ManualReconnectionState.tsx
import { motion } from 'framer-motion';
import ManualReconnexion from '@/app/_components/ManualReconnexion';

type ManualReconnectionStateProps = {
  session: any;
  accountsToProcess: any[];
  setAccountsToProcess: (accounts: any[]) => void;
  handleStartMigration: (accounts: string[]) => void;
  handleAutomaticReconnection: () => void;
};

export default function ManualReconnectionState({
  session,
  accountsToProcess,
  setAccountsToProcess,
  handleStartMigration,
  handleAutomaticReconnection,
}: ManualReconnectionStateProps) {

  console.log("acounts to process from Manual Reco State ->", accountsToProcess[0])
  return (
    <motion.div
      key="manual"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <ManualReconnexion
        matches={accountsToProcess}
        setMatches={setAccountsToProcess}
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