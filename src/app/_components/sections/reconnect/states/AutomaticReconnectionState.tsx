// src/app/_components/reconnect/states/AutomaticReconnectionState.tsx
import { motion } from 'framer-motion';
import AutomaticReconnexion from '@/app/_components/reconnection/AutomaticReconnexion';

type AutomaticReconnectionStateProps = {
  session: any;
  stats: any;
  migrationResults: any;
  handleAutomaticReconnection: () => void;
};

export default function AutomaticReconnectionState({
  session,
  stats,
  migrationResults,
  handleAutomaticReconnection,
}: AutomaticReconnectionStateProps) {
  return (
    <motion.div
      key="automatic"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <AutomaticReconnexion
        results={migrationResults || { bluesky: { attempted: 0, succeeded: 0 }, mastodon: { attempted: 0, succeeded: 0 } }}
        onPause={handleAutomaticReconnection}
        session={{
          user: {
            bluesky_username: session?.user?.bluesky_username ?? null,
            mastodon_username: session?.user?.mastodon_username ?? null
          }
        }}
        stats={{
          bluesky_matches: stats?.matches.bluesky.total ?? 0,
          mastodon_matches: stats?.matches.mastodon.total ?? 0,
          matched_following: stats?.connections.following ?? 0
        }}
      />
    </motion.div>
  );
}