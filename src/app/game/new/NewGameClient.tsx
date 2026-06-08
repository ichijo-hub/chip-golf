'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  doc, setDoc, updateDoc, collection, getDocs, writeBatch,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { generateRoomCode } from '@/lib/roomCode';
import { ChipTemplate } from '@/types';
import { saveToHistory } from '@/lib/gameHistory';
import { DEFAULT_CHIPS } from '@/lib/defaultChips';
import { useT } from '@/lib/i18n';

export default function NewGameClient() {
  const router = useRouter();
  const [hostName, setHostName] = useState('');
  const [templates, setTemplates] = useState<ChipTemplate[]>([]);
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [olympicEnabled, setOlympicEnabled] = useState(false);
  const [draconEnabled, setDraconEnabled] = useState(false);
  const [niapinEnabled, setNiapinEnabled] = useState(false);
  const seeding = useRef(false);

  const loadTemplates = useCallback(async () => {
    const q = query(collection(db, 'chip_templates'), orderBy('sort_order'));
    const snap = await getDocs(q);
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChipTemplate));
    const active = all.filter(t => t.is_active !== false);
    if (active.length === 0) {
      if (seeding.current) return;
      seeding.current = true;
      const existingNames = new Set(all.map(t => t.name));
      const toInsert = DEFAULT_CHIPS.filter(c => !existingNames.has(c.name));
      if (toInsert.length > 0) {
        const batch = writeBatch(db);
        toInsert.forEach(c => {
          const ref = doc(collection(db, 'chip_templates'));
          batch.set(ref, {
            name: c.name, chip_type: c.chip_type,
            default_point_value: c.point_value, sort_order: c.sort_order,
            is_active: true, image_url: c.image_url ?? null, created_at: serverTimestamp(),
          });
        });
        await batch.commit();
      }
      const snap2 = await getDocs(query(collection(db, 'chip_templates'), orderBy('sort_order')));
      setTemplates(snap2.docs.map(d => ({ id: d.id, ...d.data() } as ChipTemplate)).filter(t => t.is_active !== false));
    } else {
      setTemplates(active);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!hostName.trim()) { setError(t.newGame.errorEmptyName); return; }
    if (templates.length === 0) { setError(t.newGame.errorLoadChips); return; }
    setLoading(true);
    setError('');

    try {
      const roomCode = generateRoomCode();
      const batch = writeBatch(db);

      // Game document (room_code as ID)
      const gameRef = doc(db, 'games', roomCode);
      batch.set(gameRef, {
        id: roomCode, room_code: roomCode, status: 'lobby',
        host_player_id: null,
        hole_mode: 'none', total_holes: 0, current_hole: 1,
        olympic_enabled: olympicEnabled,
        dracon_enabled: draconEnabled,
        niapin_enabled: niapinEnabled,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });

      // Host player
      const playerRef = doc(collection(db, 'games', roomCode, 'players'));
      const playerId = playerRef.id;
      batch.set(playerRef, {
        id: playerId, game_id: roomCode, name: hostName.trim(),
        display_order: 0, is_host: true, created_at: new Date().toISOString(),
      });

      // chip_definitions + chip_states
      templates.forEach((t, i) => {
        const chipDefRef = doc(collection(db, 'games', roomCode, 'chip_definitions'));
        batch.set(chipDefRef, {
          id: chipDefRef.id, game_id: roomCode,
          chip_template_id: t.id, name: t.name, chip_type: t.chip_type,
          point_value: t.default_point_value, image_url: t.image_url ?? null,
          image_scale: t.image_scale ?? null, image_offset_y: t.image_offset_y ?? null,
          condition: t.condition ?? null,
          is_default: true, is_active: true, sort_order: i,
        });
        const chipStateRef = doc(collection(db, 'games', roomCode, 'chip_states'));
        batch.set(chipStateRef, {
          id: chipStateRef.id, game_id: roomCode,
          chip_definition_id: chipDefRef.id, holder_player_id: null,
          updated_at: new Date().toISOString(),
        });
      });

      await batch.commit();

      // Update host_player_id after batch (batch can't read generated IDs)
      await updateDoc(gameRef, { host_player_id: playerId });

      localStorage.setItem(`player_${roomCode}`, playerId);
      saveToHistory(roomCode);
      localStorage.setItem('currentRoomCode', roomCode);
      router.push(`/game/__placeholder__/lobby?room=${roomCode}`);
    } catch (err) {
      console.error(err);
      setError(t.newGame.errorCreate);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-4 pb-24" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6 pt-4">
          <button onClick={() => router.push('/')} className="text-green-400 hover:text-[#d4af37] transition-colors">← {t.common.back}</button>
          <h1 className="text-2xl font-bold text-[#d4af37]">{t.newGame.title}</h1>
        </div>

        <form onSubmit={handleCreate} className="space-y-6">
          <div className="card-casino">
            <label className="block text-[#d4af37] font-semibold mb-2">{t.newGame.hostNameLabel}</label>
            <input
              type="text" value={hostName} onChange={e => setHostName(e.target.value)}
              placeholder={t.newGame.hostNamePlaceholder} maxLength={20}
              className="w-full bg-[#145a32] border border-green-700 rounded-lg px-4 py-3
                         text-white placeholder-green-600 focus:outline-none focus:border-[#d4af37]"
            />
          </div>

          {/* オプションゲーム設定 */}
          {([
            { label: `🏅 ${t.olympic.enableToggle}`,  value: olympicEnabled, set: setOlympicEnabled },
            { label: `🏌️ ${t.dracon.enableToggle}`,   value: draconEnabled,  set: setDraconEnabled },
            { label: `📍 ${t.niapin.enableToggle}`,   value: niapinEnabled,  set: setNiapinEnabled },
          ]).map(({ label, value, set }) => (
            <div
              key={label}
              className="card-casino cursor-pointer"
              onClick={() => set(v => !v)}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#d4af37] font-semibold text-sm">{label}</span>
                <div className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${value ? 'bg-[#d4af37]' : 'bg-green-900'}`}>
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-0'}`} />
                </div>
              </div>
            </div>
          ))}

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button type="submit" disabled={loading} className="btn-gold w-full text-lg py-4">
            {loading ? t.newGame.creating : t.newGame.create}
          </button>
        </form>
      </div>
    </main>
  );
}
