import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { removeFromHistory } from '@/lib/gameHistory';

const SUBCOLLECTIONS = [
  'players',
  'chip_definitions',
  'chip_states',
  'game_events',
  'olympic_logs',
  'dracon_logs',
  'niapin_logs',
] as const;

// Firestore の writeBatch 上限は 500 件
const BATCH_LIMIT = 400;

/**
 * ゲーム本体と全サブコレクションを削除する。
 * ゲーム本体は最後のバッチに含めるため、途中で失敗しても再実行できる。
 */
export async function deleteGameCompletely(roomCode: string): Promise<void> {
  const snaps = await Promise.all(
    SUBCOLLECTIONS.map(name => getDocs(collection(db, 'games', roomCode, name)))
  );
  const refs = snaps.flatMap(snap => snap.docs.map(d => d.ref));
  refs.push(doc(db, 'games', roomCode));

  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    refs.slice(i, i + BATCH_LIMIT).forEach(ref => batch.delete(ref));
    await batch.commit();
  }

  try {
    await removeFromHistory(roomCode);
  } catch {
    // ゲーム本体は削除済み。履歴の残骸は表示時に除外されるので無視する
  }
}
