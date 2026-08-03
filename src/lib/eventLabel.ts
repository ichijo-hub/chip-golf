import { ChipDefinition, GameEvent, Player, SideGameType } from '@/types';
import { chipNamesEn } from '@/lib/i18n/chipNames';

// 旧データ（side_game フィールドなし）用のフォールバック判定
const SIDE_GAME_EMOJI: Record<string, SideGameType> = {
  '🏅': 'olympic',
  '🏌️': 'dracon',
  '📍': 'niapin',
};

/** サイドゲーム（オリンピック/ドラコン/ニアピン）のログ行なら種別を返す */
export function sideGameTypeOf(ev: GameEvent): SideGameType | null {
  if (ev.side_game) return ev.side_game;
  if (ev.chip_definition_id) return null;
  const desc = ev.description ?? '';
  for (const [emoji, type] of Object.entries(SIDE_GAME_EMOJI)) {
    if (desc.startsWith(emoji)) return type;
  }
  return null;
}

/** チップ移動のログ行か（＝チップ定義に紐づく行か） */
export function isChipTransferEvent(ev: GameEvent): boolean {
  return ev.chip_definition_id !== null;
}

/**
 * ログ1行の表示文字列を組み立てる。
 * チップ移動行は chip_definition_id から再構成し、それ以外は description をそのまま使う。
 */
export function formatEventLabel(
  ev: GameEvent,
  chipDefs: ChipDefinition[],
  players: Player[],
  locale: 'ja' | 'en',
  fieldLabel: string,
  holeLabel: string,
): string {
  const chipDef = chipDefs.find(d => d.id === ev.chip_definition_id);
  if (!chipDef) return ev.description ?? '';

  const chipName = locale === 'en' ? (chipNamesEn[chipDef.name] ?? chipDef.name) : chipDef.name;
  const fromName = ev.from_player_id
    ? (players.find(p => p.id === ev.from_player_id)?.name ?? fieldLabel)
    : fieldLabel;
  const toName = ev.to_player_id
    ? (players.find(p => p.id === ev.to_player_id)?.name ?? fieldLabel)
    : fieldLabel;
  const holePrefix = ev.hole_number != null ? `${holeLabel}${ev.hole_number} ` : '';

  return `${holePrefix}${chipName}: ${fromName} → ${toName}`;
}
