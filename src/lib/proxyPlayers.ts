import {
  collection, doc, setDoc, deleteDoc, getDoc, runTransaction,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { saveToHistory } from '@/lib/gameHistory';

/**
 * 代理プレイヤー: スマホを持っていない同行者の分をホストが登録するプレイヤー。
 * 端末との紐付けは localStorage[player_${roomCode}] だけなので、代理プレイヤーは
 * 「どの端末にも紐付いていないプレイヤー」として表現できる（is_proxy: true）。
 * 後から本人が参加したら、同じプレイヤー ID をその端末に紐付けて引き継ぐ（ID は作り直さない）。
 */

export class ProxyAlreadyClaimedError extends Error {
  constructor() { super('already_claimed'); this.name = 'ProxyAlreadyClaimedError'; }
}

export async function addProxyPlayer(roomCode: string, name: string, displayOrder: number): Promise<void> {
  const trimmed = name.trim().slice(0, 20);
  if (!trimmed) return;
  const ref = doc(collection(db, 'games', roomCode, 'players'));
  await setDoc(ref, {
    id: ref.id, game_id: roomCode, name: trimmed,
    display_order: displayOrder, is_host: false,
    is_spectator: false, is_proxy: true, comments: [],
    created_at: new Date().toISOString(),
  });
}

/** 待機ルーム専用。まだ引き継がれていない代理プレイヤーだけ削除する */
export async function removeProxyPlayer(roomCode: string, playerId: string): Promise<void> {
  const ref = doc(db, 'games', roomCode, 'players', playerId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().is_proxy !== true) return;
  await deleteDoc(ref);
}

/**
 * 代理プレイヤーをこの端末に引き継ぐ。
 * - トランザクションで is_proxy を確認し、同時に2人が同じ名前を選んでも1人しか取れないようにする
 * - 引き継ぐ端末がすでに観戦者として参加していた場合、その観戦者行は削除する
 *   （観戦者はチップ・サイドゲームを持たないため安全）
 */
export async function claimProxyPlayer(
  roomCode: string, proxyId: string, currentPlayerId: string | null,
): Promise<void> {
  const proxyRef = doc(db, 'games', roomCode, 'players', proxyId);
  const currentRef = currentPlayerId && currentPlayerId !== proxyId
    ? doc(db, 'games', roomCode, 'players', currentPlayerId) : null;

  await runTransaction(db, async (tx) => {
    const proxySnap = await tx.get(proxyRef);
    const currentSnap = currentRef ? await tx.get(currentRef) : null;
    if (!proxySnap.exists() || proxySnap.data().is_proxy !== true) {
      throw new ProxyAlreadyClaimedError();
    }
    tx.update(proxyRef, { is_proxy: false, claimed_at: new Date().toISOString() });
    if (currentRef && currentSnap?.exists()) {
      const cur = currentSnap.data();
      if (cur.is_spectator === true && cur.is_host !== true) tx.delete(currentRef);
    }
  });

  localStorage.setItem(`player_${roomCode}`, proxyId);
  await saveToHistory(roomCode);
}
