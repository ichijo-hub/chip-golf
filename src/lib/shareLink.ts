const PRODUCTION_URL = 'https://chip-golf.vercel.app';

/**
 * 他の人に送る参加用 URL（待機ルーム）。
 * 待機ルームはプレイ中でも未参加者には参加フォームを出し、参加済みの端末はプレイ画面へ移るので、待機中・プレイ中とも同じ URL でよい。
 * ネイティブアプリ内の origin は capacitor://localhost などになるため、ブラウザで開ける URL を使う。
 */
export function getGameJoinUrl(roomCode: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const base = process.env.NEXT_PUBLIC_APP_URL
    || (/^https?:\/\//.test(origin) ? origin : PRODUCTION_URL);
  return `${base.replace(/\/$/, '')}/game/__placeholder__/lobby?room=${encodeURIComponent(roomCode)}`;
}

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/** 共有シート（LINE などを選べる）を開く。使えない環境ではクリップボードにコピーする */
export async function shareGameLink(roomCode: string, text: string): Promise<ShareResult> {
  const url = getGameJoinUrl(roomCode);
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Chip Golf', text, url });
      return 'shared';
    } catch (err) {
      // ユーザーが共有シートを閉じた場合は何もしない
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
