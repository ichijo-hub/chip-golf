import { doc, setDoc, getDocs, collection, orderBy, query, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { getDeviceId } from '@/lib/deviceId';

const LEGACY_KEY = 'chip_golf_history';
const LEGACY_DEVICE_ID_KEY = 'chip_golf_device_id';

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

// 旧UUID（Device plugin未リンク時のフォールバック）→ 現在のdeviceIdへFirestore内でデータ移行
async function migrateOldUuidData(deviceId: string): Promise<void> {
  const oldUUID = localStorage.getItem(LEGACY_DEVICE_ID_KEY);
  if (!oldUUID || oldUUID === deviceId) return;
  try {
    const [historySnap, librarySnap] = await Promise.all([
      getDocs(collection(db, 'device_data', oldUUID, 'game_history')),
      getDocs(collection(db, 'device_data', oldUUID, 'chip_library')),
    ]);
    const allDocs = [...historySnap.docs, ...librarySnap.docs];
    if (allDocs.length === 0) { localStorage.removeItem(LEGACY_DEVICE_ID_KEY); return; }
    // 新パスへコピー
    await Promise.all(allDocs.map(d => {
      const sub = d.ref.parent.id; // 'game_history' or 'chip_library'
      return setDoc(doc(db, 'device_data', deviceId, sub, d.id), d.data(), { merge: true });
    }));
    // 旧パスを削除
    await Promise.all(allDocs.map(d => deleteDoc(d.ref)));
    localStorage.removeItem(LEGACY_DEVICE_ID_KEY);
  } catch {
    // 失敗時は次回リトライ
  }
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  const deviceId = await getDeviceId();
  const legacyRaw = localStorage.getItem(LEGACY_KEY);
  const legacyEntries: HistoryEntry[] = legacyRaw ? (() => { try { return JSON.parse(legacyRaw); } catch { return []; } })() : [];

  // localStorage → Firestore 移行（成功時のみ削除）
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
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      // 失敗時は localStorage を保持し次回リトライ
    }
  }

  // 旧UUID → 現在のdeviceId へ Firestore 内マイグレーション
  await migrateOldUuidData(deviceId);

  try {
    const snap = await getDocs(
      query(collection(db, 'device_data', deviceId, 'game_history'), orderBy('joinedAt', 'desc'))
    );
    return snap.docs.map(d => d.data() as HistoryEntry);
  } catch {
    return [...legacyEntries].sort(
      (a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
    );
  }
}
