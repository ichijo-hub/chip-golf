'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  doc, getDoc, collection, getDocs, query, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Game, Player, ChipDefinition, ChipState } from '@/types';
import { calculateScores, PlayerScore } from '@/lib/scoring';
import ChipBadge from '@/components/ChipBadge';
import { useT } from '@/lib/i18n';
import LangToggle from '@/components/LangToggle';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function ResultClient() {
  const router = useRouter();
  const { t } = useT();
  const [roomCode] = useState(() =>
    (new URLSearchParams(window.location.search).get('room') || '').toUpperCase()
  );

  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const gameSnap = await getDoc(doc(db, 'games', roomCode));
      if (!gameSnap.exists()) { setLoading(false); return; }
      const game = { id: gameSnap.id, ...gameSnap.data() } as Game;

      const [playersSnap, chipDefsSnap, chipStatesSnap] = await Promise.all([
        getDocs(query(collection(db, 'games', roomCode, 'players'), orderBy('display_order'))),
        getDocs(query(collection(db, 'games', roomCode, 'chip_definitions'), orderBy('sort_order'))),
        getDocs(collection(db, 'games', roomCode, 'chip_states')),
      ]);

      const players = playersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Player));
      const chipDefs = chipDefsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ChipDefinition));
      const chipStates = chipStatesSnap.docs.map(d => ({ id: d.id, ...d.data() } as ChipState));

      void game;
      setScores(calculateScores(players, chipStates, chipDefs));
      setLoading(false);
    }
    load();
  }, [roomCode]);

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-green-400">{t.common.loading}</p></main>;
  }

  return (
    <main className="min-h-screen p-4 pb-24">
      <div className="max-w-md mx-auto">
        <div className="flex justify-end pt-4 mb-2">
          <LangToggle />
        </div>
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏆</div>
          <h1 className="text-3xl font-bold text-[#d4af37]">{t.result.title}</h1>
          <p className="text-green-500 text-sm mt-1">{roomCode}</p>
        </div>

        <div className="space-y-3 mb-8">
          {scores.map(({ player, positivePoints, negativePoints, netScore, chips }, i) => (
            <div key={player.id} className="card-casino">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl w-10 text-center">{MEDALS[i] ?? '😢'}</span>
                <span className="text-white font-bold text-lg flex-1">{player.name}</span>
                <span className={`text-2xl font-bold ${netScore > 0 ? 'text-[#d4af37]' : netScore < 0 ? 'text-red-400' : 'text-white'}`}>
                  {netScore > 0 ? `+${netScore}` : netScore}
                </span>
              </div>
              <div className="flex gap-3 text-xs text-green-500 mb-2 ml-13">
                <span>{t.result.positive}<span className="text-green-300">+{positivePoints}</span></span>
                <span>{t.result.negative}<span className="text-red-300">-{negativePoints}</span></span>
              </div>
              {chips.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {chips.map((chipDef, j) => (
                    <ChipBadge key={j} name={chipDef.name} chipType={chipDef.chip_type} imageUrl={chipDef.image_url} imageScale={chipDef.image_scale ?? undefined} imageOffsetY={chipDef.image_offset_y ?? undefined} pointValue={chipDef.point_value} size={48} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <button onClick={() => router.push('/game/new')} className="btn-gold w-full py-4 text-lg">
            {t.result.playAgain}
          </button>
          <button onClick={() => router.push('/')} className="w-full py-3 rounded-lg border border-green-700 text-green-300 hover:border-[#d4af37] hover:text-[#d4af37] transition-colors">
            {t.result.backToTop}
          </button>
        </div>
      </div>
    </main>
  );
}
