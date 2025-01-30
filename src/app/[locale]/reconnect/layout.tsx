import { ReactNode } from 'react';
import { plex } from '../../fonts/plex';

export default function MigrateLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className={`min-h-screen ${plex.className}`}>
      {children}
    </main>
  );
}