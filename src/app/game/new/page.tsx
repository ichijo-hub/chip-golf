'use client';
import dynamic from 'next/dynamic';

const NewGameClient = dynamic(() => import('./NewGameClient'), { ssr: false });

export default function Page() {
  return <NewGameClient />;
}
