'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ChipTemplate, ChipType } from '@/types';
import ChipBadge from '@/components/ChipBadge';
import Logo from '@/components/Logo';

interface EditingTemplate {
  id: string | null; // null = 新規作成
  name: string;
  chip_type: ChipType;
  default_point_value: number;
  image_url: string | null;
  is_active: boolean;
  previewUrl: string | null;
  pendingFile: File | null;
}

function emptyEdit(chipType: ChipType = 'positive'): EditingTemplate {
  return { id: null, name: '', chip_type: chipType, default_point_value: 1, image_url: null, is_active: true, previewUrl: null, pendingFile: null };
}

export default function ChipsTemplateClient() {
  const router = useRouter();
  const supabase = useRef(createClient()).current;

  const [templates, setTemplates] = useState<ChipTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditingTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from('chip_templates').select('*').order('sort_order');
    setTemplates((data ?? []) as ChipTemplate[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  function openNew(chipType: ChipType) {
    setEditing(emptyEdit(chipType));
    setError('');
  }

  function openEdit(t: ChipTemplate) {
    setEditing({
      id: t.id, name: t.name, chip_type: t.chip_type,
      default_point_value: t.default_point_value,
      image_url: t.image_url, is_active: t.is_active ?? true,
      previewUrl: t.image_url, pendingFile: null,
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

  async function uploadImage(templateId: string, file: File): Promise<string | null> {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `templates/${templateId}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('chip-images').upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setError(`アップロード失敗: ${upErr.message}`); return null; }
    const { data } = supabase.storage.from('chip-images').getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSave() {
    if (!editing) return;
    if (!editing.name.trim()) { setError('チップ名を入力してください'); return; }
    setSaving(true);
    setError('');

    if (editing.id === null) {
      // 新規作成
      const maxOrder = templates.length > 0 ? Math.max(...templates.map(t => t.sort_order)) + 1 : 0;
      const { data: newT, error: insErr } = await supabase
        .from('chip_templates')
        .insert({ name: editing.name.trim(), chip_type: editing.chip_type, default_point_value: editing.default_point_value, sort_order: maxOrder })
        .select().single();
      if (insErr || !newT) { setError('作成に失敗しました'); setSaving(false); return; }
      const t = newT as ChipTemplate;
      if (editing.pendingFile) {
        const url = await uploadImage(t.id, editing.pendingFile);
        if (url) await supabase.from('chip_templates').update({ image_url: url }).eq('id', t.id);
      }
    } else {
      // 更新
      let imageUrl = editing.image_url;
      if (editing.pendingFile) {
        imageUrl = await uploadImage(editing.id, editing.pendingFile);
        if (imageUrl === null) { setSaving(false); return; }
      }
      await supabase.from('chip_templates').update({
        name: editing.name.trim(),
        default_point_value: editing.default_point_value,
        image_url: imageUrl,
        is_active: editing.is_active,
      }).eq('id', editing.id);
    }

    setSaving(false);
    setEditing(null);
    loadData();
  }

  async function handleDelete() {
    if (!editing?.id) return;
    if (!confirm(`「${editing.name}」を削除しますか？\n既存ゲームのチップには影響しません。`)) return;
    await supabase.from('chip_templates').delete().eq('id', editing.id);
    setEditing(null);
    loadData();
  }

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-green-400">読み込み中...</p></main>;
  }

  const positiveTemplates = templates.filter(t => t.chip_type === 'positive' && t.is_active !== false);
  const negativeTemplates = templates.filter(t => t.chip_type === 'negative' && t.is_active !== false);
  const disabledTemplates = templates.filter(t => t.is_active === false);

  return (
    <>
      {editing && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4" onClick={() => setEditing(null)}>
          <div className="card-casino w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[#d4af37] font-bold text-lg">
                {editing.id ? 'チップを編集' : 'チップを追加'}
              </p>
              <button onClick={() => setEditing(null)} className="text-green-400 text-2xl leading-none">✕</button>
            </div>

            <div className="flex justify-center mb-4">
              <ChipBadge name={editing.name || '?'} chipType={editing.chip_type} imageUrl={editing.previewUrl} size={120} />
            </div>

            <div className="space-y-3">
              <input
                type="text" value={editing.name}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
                placeholder="チップ名" maxLength={20}
                className="w-full bg-[#145a32] border border-green-700 rounded-lg px-4 py-3
                           text-white placeholder-green-600 focus:outline-none focus:border-[#d4af37]"
              />

              <div>
                <p className="text-green-400 text-sm mb-2">デフォルトポイント値</p>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setEditing({ ...editing, default_point_value: Math.max(1, editing.default_point_value - 1) })}
                    className="w-10 h-10 rounded-full bg-[#145a32] border border-green-700 text-white text-xl font-bold
                               hover:border-[#d4af37] transition-colors">－</button>
                  <span className="text-2xl font-bold text-white w-8 text-center">{editing.default_point_value}</span>
                  <button type="button" onClick={() => setEditing({ ...editing, default_point_value: Math.min(10, editing.default_point_value + 1) })}
                    className="w-10 h-10 rounded-full bg-[#145a32] border border-green-700 text-white text-xl font-bold
                               hover:border-[#d4af37] transition-colors">＋</button>
                  <span className="text-green-500 text-sm">
                    {editing.chip_type === 'positive' ? `+${editing.default_point_value}` : `-${editing.default_point_value}`} pt
                  </span>
                </div>
              </div>

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
                <p className="text-green-700 text-xs mt-1">JPG / PNG / WebP、2MB以下</p>
              </div>

              {editing.id && (
                <div className="flex items-center justify-between py-2 border-t border-green-800">
                  <span className={`text-sm ${editing.is_active ? 'text-green-400' : 'text-gray-300'}`}>
                    {editing.is_active ? '有効' : '無効'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, is_active: !editing.is_active })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${editing.is_active ? 'bg-green-500' : 'bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${editing.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              )}

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="btn-gold flex-1 py-3">
                  {saving ? '保存中...' : '保存'}
                </button>
                {editing.id && templates.find(t => t.id === editing.id)?.is_active === false && (
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

      <main className="min-h-screen pb-24">
        <div className="sticky top-0 bg-[#145a32] border-b border-green-800 px-3 py-2 z-10">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <button onClick={() => router.push('/')}><Logo size="sm" /></button>
            <p className="text-[#d4af37] font-bold text-sm">チップ管理</p>
          </div>
        </div>
        <div className="max-w-md mx-auto p-4">
          <p className="text-green-500 text-sm mb-6">ここで管理したチップがゲーム作成時に使えるようになります</p>

          <div className="card-casino mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-green-400 font-semibold">ポジティブチップ</p>
              <button onClick={() => openNew('positive')}
                className="text-sm px-3 py-1 rounded-lg bg-green-800 border border-green-600 text-green-200 hover:bg-green-700 transition-colors">
                ＋ 追加
              </button>
            </div>
            {positiveTemplates.length === 0 ? (
              <p className="text-green-700 text-sm">チップがありません</p>
            ) : (
              <div className="space-y-2">
                {positiveTemplates.map(t => (
                  <TemplateRow key={t.id} template={t} onEdit={() => openEdit(t)} />
                ))}
              </div>
            )}
          </div>

          <div className="card-casino mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-red-400 font-semibold">ネガティブチップ</p>
              <button onClick={() => openNew('negative')}
                className="text-sm px-3 py-1 rounded-lg bg-red-900 border border-red-700 text-red-200 hover:bg-red-800 transition-colors">
                ＋ 追加
              </button>
            </div>
            {negativeTemplates.length === 0 ? (
              <p className="text-green-700 text-sm">チップがありません</p>
            ) : (
              <div className="space-y-2">
                {negativeTemplates.map(t => (
                  <TemplateRow key={t.id} template={t} onEdit={() => openEdit(t)} />
                ))}
              </div>
            )}
          </div>

          {disabledTemplates.length > 0 && (
            <div className="card-casino mb-4 opacity-60">
              <div className="mb-3">
                <p className="text-gray-400 font-semibold text-sm">無効なチップ</p>
                <p className="text-gray-600 text-xs mt-0.5">ゲーム作成時に表示されません</p>
              </div>
              <div className="space-y-2">
                {disabledTemplates.map(t => (
                  <TemplateRow key={t.id} template={t} onEdit={() => openEdit(t)} disabled />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function TemplateRow({ template, onEdit, disabled }: { template: ChipTemplate; onEdit: () => void; disabled?: boolean }) {
  const isPos = template.chip_type === 'positive';
  return (
    <div className={`flex items-center gap-3 rounded-lg px-3 py-2 ${disabled ? 'bg-[#0d2a18]' : 'bg-[#145a32]'}`}>
      <div onClick={onEdit} className="cursor-pointer">
        <ChipBadge name={template.name} chipType={template.chip_type} imageUrl={template.image_url} size={64} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${disabled ? 'text-gray-500' : 'text-white'}`}>{template.name}</p>
        <p className={`text-xs ${disabled ? 'text-gray-600' : isPos ? 'text-green-500' : 'text-red-400'}`}>
          {isPos ? '+' : '-'}{template.default_point_value} pt（デフォルト）
        </p>
      </div>
      <button onClick={onEdit} className="text-sm text-gray-500 hover:text-[#d4af37] transition-colors shrink-0 px-2 py-1">
        {disabled ? '管理' : '編集'}
      </button>
    </div>
  );
}
