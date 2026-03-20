'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { generateRoomCode } from '@/lib/roomCode';
import { Game, Player, ChipTemplate, ChipDefinition, ChipType } from '@/types';
import { saveToHistory } from '@/lib/gameHistory';

interface ChipSelection {
  active: boolean;
  pointValue: number;
}

interface CustomChip {
  name: string;
  chip_type: ChipType;
  point_value: number;
}

export default function NewGameClient() {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const [hostName, setHostName] = useState('');
  const [templates, setTemplates] = useState<ChipTemplate[]>([]);
  const [selections, setSelections] = useState<Record<string, ChipSelection>>({});
  const [customChips, setCustomChips] = useState<CustomChip[]>([]);
  const [newChipName, setNewChipName] = useState('');
  const [newChipType, setNewChipType] = useState<ChipType>('positive');
  const [loading, setLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [error, setError] = useState('');

  const loadTemplates = useCallback(async () => {
    const { data } = await supabase.from('chip_templates').select('*').order('sort_order');
    const tmpl = (data ?? []) as ChipTemplate[];
    setTemplates(tmpl);
    const init: Record<string, ChipSelection> = {};
    tmpl.forEach(t => { init[t.id] = { active: true, pointValue: t.default_point_value }; });
    setSelections(init);
    setLoadingTemplates(false);
  }, [supabase]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  function toggleTemplate(id: string) {
    setSelections(prev => ({ ...prev, [id]: { ...prev[id], active: !prev[id].active } }));
  }

  function setPointValue(id: string, val: number) {
    setSelections(prev => ({ ...prev, [id]: { ...prev[id], pointValue: Math.max(1, Math.min(10, val)) } }));
  }

  function addCustomChip() {
    if (!newChipName.trim()) return;
    setCustomChips(prev => [...prev, { name: newChipName.trim(), chip_type: newChipType, point_value: 1 }]);
    setNewChipName('');
  }

  function removeCustomChip(index: number) {
    setCustomChips(prev => prev.filter((_, i) => i !== index));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!hostName.trim()) { setError('ホスト名を入力してください'); return; }
    const selectedTemplates = templates.filter(t => selections[t.id]?.active);
    if (selectedTemplates.length === 0 && customChips.length === 0) {
      setError('チップを1枚以上選択してください'); return;
    }
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

      const chipInserts = [
        ...selectedTemplates.map((t, i) => ({
          game_id: typedGame.id,
          chip_template_id: t.id,
          name: t.name,
          chip_type: t.chip_type,
          point_value: selections[t.id].pointValue,
          image_url: t.image_url,
          is_default: true,
          is_active: true,
          sort_order: i,
        })),
        ...customChips.map((c, i) => ({
          game_id: typedGame.id,
          chip_template_id: null,
          name: c.name,
          chip_type: c.chip_type,
          point_value: c.point_value,
          image_url: null,
          is_default: false,
          is_active: true,
          sort_order: selectedTemplates.length + i,
        })),
      ];

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

  const positiveTemplates = templates.filter(t => t.chip_type === 'positive');
  const negativeTemplates = templates.filter(t => t.chip_type === 'negative');

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
              className="w-full bg-[#0a3d20] border border-green-700 rounded-lg px-4 py-3
                         text-white placeholder-green-600 focus:outline-none focus:border-[#d4af37]"
            />
          </div>

          <div className="card-casino">
            <div className="flex items-center justify-between mb-4">
              <label className="text-[#d4af37] font-semibold">使用するチップ</label>
              <button type="button" onClick={() => router.push('/chips')}
                className="text-xs text-green-500 hover:text-[#d4af37] transition-colors">
                チップを管理 →
              </button>
            </div>

            {loadingTemplates ? (
              <p className="text-green-500 text-sm">読み込み中...</p>
            ) : (
              <>
                <div className="mb-4">
                  <p className="text-green-400 text-sm font-medium mb-2">ポジティブ</p>
                  <div className="space-y-2">
                    {positiveTemplates.map(t => (
                      <TemplateSelectRow
                        key={t.id} template={t}
                        selection={selections[t.id] ?? { active: false, pointValue: t.default_point_value }}
                        onToggle={() => toggleTemplate(t.id)}
                        onPointChange={v => setPointValue(t.id, v)}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-red-400 text-sm font-medium mb-2">ネガティブ</p>
                  <div className="space-y-2">
                    {negativeTemplates.map(t => (
                      <TemplateSelectRow
                        key={t.id} template={t}
                        selection={selections[t.id] ?? { active: false, pointValue: t.default_point_value }}
                        onToggle={() => toggleTemplate(t.id)}
                        onPointChange={v => setPointValue(t.id, v)}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="card-casino">
            <label className="block text-[#d4af37] font-semibold mb-4">このゲーム限定のカスタムチップ</label>
            {customChips.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {customChips.map((c, i) => (
                  <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border
                    ${c.chip_type === 'positive' ? 'bg-green-800 border-green-500 text-green-200' : 'bg-red-900 border-red-700 text-red-200'}`}>
                    <span>{c.name}（{c.chip_type === 'positive' ? '+' : '-'}{c.point_value}）</span>
                    <button type="button" onClick={() => removeCustomChip(i)} className="opacity-70 hover:opacity-100 ml-1">✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setNewChipType('positive')}
                className={`px-3 py-2 rounded-lg text-sm font-bold border transition-colors
                  ${newChipType === 'positive' ? 'bg-green-700 border-green-500 text-white' : 'bg-[#0a3d20] border-green-900 text-green-600'}`}>
                ＋
              </button>
              <button type="button" onClick={() => setNewChipType('negative')}
                className={`px-3 py-2 rounded-lg text-sm font-bold border transition-colors
                  ${newChipType === 'negative' ? 'bg-red-900 border-red-700 text-white' : 'bg-[#0a3d20] border-green-900 text-green-600'}`}>
                －
              </button>
              <input
                type="text" value={newChipName} onChange={e => setNewChipName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomChip())}
                placeholder="チップ名" maxLength={20}
                className="flex-1 bg-[#0a3d20] border border-green-700 rounded-lg px-3 py-2
                           text-white placeholder-green-600 focus:outline-none focus:border-[#d4af37] text-sm"
              />
              <button type="button" onClick={addCustomChip} disabled={!newChipName.trim()}
                className="px-4 py-2 rounded-lg bg-[#d4af37] text-[#1a1a1a] font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                追加
              </button>
            </div>
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

function TemplateSelectRow({
  template, selection, onToggle, onPointChange,
}: {
  template: ChipTemplate;
  selection: ChipSelection;
  onToggle: () => void;
  onPointChange: (v: number) => void;
}) {
  const isPos = template.chip_type === 'positive';
  return (
    <div className={`flex items-center gap-3 rounded-lg px-3 py-2 border transition-colors
      ${selection.active
        ? isPos ? 'bg-green-900/50 border-green-700' : 'bg-red-900/30 border-red-800'
        : 'bg-[#0a3d20] border-green-900 opacity-50'}`}
    >
      {/* チップ画像プレビュー */}
      {template.image_url ? (
        <img src={template.image_url} alt={template.name}
          className="w-9 h-9 rounded-full object-cover border-2 border-green-700 shrink-0" />
      ) : (
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
          ${isPos ? 'bg-green-800 text-[#d4af37]' : 'bg-red-900 text-red-300'}`}>
          {template.name[0]}
        </div>
      )}

      <button type="button" onClick={onToggle} className="flex-1 text-left">
        <span className={`font-medium text-sm ${selection.active ? 'text-white' : 'text-green-700'}`}>{template.name}</span>
      </button>

      {/* ポイント値 */}
      {selection.active && (
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => onPointChange(selection.pointValue - 1)}
            className="w-6 h-6 rounded-full bg-[#0a3d20] border border-green-700 text-white text-sm font-bold flex items-center justify-center hover:border-[#d4af37]">
            −
          </button>
          <span className={`w-8 text-center font-bold text-sm ${isPos ? 'text-[#d4af37]' : 'text-red-300'}`}>
            {isPos ? '+' : '-'}{selection.pointValue}
          </span>
          <button type="button" onClick={() => onPointChange(selection.pointValue + 1)}
            className="w-6 h-6 rounded-full bg-[#0a3d20] border border-green-700 text-white text-sm font-bold flex items-center justify-center hover:border-[#d4af37]">
            ＋
          </button>
        </div>
      )}

      {/* トグル */}
      <button type="button" onClick={onToggle}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
          ${selection.active ? isPos ? 'bg-green-600 border-green-500' : 'bg-red-700 border-red-600' : 'border-green-800 bg-transparent'}`}>
        {selection.active && <span className="text-white text-xs">✓</span>}
      </button>
    </div>
  );
}
