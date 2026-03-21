'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { generateRoomCode } from '@/lib/roomCode';
import { Game, Player, ChipTemplate, ChipDefinition } from '@/types';
import { saveToHistory } from '@/lib/gameHistory';

export default function NewGameClient() {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const [hostName, setHostName] = useState('');
  const [templates, setTemplates] = useState<ChipTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadTemplates = useCallback(async () => {
    const { data } = await supabase.from('chip_templates').select('*').eq('is_active', true).order('sort_order');
    setTemplates((data ?? []) as ChipTemplate[]);
  }, [supabase]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!hostName.trim()) { setError('ホスト名を入力してください'); return; }
    if (templates.length === 0) { setError('使用できるチップがありません。チップ管理からチップを追加してください。'); return; }
    setLoading(true);
    setError('');

    try {
      const roomCode = generateRoomCode();
      const { data: game, error: gameError } = await supabase
        .from('games').insert({ room_code: roomCode, status: 'lobby' }).select().single();
      if (gameError || !game) throw gameError ?? new Error('ゲーム作成失敗');
      const typedGame = game as Game;

      const { data: player, error: playerError } = await supabase
        .from('players').insert({ game_id: typedGame.id, name: hostName.trim(), display_order: 0, is_host: true })
        .select().single();
      if (playerError || !player) throw playerError ?? new Error('プレイヤー作成失敗');
      const typedPlayer = player as Player;

      await supabase.from('games').update({ host_player_id: typedPlayer.id }).eq('id', typedGame.id);

      const chipInserts = templates.map((t, i) => ({
        game_id: typedGame.id,
        chip_template_id: t.id,
        name: t.name,
        chip_type: t.chip_type,
        point_value: t.default_point_value,
        image_url: t.image_url,
        is_default: true,
        is_active: true,
        sort_order: i,
      }));

      const { data: chipDefs, error: chipDefError } = await supabase
        .from('chip_definitions').insert(chipInserts).select();
      if (chipDefError || !chipDefs) throw chipDefError ?? new Error('チップ定義作成失敗');

      const chipStateInserts = (chipDefs as ChipDefinition[]).map(cd => ({
        game_id: typedGame.id, chip_definition_id: cd.id, holder_player_id: null,
      }));
      const { error: chipStateError } = await supabase.from('chip_states').insert(chipStateInserts);
      if (chipStateError) throw chipStateError;

      localStorage.setItem(`player_${roomCode}`, typedPlayer.id);
      saveToHistory(roomCode);
      router.push(`/game/${roomCode}/lobby`);
    } catch (err) {
      console.error(err);
      setError('ゲームの作成に失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-4 pb-24">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6 pt-4">
          <button onClick={() => router.push('/')} className="text-green-400 hover:text-[#d4af37] transition-colors">← 戻る</button>
          <h1 className="text-2xl font-bold text-[#d4af37]">ゲーム作成</h1>
        </div>

        <form onSubmit={handleCreate} className="space-y-6">
          <div className="card-casino">
            <label className="block text-[#d4af37] font-semibold mb-2">あなたの名前（ホスト）</label>
            <input
              type="text" value={hostName} onChange={e => setHostName(e.target.value)}
              placeholder="名前を入力" maxLength={20}
              className="w-full bg-[#145a32] border border-green-700 rounded-lg px-4 py-3
                         text-white placeholder-green-600 focus:outline-none focus:border-[#d4af37]"
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button type="submit" disabled={loading} className="btn-gold w-full text-lg py-4">
            {loading ? '作成中...' : 'ゲームを作成'}
          </button>
        </form>
      </div>
    </main>
  );
}
