'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Game, Player, ChipDefinition, ChipState } from '@/types';
import { calculateScores, PlayerScore } from '@/lib/scoring';
import ChipBadge from '@/components/ChipBadge';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function ResultClient() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string).toUpperCase();
  const supabase = useRef(createClient()).current;

  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: gameData } = await supabase
        .from('games').select('*').eq('room_code', roomCode).single();
      if (!gameData) { setLoading(false); return; }
      const game = gameData as Game;

      const [{ data: playersData }, { data: chipDefsData }, { data: chipStatesData }] =
        await Promise.all([
          supabase.from('players').select('*').eq('game_id', game.id).order('display_order'),
          supabase.from('chip_definitions').select('*').eq('game_id', game.id).order('sort_order'),
          supabase.from('chip_states').select('*').eq('game_id', game.id),
        ]);

      const players = (playersData ?? []) as Player[];
      const chipDefs = (chipDefsData ?? []) as ChipDefinition[];
      const chipStates = (chipStatesData ?? []) as ChipState[];

      setScores(calculateScores(players, chipStates, chipDefs));
      setLoading(false);
    }
    load();
  }, [roomCode, supabase]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-green-400">読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 pb-24">
      <div className="max-w-md mx-auto">
        {/* タイトル */}
        <div className="text-center mb-8 pt-6">
          <div className="text-5xl mb-3">🏆</div>
          <h1 className="text-3xl font-bold text-[#d4af37]">結果発表</h1>
          <p className="text-green-500 text-sm mt-1">{roomCode}</p>
        </div>

        {/* ランキング */}
        <div className="space-y-3 mb-8">
          {scores.map(({ player, positivePoints, negativePoints, netScore, chips }, i) => (
            <div key={player.id} className="card-casino">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl w-10 text-center">
                  {MEDALS[i] ?? '😢'}
                </span>
                <span className="text-white font-bold text-lg flex-1">{player.name}</span>
                <span className={`text-2xl font-bold
                  ${netScore > 0 ? 'text-[#d4af37]' : netScore < 0 ? 'text-red-400' : 'text-white'}`}>
                  {netScore > 0 ? `+${netScore}` : netScore}
                </span>
              </div>

              <div className="flex gap-3 text-xs text-green-500 mb-2 ml-13">
                <span>ポジティブ: <span className="text-green-300">+{positivePoints}</span></span>
                <span>ネガティブ: <span className="text-red-300">-{negativePoints}</span></span>
              </div>

              {chips.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {chips.map((chipDef, j) => (
                    <ChipBadge
                      key={j}
                      name={chipDef.name}
                      chipType={chipDef.chip_type}
                      imageUrl={chipDef.image_url}
                      pointValue={chipDef.point_value}
                      size={48}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* アクション */}
        <div className="space-y-3">
          <button
            onClick={() => router.push('/game/new')}
            className="btn-gold w-full py-4 text-lg"
          >
            もう一度遊ぶ
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 rounded-lg border border-green-700 text-green-300
                       hover:border-[#d4af37] hover:text-[#d4af37] transition-colors"
          >
            トップに戻る
          </button>
        </div>
      </div>
    </main>
  );
}
