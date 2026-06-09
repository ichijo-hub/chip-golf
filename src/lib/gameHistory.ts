import { doc, setDoc, getDocs, collection, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { getDeviceId } from '@/lib/deviceId';

const LEGACY_KEY = 'chip_golf_history';

export interface HistoryEntry {
  roomCode: string;
  joinedAt: string; // ISO string
}

export async function saveToHistory(roomCode: string): Promise<void> {
  const deviceId = await getDeviceId();
  await setDoc(
    doc(db, 'device_data', deviceId, 'game_history', roomCode),
    { roomCode, joinedAt: new Date().toISOString() },
    { merge: true }
  );
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  const deviceId = await getDeviceId();

  // localStorage からの1回限りマイグレーション
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy) {
    try {
      const entries = JSON.parse(legacy) as HistoryEntry[];
      await Promise.all(
        entries.map(e =>
          setDoc(
            doc(db, 'device_data', deviceId, 'game_history', e.roomCode),
            { roomCode: e.roomCode, joinedAt: e.joinedAt },
            { merge: true }
          )
        )
      );
    } catch {
      // マイグレーション失敗は無視
    }
    localStorage.removeItem(LEGACY_KEY);
  }

  const snap = await getDocs(
    query(collection(db, 'device_data', deviceId, 'game_history'), orderBy('joinedAt', 'desc'))
  );
  return snap.docs.map(d => d.data() as HistoryEntry);
}
