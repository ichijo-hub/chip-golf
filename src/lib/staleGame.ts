import { Game } from '@/types';

/**
 * ホストが「ゲーム終了」を押さずに放置したゲームを、開催中として扱わないための判定。
 * games.updated_at は作成時にしか書かれないため、確実に入っている created_at を基準にする。
 * ゴルフのラウンドは1日で終わるので、作成から24時間を超えた未終了ゲームは放置とみなす。
 * データは書き換えない（表示上の扱いだけ）。ホストが開けば通常どおり再開・終了できる。
 */
export const STALE_GAME_HOURS = 24;

export function isStaleGame(game: Pick<Game, 'status' | 'created_at'>, now: number = Date.now()): boolean {
  if (game.status === 'finished') return false;
  const created = new Date(game.created_at).getTime();
  if (Number.isNaN(created)) return false; // 作成日時が読めない古いデータは従来どおり表示する
  return now - created > STALE_GAME_HOURS * 60 * 60 * 1000;
}
