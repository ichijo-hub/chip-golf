'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  doc, getDoc, collection, getDocs, query, orderBy,
} from 'firebase/firestore';
import { calcOlympicTotals, OlympicPlayerTotal } from '@/lib/olympic';
import { calcSingleWinnerTotals, SingleWinnerPlayerTotal } from '@/lib/singleWinner';
import { db } from '@/lib/firebase/client';
import { Game, Player, ChipDefinition, ChipState, GameEvent, OlympicHoleLog, SingleWinnerHoleLog } from '@/types';
import { calculateScores, PlayerScore } from '@/lib/scoring';
import ChipBadge from '@/components/ChipBadge';
import { useT } from '@/lib/i18n';
import LangToggle from '@/components/LangToggle';
import AdBanner from '@/components/AdBanner';
import { chipNamesEn } from '@/lib/i18n/chipNames';

// Standard competition ranking (1224): counts how many have strictly higher value
function computeRanks(values: number[]): number[] {
  return values.map(v => values.filter(x => x > v).length + 1);
}

function rankBadge(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}位`;
}

export default function ResultClient() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useT();
  const [roomCode] = useState(() => {
    const fromStorage = typeof localStorage !== 'undefined' ? localStorage.getItem('currentRoomCode') : null;
    const fromSearch = new URLSearchParams(window.location.search).get('room');
    const fromParams = params?.roomCode as string | undefined;
    const code = fromSearch || fromStorage || (fromParams && fromParams !== '__placeholder__' ? fromParams : '');
    return (code || '').toUpperCase();
  });

  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [chipDefs, setChipDefs] = useState<ChipDefinition[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [olympicTotals, setOlympicTotals] = useState<OlympicPlayerTotal[]>([]);
  const [draconTotals, setDraconTotals] = useState<SingleWinnerPlayerTotal[]>([]);
  const [niapinTotals, setNiapinTotals] = useState<SingleWinnerPlayerTotal[]>([]);
  const [sideGames, setSideGames] = useState({ olympic: false, dracon: false, niapin: false });

  useEffect(() => {
    if (!roomCode) { router.push('/'); return; }
    async function load() {
      const gameSnap = await getDoc(doc(db, 'games', roomCode));
      if (!gameSnap.exists()) { setLoading(false); return; }
      const game = { id: gameSnap.id, ...gameSnap.data() } as Game;

      const [playersSnap, chipDefsSnap, chipStatesSnap, eventsSnap, olympicSnap, draconSnap, niapinSnap] = await Promise.all([
        getDocs(query(collection(db, 'games', roomCode, 'players'), orderBy('display_order'))),
        getDocs(query(collection(db, 'games', roomCode, 'chip_definitions'), orderBy('sort_order'))),
        getDocs(collection(db, 'games', roomCode, 'chip_states')),
        getDocs(query(collection(db, 'games', roomCode, 'game_events'), orderBy('created_at', 'desc'))),
        getDocs(collection(db, 'games', roomCode, 'olympic_logs')),
        getDocs(collection(db, 'games', roomCode, 'dracon_logs')),
        getDocs(collection(db, 'games', roomCode, 'niapin_logs')),
      ]);

      const loadedPlayers = playersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Player));
      const loadedChipDefs = chipDefsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ChipDefinition));
      const chipStates = chipStatesSnap.docs.map(d => ({ id: d.id, ...d.data() } as ChipState));
      const loadedEvents = eventsSnap.docs.map(d => ({ ...d.data(), id: d.id } as GameEvent));

      const olympicLogs = olympicSnap.docs.map(d => ({ ...d.data() } as OlympicHoleLog));
      const draconLogs = draconSnap.docs.map(d => ({ ...d.data() } as SingleWinnerHoleLog));
      const niapinLogs = niapinSnap.docs.map(d => ({ ...d.data() } as SingleWinnerHoleLog));

      setPlayers(loadedPlayers);
      setChipDefs(loadedChipDefs);
      setEvents(loadedEvents);
      setScores(calculateScores(loadedPlayers, chipStates, loadedChipDefs));
      setSideGames({ olympic: !!game.olympic_enabled, dracon: !!game.dracon_enabled, niapin: !!game.niapin_enabled });
      setOlympicTotals(calcOlympicTotals(loadedPlayers, olympicLogs));
      setDraconTotals(calcSingleWinnerTotals(loadedPlayers, draconLogs));
      setNiapinTotals(calcSingleWinnerTotals(loadedPlayers, niapinLogs));
      setLoading(false);
    }
    load();
  }, [roomCode]);

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-green-400">{t.common.loading}</p></main>;
  }

  return (
    <main className="min-h-screen p-4 pb-24" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
      <div className="max-w-md mx-auto">
        <div className="flex justify-end pt-4 mb-2">
          <LangToggle />
        </div>
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏆</div>
          <h1 className="text-3xl font-bold text-[#d4af37]">{t.result.title}</h1>
          <p className="text-green-500 text-sm mt-1">{roomCode}</p>
        </div>

        {/* チップゴルフ結果 */}
        {sideGames.olympic && (
          <p className="text-[#d4af37] font-bold text-lg mb-3">⛳ {t.olympic.tabChipGolf}</p>
        )}
        <div className="space-y-3 mb-8">
          {(() => {
            const ranks = computeRanks(scores.map(s => s.netScore));
            return scores.map(({ player, positivePoints, negativePoints, netScore, chips }, i) => (
            <div key={player.id} className="card-casino">
              <div className="flex items-center gap-3 mb-2">
                <span className={`w-10 text-center shrink-0 ${ranks[i] <= 3 ? 'text-3xl' : 'text-xs font-bold text-green-400 whitespace-nowrap'}`}>{rankBadge(ranks[i])}</span>
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
          ));})()}
        </div>

        {/* オリンピック結果 */}
        {sideGames.olympic && (
          <>
            <p className="text-[#d4af37] font-bold text-lg mb-3">🏅 {t.olympic.tabOlympic}</p>
            <div className="space-y-3 mb-8">
              {olympicTotals.length === 0 ? (
                <p className="text-green-700 text-center py-4">{t.olympic.noData}</p>
              ) : (() => {
                const ranks = computeRanks(olympicTotals.map(t => t.settlement));
                return olympicTotals.map(({ player, totalPoints, settlement }, i) => (
                  <div key={player.id} className="card-casino">
                    <div className="flex items-center gap-3">
                      <span className={`w-10 text-center shrink-0 ${ranks[i] <= 3 ? 'text-3xl' : 'text-xs font-bold text-green-400 whitespace-nowrap'}`}>{rankBadge(ranks[i])}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-lg">{player.name}</p>
                        <p className="text-green-500 text-sm">{t.olympic.totalPoints}: {totalPoints}pt</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-2xl font-bold ${settlement > 0 ? 'text-[#d4af37]' : settlement < 0 ? 'text-red-400' : 'text-white'}`}>
                          {settlement > 0 ? `+${settlement}` : settlement}
                        </p>
                        <p className={`text-xs font-semibold ${settlement > 0 ? 'text-green-400' : settlement < 0 ? 'text-red-400' : 'text-green-600'}`}>
                          {settlement > 0 ? t.olympic.receive : settlement < 0 ? t.olympic.pay : '±0'}
                        </p>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </>
        )}

        {/* ドラコン結果 */}
        {sideGames.dracon && (
          <>
            <p className="text-[#d4af37] font-bold text-lg mb-3">🏌️ {t.dracon.tabLabel}</p>
            <div className="space-y-3 mb-8">
              {draconTotals.length === 0 ? (
                <p className="text-green-700 text-center py-4">{t.dracon.noData}</p>
              ) : (() => {
                const ranks = computeRanks(draconTotals.map(t => t.settlement));
                return draconTotals.map(({ player, wins, settlement }, i) => (
                  <div key={player.id} className="card-casino">
                    <div className="flex items-center gap-3">
                      <span className={`w-10 text-center shrink-0 ${ranks[i] <= 3 ? 'text-3xl' : 'text-xs font-bold text-green-400 whitespace-nowrap'}`}>{rankBadge(ranks[i])}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-lg">{player.name}</p>
                        <p className="text-green-500 text-sm">{t.dracon.wins}: {wins}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-2xl font-bold ${settlement > 0 ? 'text-[#d4af37]' : settlement < 0 ? 'text-red-400' : 'text-white'}`}>
                          {settlement > 0 ? `+${settlement}` : settlement}
                        </p>
                        <p className={`text-xs font-semibold ${settlement > 0 ? 'text-green-400' : settlement < 0 ? 'text-red-400' : 'text-green-600'}`}>
                          {settlement > 0 ? t.dracon.receive : settlement < 0 ? t.dracon.pay : '±0'}
                        </p>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </>
        )}

        {/* ニアピン結果 */}
        {sideGames.niapin && (
          <>
            <p className="text-[#d4af37] font-bold text-lg mb-3">📍 {t.niapin.tabLabel}</p>
            <div className="space-y-3 mb-8">
              {niapinTotals.length === 0 ? (
                <p className="text-green-700 text-center py-4">{t.niapin.noData}</p>
              ) : (() => {
                const ranks = computeRanks(niapinTotals.map(t => t.settlement));
                return niapinTotals.map(({ player, wins, settlement }, i) => (
                  <div key={player.id} className="card-casino">
                    <div className="flex items-center gap-3">
                      <span className={`w-10 text-center shrink-0 ${ranks[i] <= 3 ? 'text-3xl' : 'text-xs font-bold text-green-400 whitespace-nowrap'}`}>{rankBadge(ranks[i])}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-lg">{player.name}</p>
                        <p className="text-green-500 text-sm">{t.niapin.wins}: {wins}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-2xl font-bold ${settlement > 0 ? 'text-[#d4af37]' : settlement < 0 ? 'text-red-400' : 'text-white'}`}>
                          {settlement > 0 ? `+${settlement}` : settlement}
                        </p>
                        <p className={`text-xs font-semibold ${settlement > 0 ? 'text-green-400' : settlement < 0 ? 'text-red-400' : 'text-green-600'}`}>
                          {settlement > 0 ? t.niapin.receive : settlement < 0 ? t.niapin.pay : '±0'}
                        </p>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </>
        )}

        {/* 観戦者コメント */}
        {players.filter(p => p.is_spectator && (p.comments ?? []).length > 0).length > 0 && (
          <div className="card-casino mb-6">
            <p className="text-green-400 font-semibold text-lg mb-3">👀 観戦ログ</p>
            <div className="space-y-3">
              {players.filter(p => p.is_spectator).map(p => {
                const comments = p.comments ?? [];
                if (comments.length === 0) return null;
                return (
                  <div key={p.id} className="bg-[#145a32] rounded-lg px-3 py-2">
                    <p className="text-green-300 font-medium text-sm mb-1">{p.name}</p>
                    <div className="space-y-0.5">
                      {comments.map((c, i) => (
                        <p key={i} className="text-green-500 text-xs break-words">💬 {c}</p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* イベントログ */}
        <div className="card-casino mb-6">
          <button
            type="button"
            onClick={() => setShowLog(v => !v)}
            className="w-full flex items-center justify-between text-[#d4af37] font-semibold text-lg"
          >
            <span>{t.result.eventLog.replace('{{count}}', String(events.length))}</span>
            <span className="text-green-500 text-base">{showLog ? t.result.closeLog : t.result.openLog}</span>
          </button>
          {showLog && (
            <div className="mt-2 space-y-1">
              {events.length === 0 ? (
                <p className="text-green-700 text-base text-center py-2">{t.result.noEvents}</p>
              ) : (
                events.map((ev) => {
                  const chipDef = chipDefs.find(d => d.id === ev.chip_definition_id);
                  const chipName = chipDef
                    ? (locale === 'en' ? (chipNamesEn[chipDef.name] ?? chipDef.name) : chipDef.name)
                    : (ev.description?.split(':')[0] ?? '');
                  const fromName = ev.from_player_id
                    ? (players.find(p => p.id === ev.from_player_id)?.name ?? t.play.field)
                    : t.play.field;
                  const toName = ev.to_player_id
                    ? (players.find(p => p.id === ev.to_player_id)?.name ?? t.play.field)
                    : t.play.field;
                  const holePrefix = ev.hole_number != null ? `${t.result.holeLabel}${ev.hole_number} ` : '';
                  const label = chipDef
                    ? `${holePrefix}${chipName}: ${fromName} → ${toName}`
                    : (ev.description ?? '');
                  return (
                    <div key={ev.id} className="text-sm text-green-300 bg-[#145a32] rounded px-3 py-1.5">
                      {label}
                    </div>
                  );
                })
              )}
            </div>
          )}
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
      <AdBanner />
    </main>
  );
}
