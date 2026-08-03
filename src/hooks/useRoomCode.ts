'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';

export function useRoomCode(): string {
  const params = useParams();
  const [roomCode] = useState(() => {
    const fromSearch = new URLSearchParams(window.location.search).get('room');
    const fromStorage = typeof localStorage !== 'undefined'
      ? localStorage.getItem('currentRoomCode') : null;
    const fromParams = params?.roomCode as string | undefined;
    const code = fromSearch || fromStorage
      || (fromParams && fromParams !== '__placeholder__' ? fromParams : '');
    return (code || '').toUpperCase();
  });
  return roomCode;
}
