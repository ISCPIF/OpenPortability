// src/app/_components/reconnect/states/ReconnectionCompleteState.tsx
import { motion } from 'framer-motion';
import SuccessAutomaticReconnexion from '@/app/_components/SuccessAutomaticReconnexion';

type ReconnectionCompleteStateProps = {
  session: any;
  stats: any;
  globalStats: any;
  handleAutomaticReconnection: () => void;
  handleManualReconnection: () => void;
  refreshStats: () => void;
};

export default function ReconnectionCompleteState({
  session,
  stats,
  globalStats,
  handleAutomaticReconnection,
  handleManualReconnection,
  refreshStats,
}: ReconnectionCompleteStateProps) {
  return (
    <motion.div
      key="success"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <SuccessAutomaticReconnexion
        session={{
          user: {
            twitter_username: session.user?.twitter_username || session.user?.bluesky_username || session.user?.mastodon_username || '',
            bluesky_username: session.user.bluesky_username ?? "",
            mastodon_username: session.user.mastodon_username ?? "",
            mastodon_instance: session.user.mastodon_instance ?? "",
            has_onboarded: session.user.has_onboarded
          }
        }}
        stats={stats}
        onSuccess={refreshStats}
      />
    </motion.div>
  );
}