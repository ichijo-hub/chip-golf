'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Game, ChipDefinition, ChipType } from '@/types';
import ChipBadge from '@/components/ChipBadge';

interface EditingChip {
  id: string;
  name: string;
  chip_type: ChipType;
  is_active: boolean;
  point_value: number;
  image_url: string | null;
  chip_template_id: string | null;
  // テンプレート由来でない場合のみ画像アップロード・名前変更可
  previewUrl: string | null;
  pendingFile: File | null;
}

export default function ChipsManageClient() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string).toUpperCase();
  const supabase = useRef(createClient()).current;

  const [game, setGame] = useState<Game | null>(null);
  const [chips, setChips] = useState<ChipDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingChip | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newChipName, setNewChipName] = useState('');
  const [newChipType, setNewChipType] = useState<ChipType>('positive');
  const [adding, setAdding] = useState(false);

  const loadData = useCallback(async () => {
    const { data: gameData } = await supabase.from('games').select('*').eq('room_code', roomCode).single();
    if (!gameData) { setLoading(false); return; }
    const g = gameData as Game;
    setGame(g);
    const { data: chipsData } = await supabase
      .from('chip_definitions').select('*').eq('game_id', g.id).order('sort_order');
    setChips((chipsData ?? []) as ChipDefinition[]);
    setLoading(false);
  }, [roomCode, supabase]);

  useEffect(() => {
    const savedId = localStorage.getItem(`player_${roomCode}`);
    if (savedId) setMyPlayerId(savedId);
    loadData();
  }, [roomCode, loadData]);

  useEffect(() => {
    if (!loading && game && myPlayerId && myPlayerId !== game.host_player_id) {
      router.push(`/game/${roomCode}/lobby`);
    }
  }, [loading, game, myPlayerId, roomCode, router]);

  function openEdit(chip: ChipDefinition) {
    setEditing({
      id: chip.id, name: chip.name, chip_type: chip.chip_type,
      is_active: chip.is_active, point_value: chip.point_value,
      image_url: chip.image_url, chip_template_id: chip.chip_template_id,
      previewUrl: chip.image_url, pendingFile: null,
    });
    setError('');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    if (file.size > 2 * 1024 * 1024) { setError('画像は2MB以下にしてください'); return; }
    setEditing({ ...editing, pendingFile: file, previewUrl: URL.createObjectURL(file) });
    setError('');
  }

  async function uploadImage(chipId: string, file: File): Promise<string | null> {
    if (!game) return null;
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${game.id}/${chipId}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('chip-images').upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setError(`アップロード失敗: ${upErr.message}`); return null; }
    const { data } = supabase.storage.from('chip-images').getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setError('');

    let imageUrl = editing.image_url;
    // カスタムチップ（テンプレート由来でない）のみ画像アップロード可
    if (!editing.chip_template_id && editing.pendingFile) {
      imageUrl = await uploadImage(editing.id, editing.pendingFile);
      if (imageUrl === null) { setSaving(false); return; }
    }

    await supabase.from('chip_definitions').update({
      name: editing.chip_template_id ? editing.name : editing.name.trim(),
      is_active: editing.is_active,
      point_value: editing.point_value,
      ...(editing.chip_template_id ? {} : { image_url: imageUrl }),
    }).eq('id', editing.id);

    setSaving(false);
    setEditing(null);
    loadData();
  }

  async function handleDelete() {
    if (!editing) return;
    if (!confirm(`「${editing.name}」をこのゲームから削除しますか？`)) return;
    await supabase.from('chip_definitions').delete().eq('id', editing.id);
    setEditing(null);
    loadData();
  }

  async function handleAddChip() {
    if (!newChipName.trim() || !game) return;
    setAdding(true);
    const { data: newDef, error: defErr } = await supabase
      .from('chip_definitions').insert({
        game_id: game.id, name: newChipName.trim(),
        chip_type: newChipType, point_value: 1,
        chip_template_id: null, is_default: false, is_active: true, sort_order: chips.length,
      }).select().single();
    if (defErr || !newDef) { setAdding(false); return; }
    const typedDef = newDef as ChipDefinition;
    await supabase.from('chip_states').insert({ game_id: game.id, chip_definition_id: typedDef.id, holder_player_id: null });
    setNewChipName('');
    setAdding(false);
    loadData();
  }

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-green-400">読み込み中...</p></main>;
  }

  const positiveChips = chips.filter(c => c.chip_type === 'positive');
  const negativeChips = chips.filter(c => c.chip_type === 'negative');

  return (
    <>
      {editing && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4" onClick={() => setEditing(null)}>
          <div className="card-casino w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[#d4af37] font-bold text-lg">チップを編集</p>
              <button onClick={() => setEditing(null)} className="text-green-400 text-2xl leading-none">✕</button>
            </div>

            <div className="flex justify-center mb-4">
              <ChipBadge name={editing.name} chipType={editing.chip_type} imageUrl={editing.previewUrl} size={80} />
            </div>

            <div className="space-y-3">
              {/* テンプレート由来でない場合のみ名前編集可 */}
              {!editing.chip_template_id && (
                <input type="text" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                  placeholder="チップ名" maxLength={20}
                  className="w-full bg-[#0a3d20] border border-green-700 rounded-lg px-4 py-3
                             text-white placeholder-green-600 focus:outline-none focus:border-[#d4af37]" />
              )}
              {editing.chip_template_id && (
                <p className="text-green-600 text-sm">名前・画像はグローバル設定（<button type="button" onClick={() => router.push('/chips')} className="underline text-green-500">チップ管理</button>）で変更できます</p>
              )}

              {/* ポイント値 */}
              <div>
                <p className="text-green-400 text-sm mb-2">ポイント値</p>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setEditing({ ...editing, point_value: Math.max(1, editing.point_value - 1) })}
                    className="w-10 h-10 rounded-full bg-[#0a3d20] border border-green-700 text-white text-xl font-bold hover:border-[#d4af37] transition-colors">－</button>
                  <span className="text-2xl font-bold text-white w-8 text-center">{editing.point_value}</span>
                  <button type="button" onClick={() => setEditing({ ...editing, point_value: Math.min(10, editing.point_value + 1) })}
                    className="w-10 h-10 rounded-full bg-[#0a3d20] border border-green-700 text-white text-xl font-bold hover:border-[#d4af37] transition-colors">＋</button>
                  <span className="text-green-500 text-sm">
                    {editing.chip_type === 'positive' ? `+${editing.point_value}` : `-${editing.point_value}`} pt
                  </span>
                </div>
              </div>

              {/* カスタムチップのみ画像アップロード可 */}
              {!editing.chip_template_id && (
                <div>
                  <p className="text-green-400 text-sm mb-2">チップ画像（任意）</p>
                  {editing.previewUrl && (
                    <div className="flex items-center gap-2 mb-2">
                      <img src={editing.previewUrl} alt="preview" className="w-12 h-12 rounded-full object-cover border-2 border-green-700" />
                      <button type="button" onClick={() => setEditing({ ...editing, image_url: null, previewUrl: null, pendingFile: null })}
                        className="text-red-400 text-sm hover:text-red-300">画像を削除</button>
                    </div>
                  )}
                  <label className="block w-full py-2 px-4 rounded-lg border border-dashed border-green-700
                                    text-green-400 text-sm text-center cursor-pointer hover:border-[#d4af37] hover:text-[#d4af37] transition-colors">
                    {editing.previewUrl ? '画像を変更' : '画像をアップロード'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>
              )}

              {/* 有効/無効 */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setEditing({ ...editing, is_active: !editing.is_active })}
                  className={`w-11 h-6 rounded-full transition-colors relative ${editing.is_active ? 'bg-green-600' : 'bg-green-900'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${editing.is_active ? 'left-5' : 'left-0.5'}`} />
                </div>
                <span className="text-green-300 text-sm">{editing.is_active ? '有効' : '無効'}</span>
              </label>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="btn-gold flex-1 py-3">
                  {saving ? '保存中...' : '保存'}
                </button>
                {!editing.chip_template_id && (
                  <button onClick={handleDelete}
                    className="px-4 py-3 rounded-lg bg-red-900 border border-red-700 text-red-300 hover:bg-red-800 transition-colors text-sm">
                    削除
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="min-h-screen p-4 pb-24">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-6 pt-4">
            <button onClick={() => router.push(`/game/${roomCode}/lobby`)} className="text-green-400 hover:text-[#d4af37] transition-colors">← ロビー</button>
            <h1 className="text-2xl font-bold text-[#d4af37]">このゲームのチップ</h1>
          </div>
          <p className="text-green-600 text-sm mb-4">有効/無効の切替とポイント値はゲームごとに変更できます</p>

          <div className="card-casino mb-4">
            <p className="text-green-400 font-semibold mb-3">ポジティブチップ</p>
            <div className="space-y-2">
              {positiveChips.map(c => <ChipRow key={c.id} chip={c} onEdit={() => openEdit(c)} />)}
              {positiveChips.length === 0 && <p className="text-green-700 text-sm">なし</p>}
            </div>
          </div>

          <div className="card-casino mb-4">
            <p className="text-red-400 font-semibold mb-3">ネガティブチップ</p>
            <div className="space-y-2">
              {negativeChips.map(c => <ChipRow key={c.id} chip={c} onEdit={() => openEdit(c)} />)}
              {negativeChips.length === 0 && <p className="text-green-700 text-sm">なし</p>}
            </div>
          </div>

          <div className="card-casino mb-4">
            <p className="text-[#d4af37] font-semibold mb-3">このゲーム限定チップを追加</p>
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
              <input type="text" value={newChipName} onChange={e => setNewChipName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddChip())}
                placeholder="チップ名" maxLength={20}
                className="flex-1 bg-[#0a3d20] border border-green-700 rounded-lg px-3 py-2
                           text-white placeholder-green-600 focus:outline-none focus:border-[#d4af37] text-sm" />
              <button type="button" onClick={handleAddChip} disabled={!newChipName.trim() || adding}
                className="px-4 py-2 rounded-lg bg-[#d4af37] text-[#1a1a1a] font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                追加
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function ChipRow({ chip, onEdit }: { chip: ChipDefinition; onEdit: () => void }) {
  const isPos = chip.chip_type === 'positive';
  return (
    <div className={`flex items-center gap-3 rounded-lg px-3 py-2 ${chip.is_active ? 'bg-[#0a3d20]' : 'bg-[#071f10] opacity-60'}`}>
      <ChipBadge name={chip.name} chipType={chip.chip_type} imageUrl={chip.image_url} size={48} />
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${chip.is_active ? 'text-white' : 'text-green-700'}`}>{chip.name}</p>
        <p className={`text-xs ${isPos ? 'text-green-500' : 'text-red-400'}`}>
          {isPos ? '+' : '-'}{chip.point_value} pt · {chip.is_active ? '有効' : '無効'}
        </p>
      </div>
      <button onClick={onEdit} className="text-sm text-green-400 hover:text-[#d4af37] transition-colors shrink-0 px-2 py-1">編集</button>
    </div>
  );
}
