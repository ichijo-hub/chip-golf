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
  const legacyRaw = localStorage.getItem(LEGACY_KEY);
  const legacyEntries: HistoryEntry[] = legacyRaw ? (() => { try { return JSON.parse(legacyRaw); } catch { return []; } })() : [];

  // Firestore への移行（成功時のみ localStorage を削除）
  if (legacyEntries.length > 0) {
    try {
      await Promise.all(
        legacyEntries.map(e =>
          setDoc(
            doc(db, 'device_data', deviceId, 'game_history', e.roomCode),
            { roomCode: e.roomCode, joinedAt: e.joinedAt },
            { merge: true }
          )
        )
      );
      localStorage.removeItem(LEGACY_KEY); // 書き込み成功後のみ削除
    } catch {
      // 移行失敗時は localStorage を保持し次回リトライ
    }
  }

  try {
    const snap = await getDocs(
      query(collection(db, 'device_data', deviceId, 'game_history'), orderBy('joinedAt', 'desc'))
    );
    return snap.docs.map(d => d.data() as HistoryEntry);
  } catch {
    // Firestore 読み込み失敗時は localStorage のデータをフォールバック
    return [...legacyEntries].sort(
      (a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
    );
  }
}
