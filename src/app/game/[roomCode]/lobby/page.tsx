'use client';
import dynamic from 'next/dynamic';

const LobbyClient = dynamic(() => import('./LobbyClient'), { ssr: false });

export default function Page() {
  return <LobbyClient />;
}
