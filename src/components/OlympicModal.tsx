'use client';

import { useState } from 'react';
import { Player, OlympicEntry, OlympicHoleLog } from '@/types';
import { useT } from '@/lib/i18n';

const RANK_INFO = [
  { emoji: '🥇', pts: 4 },
  { emoji: '🥈', pts: 3 },
  { emoji: '🥉', pts: 2 },
  { emoji: '', pts: 1 },
] as const;

interface Props {
  players: Player[];
  holeNumber: number;
  isHoleEditable: boolean;
  existingLog: OlympicHoleLog | null;
  onSave: (holeNumber: number, entries: Record<string, OlympicEntry>) => Promise<void>;
  onClose: () => void;
}

export default function OlympicModal({
  players,
  holeNumber: initialHole,
  isHoleEditable,
  existingLog,
  onSave,
  onClose,
}: Props) {
  const { t } = useT();
  const [holeNum, setHoleNum] = useState(initialHole);
  const [saving, setSaving] = useState(false);
  const [positions, setPositions] = useState<Record<string, number | null>>(() => {
    const init: Record<string, number | null> = {};
    players.forEach(p => {
      init[p.id] = existingLog?.entries[p.id]?.position ?? null;
    });
    return init;
  });

  const rankLabels = [t.olympic.rank1, t.olympic.rank2, t.olympic.rank3, t.olympic.rank4];

  async function handleSave() {
    setSaving(true);
    const entries: Record<string, OlympicEntry> = {};
    players.forEach(p => { entries[p.id] = { position: positions[p.id] ?? null }; });
    await onSave(holeNum, entries);
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 bg-black/75 z-50 flex items-end justify-center px-4 pt-4"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 60px)' }}
      onClick={onClose}
    >
      <div
        className="card-casino w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          {isHoleEditable ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setHoleNum(h => Math.max(1, h - 1))}
                className="w-8 h-8 rounded-full bg-green-800 text-white font-bold flex items-center justify-center"
              >−</button>
              <span className="text-[#d4af37] font-bold text-xl min-w-[4rem] text-center">H{holeNum}</span>
              <button
                type="button"
                onClick={() => setHoleNum(h => Math.min(18, h + 1))}
                className="w-8 h-8 rounded-full bg-green-800 text-white font-bold flex items-center justify-center"
              >＋</button>
            </div>
          ) : (
            <span className="text-[#d4af37] font-bold text-xl">
              {t.olympic.modalTitle.replace('{{hole}}', String(holeNum))}
            </span>
          )}
          <button onClick={onClose} className="text-green-400 text-3xl leading-none">✕</button>
        </div>

        {/* プレイヤー一覧 */}
        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          {players.map(p => {
            const pos = positions[p.id] ?? null;
            return (
              <div key={p.id} className="bg-[#145a32] rounded-xl p-3">
                <p className="text-white font-semibold text-base mb-2">{p.name}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {RANK_INFO.slice(0, players.length).map((rank, i) => {
                    const rankNum = i + 1;
                    const selected = pos === rankNum;
                    return (
                      <button
                        key={rankNum}
                        type="button"
                        onClick={() => setPositions(prev => ({
                          ...prev,
                          [p.id]: prev[p.id] === rankNum ? null : rankNum,
                        }))}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors border
                          ${selected
                            ? 'bg-[#d4af37] border-yellow-400 text-[#1a1a1a]'
                            : 'bg-green-800 border-green-700 hover:bg-green-700 text-white'
                          }`}
                      >
                        <span className="text-base">{rank.emoji} </span>
                        <span>{rankLabels[i]}</span>
                        <span className="text-xs opacity-70 ml-0.5">({rank.pts})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="btn-gold w-full py-3 mt-4 text-base font-bold shrink-0"
        >
          {saving ? t.common.saving : t.olympic.save}
        </button>
      </div>
    </div>
  );
}
