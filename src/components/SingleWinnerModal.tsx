'use client';

import { useState } from 'react';
import { Player, SingleWinnerHoleLog } from '@/types';
import { useT } from '@/lib/i18n';

interface Props {
  type: 'dracon' | 'niapin';
  players: Player[];
  holeNumber: number;
  isHoleEditable: boolean;
  existingLog: SingleWinnerHoleLog | null;
  onSave: (holeNumber: number, winnerId: string | null, doubleUp: boolean, carryover: number) => Promise<void>;
  onClose: () => void;
}

export default function SingleWinnerModal({
  type,
  players,
  holeNumber: initialHole,
  isHoleEditable,
  existingLog,
  onSave,
  onClose,
}: Props) {
  const { t } = useT();
  const [holeNum, setHoleNum] = useState(initialHole);
  const [winnerId, setWinnerId] = useState<string | null>(existingLog?.winner_player_id ?? null);
  const [doubleUp, setDoubleUp] = useState(existingLog?.double_up ?? false);
  const [carryover, setCarryover] = useState(existingLog?.carryover ?? 0);
  const [saving, setSaving] = useState(false);

  const cfg = type === 'dracon' ? t.dracon : t.niapin;

  function resetWinner() {
    setWinnerId(null);
    setDoubleUp(false);
    setCarryover(0);
  }

  function handleSelectWinner(id: string) {
    if (winnerId === id) resetWinner();
    else setWinnerId(id);
  }

  function handleNoWinner() {
    resetWinner();
  }

  async function handleSave() {
    setSaving(true);
    await onSave(holeNum, winnerId, type === 'niapin' ? doubleUp : false, carryover);
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
              <button type="button" onClick={() => setHoleNum(h => Math.max(1, h - 1))}
                className="w-8 h-8 rounded-full bg-green-800 text-white font-bold flex items-center justify-center">−</button>
              <span className="text-[#d4af37] font-bold text-xl min-w-[4rem] text-center">H{holeNum}</span>
              <button type="button" onClick={() => setHoleNum(h => Math.min(18, h + 1))}
                className="w-8 h-8 rounded-full bg-green-800 text-white font-bold flex items-center justify-center">＋</button>
            </div>
          ) : (
            <span className="text-[#d4af37] font-bold text-xl">
              {cfg.modalTitle.replace('{{hole}}', String(holeNum))}
            </span>
          )}
          <button onClick={onClose} className="text-green-400 text-3xl leading-none">✕</button>
        </div>

        {/* 権利獲得者選択 */}
        <p className="text-green-400 text-sm mb-2 shrink-0">{cfg.winner}</p>
        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
          {players.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelectWinner(p.id)}
              className={`w-full py-3 px-4 rounded-xl font-bold text-base transition-colors border
                ${winnerId === p.id
                  ? 'bg-[#d4af37] border-yellow-400 text-[#1a1a1a]'
                  : 'bg-green-800 border-green-700 hover:bg-green-700 text-white'
                }`}
            >
              {p.name}
            </button>
          ))}
          <button
            type="button"
            onClick={handleNoWinner}
            className={`w-full py-2.5 px-4 rounded-xl text-sm transition-colors border
              ${winnerId === null
                ? 'bg-green-700 border-green-500 text-white font-bold'
                : 'bg-[#0d3320] border-green-900 text-green-700'
              }`}
          >
            {cfg.noWinner}
          </button>

          {/* 権利獲得者選択時のみ表示 */}
          {winnerId !== null && (
            <div className="space-y-2 mt-1">
              {/* キャリーオーバー */}
              <div className="bg-green-900 border border-green-700 rounded-xl px-4 py-3">
                <p className="text-green-400 text-sm mb-2">{cfg.carryover}</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCarryover(v => Math.max(0, v - 1))}
                    className="w-10 h-10 rounded-full bg-green-800 border border-green-600 text-white font-bold text-xl flex items-center justify-center hover:bg-green-700 active:bg-green-600"
                  >
                    −
                  </button>
                  <span className={`flex-1 text-center font-bold text-2xl ${carryover > 0 ? 'text-[#d4af37]' : 'text-green-600'}`}>
                    {carryover}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCarryover(v => v + 1)}
                    className="w-10 h-10 rounded-full bg-green-800 border border-green-600 text-white font-bold text-xl flex items-center justify-center hover:bg-green-700 active:bg-green-600"
                  >
                    ＋
                  </button>
                </div>
                {carryover > 0 && (
                  <p className="text-green-500 text-xs text-center mt-1">
                    +{carryover} × {players.length - 1}人 = +{carryover * (players.length - 1)}pt
                  </p>
                )}
              </div>

              {/* 倍付け（ニアピンのみ） */}
              {type === 'niapin' && (
                <button
                  type="button"
                  onClick={() => setDoubleUp(v => !v)}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-base transition-colors border
                    ${doubleUp
                      ? 'bg-red-700 border-red-500 text-white'
                      : 'bg-green-900 border-green-700 text-green-400'
                    }`}
                >
                  {doubleUp ? '✓ ' : ''}{t.niapin.doubleUp}
                </button>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="btn-gold w-full py-3 mt-4 text-base font-bold shrink-0"
        >
          {saving ? t.common.saving : t.common.save}
        </button>
      </div>
    </div>
  );
}
