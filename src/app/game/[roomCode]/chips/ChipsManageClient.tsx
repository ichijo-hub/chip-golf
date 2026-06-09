'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  doc, getDoc, collection, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, setDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/client';
import { Game, ChipDefinition, ChipType } from '@/types';
import { getDeviceId } from '@/lib/deviceId';
import { saveChipToLibrary } from '@/lib/chipLibrary';
import ChipBadge from '@/components/ChipBadge';
import { useT } from '@/lib/i18n';
import { chipNamesEn, chipConditionsEn } from '@/lib/i18n/chipNames';

interface LibraryChip {
  name: string;
  chip_type: ChipType;
  point_value: number;
  image_url: string | null;
  image_scale: number | null;
  image_offset_y: number | null;
  condition: string | null;
  deleted?: boolean;
}

interface EditingChip {
  id: string;
  name: string;
  chip_type: ChipType;
  is_active: boolean;
  point_value: number;
  image_url: string | null;
  image_scale: number;
  image_offset_y: number;
  condition: string;
  chip_template_id: string | null;
  previewUrl: string | null;
  pendingFile: File | null;
}

export default function ChipsManageClient() {
  const params = useParams();
  const router = useRouter();
  const [roomCode] = useState(() => {
    const fromStorage = typeof localStorage !== 'undefined' ? localStorage.getItem('currentRoomCode') : null;
    const fromSearch = new URLSearchParams(window.location.search).get('room');
    const fromParams = params?.roomCode as string | undefined;
    const code = fromSearch || fromStorage || (fromParams && fromParams !== '__placeholder__' ? fromParams : '');
    return (code || '').toUpperCase();
  });

  const { t, locale } = useT();
  const [game, setGame] = useState<Game | null>(null);
  const [chips, setChips] = useState<ChipDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSpectator, setIsSpectator] = useState(false);
  const [libraryChips, setLibraryChips] = useState<LibraryChip[]>([]);
  const [deletedChips, setDeletedChips] = useState<LibraryChip[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [libraryModal, setLibraryModal] = useState<{ chip: LibraryChip; isDeleted: boolean } | null>(null);
  const [editing, setEditing] = useState<EditingChip | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newChipName, setNewChipName] = useState('');
  const [newChipType, setNewChipType] = useState<ChipType>('positive');
  const [newChipPoints, setNewChipPoints] = useState(1);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadData = useCallback(async () => {
    if (!roomCode) { router.push('/'); return; }
    const savedId = localStorage.getItem(`player_${roomCode}`);
    const [gameSnap, chipsSnap] = await Promise.all([
      getDoc(doc(db, 'games', roomCode)),
      getDocs(query(collection(db, 'games', roomCode, 'chip_definitions'), orderBy('sort_order'))),
    ]);
    if (!gameSnap.exists()) { setLoading(false); return; }
    const g = { id: gameSnap.id, ...gameSnap.data() } as Game;
    setGame(g);
    const currentChips = chipsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ChipDefinition));
    setChips(currentChips);
    if (savedId) {
      const playerSnap = await getDoc(doc(db, 'games', roomCode, 'players', savedId));
      if (playerSnap.exists()) {
        setIsSpectator(!!(playerSnap.data() as { is_spectator?: boolean }).is_spectator);
      }
    }
    setLoading(false);
    loadLibrary(currentChips);
  }, [roomCode]);

  useEffect(() => {
    loadData();
  }, [roomCode, loadData]);

  useEffect(() => {
    if (!loading && game && isSpectator) {
      const dest = game.status === 'playing' ? `/game/__placeholder__/play?room=${roomCode}` : `/game/__placeholder__/lobby?room=${roomCode}`;
      localStorage.setItem('currentRoomCode', roomCode);
      router.push(dest);
    }
  }, [loading, game, isSpectator, roomCode, router]);

  async function loadLibrary(currentChips: ChipDefinition[]) {
    setLibraryLoading(true);
    try {
      const deviceId = await getDeviceId();
      const snap = await getDocs(collection(db, 'device_data', deviceId, 'chip_library'));
      const currentKeys = new Set(
        currentChips.filter(c => !c.chip_template_id).map(c => `${c.name}__${c.chip_type}`)
      );
      const all = snap.docs.map(d => d.data() as LibraryChip);
      setLibraryChips(all.filter(c => !c.deleted && !currentKeys.has(`${c.name}__${c.chip_type}`)));
      setDeletedChips(all.filter(c => c.deleted));
    } catch {
      // ライブラリ読み込み失敗は無視
    } finally {
      setLibraryLoading(false);
    }
  }

  async function handleDeleteLibraryChip(chip: LibraryChip) {
    try {
      const deviceId = await getDeviceId();
      const key = `${chip.name}__${chip.chip_type}`;
      await setDoc(doc(db, 'device_data', deviceId, 'chip_library', key), { deleted: true }, { merge: true });
      setLibraryChips(prev => prev.filter(c => !(c.name === chip.name && c.chip_type === chip.chip_type)));
      setDeletedChips(prev => [...prev, { ...chip, deleted: true }]);
    } catch { /* 無視 */ }
    setLibraryModal(null);
  }

  async function handleRestoreLibraryChip(chip: LibraryChip) {
    try {
      const deviceId = await getDeviceId();
      const key = `${chip.name}__${chip.chip_type}`;
      await setDoc(doc(db, 'device_data', deviceId, 'chip_library', key), { deleted: false }, { merge: true });
      setDeletedChips(prev => prev.filter(c => !(c.name === chip.name && c.chip_type === chip.chip_type)));
      setLibraryChips(prev => [...prev, { ...chip, deleted: false }]);
    } catch { /* 無視 */ }
    setLibraryModal(null);
  }

  async function handlePermanentDeleteLibraryChip(chip: LibraryChip) {
    try {
      const deviceId = await getDeviceId();
      const key = `${chip.name}__${chip.chip_type}`;
      await deleteDoc(doc(db, 'device_data', deviceId, 'chip_library', key));
      setDeletedChips(prev => prev.filter(c => !(c.name === chip.name && c.chip_type === chip.chip_type)));
    } catch { /* 無視 */ }
    setLibraryModal(null);
  }

  async function saveToLibrary(chip: ChipDefinition) {
    saveChipToLibrary(chip).catch(() => {});
  }

  async function handleAddAllFromLibrary() {
    for (const chip of libraryChips) {
      await handleAddFromLibrary(chip);
    }
  }

  async function handleAddFromLibrary(chip: LibraryChip) {
    if (!game) return;
    const chipDefRef = await addDoc(collection(db, 'games', roomCode, 'chip_definitions'), {
      id: '', game_id: roomCode, name: chip.name,
      chip_type: chip.chip_type, point_value: chip.point_value,
      chip_template_id: null, is_default: false, is_active: true,
      sort_order: chips.length,
      image_url: chip.image_url ?? null,
      image_scale: chip.image_scale ?? null,
      image_offset_y: chip.image_offset_y ?? null,
      condition: chip.condition ?? null,
    });
    await updateDoc(chipDefRef, { id: chipDefRef.id });
    const stateRef = await addDoc(collection(db, 'games', roomCode, 'chip_states'), {
      id: '', game_id: roomCode, chip_definition_id: chipDefRef.id,
      holder_player_id: null, updated_at: new Date().toISOString(),
    });
    await updateDoc(stateRef, { id: stateRef.id });
    loadData();
  }

  function openEdit(chip: ChipDefinition) {
    setEditing({
      id: chip.id, name: chip.name, chip_type: chip.chip_type,
      is_active: chip.is_active, point_value: chip.point_value,
      image_url: chip.image_url, image_scale: chip.image_scale ?? 1.5, image_offset_y: chip.image_offset_y ?? 40,
      condition: chip.condition ?? '', chip_template_id: chip.chip_template_id,
      previewUrl: chip.image_url, pendingFile: null,
    });
    setError('');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    if (file.size > 2 * 1024 * 1024) { setError(t.common.fileTooLarge); return; }
    setEditing({ ...editing, pendingFile: file, previewUrl: URL.createObjectURL(file) });
    setError('');
  }

  async function uploadImage(chipId: string, file: File): Promise<string | null> {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${roomCode}/${chipId}.${ext}`;
    const storageRef = ref(storage, path);
    try {
      await uploadBytes(storageRef, file, { contentType: file.type });
      return await getDownloadURL(storageRef);
    } catch (e: unknown) {
      setError(t.common.uploadFailed.replace('{{error}}', e instanceof Error ? e.message : String(e)));
      return null;
    }
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setError('');

    let imageUrl = editing.image_url;
    if (!editing.chip_template_id && editing.pendingFile) {
      imageUrl = await uploadImage(editing.id, editing.pendingFile);
      if (imageUrl === null) { setSaving(false); return; }
    }

    await updateDoc(doc(db, 'games', roomCode, 'chip_definitions', editing.id), {
      name: editing.chip_template_id ? editing.name : editing.name.trim(),
      is_active: editing.is_active,
      point_value: editing.point_value,
      image_scale: editing.image_scale,
      image_offset_y: editing.image_offset_y,
      condition: editing.condition.trim() || null,
      ...(editing.chip_template_id ? {} : { image_url: imageUrl }),
    });

    // 限定チップをライブラリに保存（失敗しても無視）
    if (!editing.chip_template_id) {
      const saved: ChipDefinition = {
        id: editing.id, game_id: roomCode, name: editing.name.trim(),
        chip_type: editing.chip_type, point_value: editing.point_value,
        image_url: imageUrl, image_scale: editing.image_scale,
        image_offset_y: editing.image_offset_y, condition: editing.condition.trim() || null,
        chip_template_id: null, is_default: false, is_active: editing.is_active, sort_order: 0,
      };
      saveToLibrary(saved);
    }
    setSaving(false);
    setEditing(null);
    loadData();
  }

  async function handleDelete() {
    if (!editing) return;
    // Delete all chip_states for this chip_definition
    const statesSnap = await getDocs(collection(db, 'games', roomCode, 'chip_states'));
    const toDelete = statesSnap.docs.filter(d => d.data().chip_definition_id === editing.id);
    await Promise.all(toDelete.map(d => deleteDoc(d.ref)));
    await deleteDoc(doc(db, 'games', roomCode, 'chip_definitions', editing.id));
    setEditing(null);
    setConfirmDelete(false);
    loadData();
  }

  async function toggleChipActive(chip: ChipDefinition) {
    await updateDoc(doc(db, 'games', roomCode, 'chip_definitions', chip.id), { is_active: !chip.is_active });
    loadData();
  }

  async function handleAddChip() {
    if (!newChipName.trim() || !game) return;
    setAdding(true);
    const chipDefRef = await addDoc(collection(db, 'games', roomCode, 'chip_definitions'), {
      id: '', game_id: roomCode, name: newChipName.trim(),
      chip_type: newChipType, point_value: newChipPoints,
      chip_template_id: null, is_default: false, is_active: true,
      sort_order: chips.length, image_url: null,
    });
    await updateDoc(chipDefRef, { id: chipDefRef.id });
    const stateRef = await addDoc(collection(db, 'games', roomCode, 'chip_states'), {
      id: '', game_id: roomCode, chip_definition_id: chipDefRef.id,
      holder_player_id: null, updated_at: new Date().toISOString(),
    });
    await updateDoc(stateRef, { id: stateRef.id });
    // 限定チップをライブラリに保存
    saveToLibrary({
      id: chipDefRef.id, game_id: roomCode, name: newChipName.trim(),
      chip_type: newChipType, point_value: newChipPoints,
      chip_template_id: null, is_default: false, is_active: true,
      sort_order: chips.length, image_url: null,
      image_scale: null, image_offset_y: null, condition: null,
    });
    setNewChipName('');
    setAdding(false);
    loadData();
  }

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-green-400">{t.common.loading}</p></main>;
  }

  const positiveChips = chips.filter(c => c.chip_type === 'positive').sort((a, b) => b.point_value - a.point_value);
  const negativeChips = chips.filter(c => c.chip_type === 'negative').sort((a, b) => b.point_value - a.point_value);

  return (
    <>
      {libraryModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4" onClick={() => setLibraryModal(null)}>
          <div className="card-casino w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-4">
              <div className={libraryModal.isDeleted ? 'opacity-40' : ''}>
                <ChipBadge
                  name={libraryModal.chip.name}
                  chipType={libraryModal.chip.chip_type}
                  imageUrl={libraryModal.chip.image_url}
                  imageScale={libraryModal.chip.image_scale ?? undefined}
                  imageOffsetY={libraryModal.chip.image_offset_y ?? undefined}
                  pointValue={libraryModal.chip.point_value}
                  size={96}
                  isCustom={true}
                />
              </div>
            </div>
            <div className="space-y-2">
              {libraryModal.isDeleted ? (
                <>
                  <button
                    onClick={() => handleRestoreLibraryChip(libraryModal.chip)}
                    className="btn-gold w-full py-3"
                  >
                    {t.chipsManage.restoreFromLibrary}
                  </button>
                  <button
                    onClick={() => handlePermanentDeleteLibraryChip(libraryModal.chip)}
                    className="w-full py-3 rounded-lg border border-red-800 text-red-400 hover:border-red-600 hover:text-red-300 transition-colors"
                  >
                    {t.chipsManage.permanentDelete}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { handleAddFromLibrary(libraryModal.chip); setLibraryModal(null); }}
                    className="btn-gold w-full py-3"
                  >
                    {t.common.add}
                  </button>
                  <button
                    onClick={() => handleDeleteLibraryChip(libraryModal.chip)}
                    className="w-full py-3 rounded-lg border border-red-800 text-red-400 hover:border-red-600 hover:text-red-300 transition-colors"
                  >
                    {t.chipsManage.deleteFromLibrary}
                  </button>
                </>
              )}
              <button
                onClick={() => setLibraryModal(null)}
                className="w-full py-3 rounded-lg border border-green-800 text-green-500 hover:border-green-600 transition-colors"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4" onClick={() => { setEditing(null); setConfirmDelete(false); }}>
          <div className="card-casino w-full max-w-md overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[#d4af37] font-bold text-lg">{t.chipsManage.editTitle}</p>
              <button onClick={() => { setEditing(null); setConfirmDelete(false); }} className="text-green-400 text-2xl leading-none">{t.common.close}</button>
            </div>

            <div className="flex justify-center mb-4">
              <ChipBadge name={editing.name} chipType={editing.chip_type} imageUrl={editing.previewUrl} imageScale={editing.image_scale} imageOffsetY={editing.image_offset_y} size={120} />
            </div>

            <div className="space-y-3">
              {!editing.chip_template_id && (
                <input type="text" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                  placeholder={t.common.chipName} maxLength={20}
                  className="w-full bg-[#145a32] border border-green-700 rounded-lg px-4 py-3
                             text-white placeholder-green-600 focus:outline-none focus:border-[#d4af37]" />
              )}
              {editing.chip_template_id && (
                <p className="text-green-600 text-sm">{t.chipsManage.templateNote}</p>
              )}

              <textarea
                value={locale === 'en' ? (chipConditionsEn[editing.condition] ?? editing.condition) : editing.condition}
                onChange={e => setEditing({ ...editing, condition: e.target.value })}
                placeholder={t.common.condition} maxLength={100} rows={2}
                className="w-full bg-[#145a32] border border-green-700 rounded-lg px-4 py-3
                           text-white placeholder-green-600 focus:outline-none focus:border-[#d4af37] text-sm resize-none"
              />

              <div>
                <p className="text-green-400 text-sm mb-2">{t.common.pointValue}</p>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setEditing({ ...editing, point_value: Math.max(1, editing.point_value - 1) })}
                    className="w-10 h-10 rounded-full bg-[#145a32] border border-green-700 text-white text-xl font-bold hover:border-[#d4af37] transition-colors">－</button>
                  <span className="text-2xl font-bold text-white w-8 text-center">{editing.point_value}</span>
                  <button type="button" onClick={() => setEditing({ ...editing, point_value: Math.min(10, editing.point_value + 1) })}
                    className="w-10 h-10 rounded-full bg-[#145a32] border border-green-700 text-white text-xl font-bold hover:border-[#d4af37] transition-colors">＋</button>
                  <span className="text-green-500 text-sm">
                    {editing.chip_type === 'positive' ? `+${editing.point_value}` : `-${editing.point_value}`} pt
                  </span>
                </div>
              </div>

              {!editing.chip_template_id && (
                <div>
                  <p className="text-green-400 text-sm mb-2">{t.common.chipImage}</p>
                  {editing.previewUrl && (
                    <div className="flex items-center gap-2 mb-2">
                      <img src={editing.previewUrl} alt="preview" className="w-12 h-12 rounded-full object-cover border-2 border-green-700" />
                      <button type="button" onClick={() => setEditing({ ...editing, image_url: null, previewUrl: null, pendingFile: null })}
                        className="text-red-400 text-sm hover:text-red-300">{t.common.deleteImage}</button>
                    </div>
                  )}
                  <label className="block w-full py-2 px-4 rounded-lg border border-dashed border-green-700
                                    text-green-400 text-sm text-center cursor-pointer hover:border-[#d4af37] hover:text-[#d4af37] transition-colors">
                    {editing.previewUrl ? t.common.changeImage : t.common.uploadImage}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>
              )}

              {editing.previewUrl && (
                <div className="space-y-2 border border-green-800 rounded-lg px-3 py-3">
                  <p className="text-green-400 text-xs font-semibold">{t.common.imageAdjustment}</p>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-green-500 text-xs">{t.common.imageScale}</label>
                      <span className="text-green-300 text-xs">{editing.image_scale.toFixed(1)}x</span>
                    </div>
                    <input type="range" min="1.0" max="3.0" step="0.1"
                      value={editing.image_scale}
                      onChange={e => setEditing({ ...editing, image_scale: parseFloat(e.target.value) })}
                      className="w-full accent-[#d4af37]" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-green-500 text-xs">{t.common.imageOffsetY}</label>
                      <span className="text-green-300 text-xs">{editing.image_offset_y}%</span>
                    </div>
                    <input type="range" min="0" max="100" step="1"
                      value={editing.image_offset_y}
                      onChange={e => setEditing({ ...editing, image_offset_y: parseInt(e.target.value) })}
                      className="w-full accent-[#d4af37]" />
                  </div>
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setEditing({ ...editing, is_active: !editing.is_active })}
                  className={`w-11 h-6 rounded-full transition-colors relative ${editing.is_active ? 'bg-green-600' : 'bg-green-900'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${editing.is_active ? 'left-5' : 'left-0.5'}`} />
                </div>
                <span className="text-green-300 text-sm">{editing.is_active ? t.common.enabled : t.common.disabled}</span>
              </label>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              {confirmDelete ? (
                <div className="space-y-2">
                  <p className="text-red-300 text-sm text-center">{t.chipsManage.confirmDelete.replace('{{name}}', editing.name)}</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDelete(false)}
                      className="flex-1 py-3 rounded-lg bg-[#145a32] border border-green-700 text-green-300">{t.common.cancel}</button>
                    <button onClick={handleDelete}
                      className="flex-1 py-3 rounded-lg bg-red-900 border border-red-700 text-red-300 font-bold">{t.chipsManage.deleteButton}</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={saving} className="btn-gold flex-1 py-3">
                    {saving ? t.common.saving : t.common.save}
                  </button>
                  {!editing.chip_template_id && (
                    <button onClick={() => setConfirmDelete(true)}
                      className="px-4 py-3 rounded-lg bg-red-900 border border-red-700 text-red-300 hover:bg-red-800 transition-colors text-sm">
                      {t.common.delete}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="min-h-screen p-4 pb-24" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-6 pt-4">
            <button onClick={() => { localStorage.setItem('currentRoomCode', roomCode); router.push(game?.status === 'playing' ? `/game/__placeholder__/play?room=${roomCode}` : `/game/__placeholder__/lobby?room=${roomCode}`); }} className="text-green-400 hover:text-[#d4af37] transition-colors">
              {game?.status === 'playing' ? t.chipsManage.backToGame : t.chipsManage.backToLobby}
            </button>
            <h1 className="text-2xl font-bold text-[#d4af37]">{t.chipsManage.title}</h1>
          </div>
          <p className="text-green-600 text-sm mb-4">{t.chipsManage.note}</p>

          <div className="card-casino mb-4">
            <p className="text-green-400 font-semibold mb-3">{t.chipsManage.sectionPositive}</p>
            <div className="space-y-2">
              {positiveChips.map(c => <ChipRow key={c.id} chip={c} onEdit={() => openEdit(c)} onToggle={() => toggleChipActive(c)} t={t} />)}
              {positiveChips.length === 0 && <p className="text-green-700 text-sm">{t.chipsManage.noChips}</p>}
            </div>
          </div>

          <div className="card-casino mb-4">
            <p className="text-red-400 font-semibold mb-3">{t.chipsManage.sectionNegative}</p>
            <div className="space-y-2">
              {negativeChips.map(c => <ChipRow key={c.id} chip={c} onEdit={() => openEdit(c)} onToggle={() => toggleChipActive(c)} t={t} />)}
              {negativeChips.length === 0 && <p className="text-green-700 text-sm">{t.chipsManage.noChips}</p>}
            </div>
          </div>

          {(libraryLoading || libraryChips.length > 0) && (
            <div className="card-casino mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[#d4af37] font-semibold">📦 {t.chipsManage.pastChips}</p>
                <button
                  onClick={handleAddAllFromLibrary}
                  className="text-xs px-3 py-1 rounded bg-[#145a32] border border-green-700 text-green-300 hover:border-[#d4af37] hover:text-[#d4af37] transition-colors"
                >
                  {t.chipsManage.addAllChips}
                </button>
              </div>
              {libraryLoading ? (
                <p className="text-green-600 text-sm">{t.common.loading}</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-3">
                    {libraryChips.map((chip, i) => (
                      <button key={i} className="flex flex-col items-center gap-1" onClick={() => setLibraryModal({ chip, isDeleted: false })}>
                        <ChipBadge
                          name={chip.name}
                          chipType={chip.chip_type}
                          imageUrl={chip.image_url}
                          imageScale={chip.image_scale ?? undefined}
                          imageOffsetY={chip.image_offset_y ?? undefined}
                          pointValue={chip.point_value}
                          size={64}
                          isCustom={true}
                        />
                      </button>
                    ))}
                  </div>
                  {deletedChips.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() => setShowDeleted(v => !v)}
                        className="text-sm text-green-600 hover:text-green-400 underline transition-colors"
                      >
                        {t.chipsManage.showDeleted}（{deletedChips.length}）
                      </button>
                      {showDeleted && (
                        <div className="flex flex-wrap gap-3 mt-2">
                          {deletedChips.map((chip, i) => (
                            <button key={i} className="flex flex-col items-center gap-1 opacity-40" onClick={() => setLibraryModal({ chip, isDeleted: true })}>
                              <ChipBadge
                                name={chip.name}
                                chipType={chip.chip_type}
                                imageUrl={chip.image_url}
                                imageScale={chip.image_scale ?? undefined}
                                imageOffsetY={chip.image_offset_y ?? undefined}
                                pointValue={chip.point_value}
                                size={64}
                                isCustom={true}
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="card-casino mb-4">
            <p className="text-[#d4af37] font-semibold mb-3">{t.chipsManage.addCustom}</p>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => setNewChipType('positive')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors
                  ${newChipType === 'positive' ? 'bg-green-700 border-green-500 text-white' : 'bg-[#145a32] border-green-900 text-green-600'}`}>
                {t.chipsManage.typePositive}
              </button>
              <button type="button" onClick={() => setNewChipType('negative')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors
                  ${newChipType === 'negative' ? 'bg-red-900 border-red-700 text-white' : 'bg-[#145a32] border-green-900 text-green-600'}`}>
                {t.chipsManage.typeNegative}
              </button>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-400 text-sm shrink-0">{t.common.pointValue}</span>
              <div className="flex items-center gap-2 ml-auto">
                <button type="button" onClick={() => setNewChipPoints(p => Math.max(1, p - 1))}
                  className="w-7 h-7 rounded-full bg-[#145a32] border border-green-700 text-white font-bold text-lg flex items-center justify-center hover:border-[#d4af37] transition-colors">−</button>
                <span className="text-white font-bold w-6 text-center">{newChipPoints}</span>
                <button type="button" onClick={() => setNewChipPoints(p => Math.min(10, p + 1))}
                  className="w-7 h-7 rounded-full bg-[#145a32] border border-green-700 text-white font-bold text-lg flex items-center justify-center hover:border-[#d4af37] transition-colors">＋</button>
              </div>
            </div>
            <div className="flex gap-2">
              <input type="text" value={newChipName} onChange={e => setNewChipName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && (e.preventDefault(), handleAddChip())}
                placeholder={t.chipsManage.chipNamePlaceholder} maxLength={20}
                className="flex-1 bg-[#145a32] border border-green-700 rounded-lg px-3 py-2
                           text-white placeholder-green-600 focus:outline-none focus:border-[#d4af37] text-sm" />
              <button type="button" onClick={handleAddChip} disabled={!newChipName.trim() || adding}
                className="px-4 py-2 rounded-lg bg-[#d4af37] text-[#1a1a1a] font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                {t.chipsManage.addButton}
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function ChipRow({ chip, onEdit, onToggle, t }: { chip: ChipDefinition; onEdit: () => void; onToggle: () => void; t: ReturnType<typeof useT>['t'] }) {
  const { locale } = useT();
  const displayName = locale === 'en' ? (chipNamesEn[chip.name] ?? chip.name) : chip.name;
  const displayCondition = chip.condition
    ? (locale === 'en' ? (chipConditionsEn[chip.condition] ?? chip.condition) : chip.condition)
    : null;
  const isPos = chip.chip_type === 'positive';
  return (
    <div className={`flex items-center gap-3 rounded-lg px-3 py-2 ${chip.is_active ? 'bg-[#145a32]' : 'bg-[#0b2e1c] opacity-60'}`}>
      <div onClick={onEdit} className="cursor-pointer">
        <ChipBadge name={chip.name} chipType={chip.chip_type} imageUrl={chip.image_url} imageScale={chip.image_scale ?? undefined} imageOffsetY={chip.image_offset_y ?? undefined} size={64} isCustom={!chip.chip_template_id} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${chip.is_active ? 'text-white' : 'text-green-700'}`}>{displayName}</p>
        <p className={`text-xs ${isPos ? 'text-green-500' : 'text-red-400'}`}>
          {isPos ? '+' : '-'}{chip.point_value} pt
        </p>
        {displayCondition && (
          <p className="text-xs text-green-700 truncate mt-0.5">{displayCondition}</p>
        )}
      </div>
      <button
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${chip.is_active ? 'bg-green-500' : 'bg-gray-600'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${chip.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
      <button onClick={onEdit} className="text-sm text-green-400 hover:text-[#d4af37] transition-colors shrink-0 px-2 py-1">{t.common.edit}</button>
    </div>
  );
}
