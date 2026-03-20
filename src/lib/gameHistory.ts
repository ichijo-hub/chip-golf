const KEY = 'chip_golf_history';

export interface HistoryEntry {
  roomCode: string;
  joinedAt: string; // ISO string
}

export function saveToHistory(roomCode: string) {
  const entries = loadHistory();
  const exists = entries.some(e => e.roomCode === roomCode);
  if (!exists) {
    entries.unshift({ roomCode, joinedAt: new Date().toISOString() });
    // 最大50件保持
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, 50)));
  }
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}
