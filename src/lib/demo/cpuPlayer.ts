import { Player, ChipDefinition, ChipState } from '@/types';

export interface CpuAction {
  chipStateId: string;
  toPlayerId: string | null; // null = 場に戻す
}

export function decideCpuAction(
  cpuPlayerId: string,
  chipStates: ChipState[],
  chipDefs: ChipDefinition[],
  players: Player[],
): CpuAction | null {
  const rand = Math.random();

  // 場のチップを種別ごとに分類
  const fieldPositive = chipStates.filter((cs) => {
    if (cs.holder_player_id !== null) return false;
    const def = chipDefs.find((d) => d.id === cs.chip_definition_id);
    return def?.chip_type === 'positive';
  });
  const fieldNegative = chipStates.filter((cs) => {
    if (cs.holder_player_id !== null) return false;
    const def = chipDefs.find((d) => d.id === cs.chip_definition_id);
    return def?.chip_type === 'negative';
  });

  // 自分の持つネガティブチップ
  const myNegative = chipStates.filter((cs) => {
    if (cs.holder_player_id !== cpuPlayerId) return false;
    const def = chipDefs.find((d) => d.id === cs.chip_definition_id);
    return def?.chip_type === 'negative';
  });

  const otherPlayers = players.filter((p) => p.id !== cpuPlayerId);

  // 行動決定テーブル
  if (fieldPositive.length > 0 && rand < 0.60) {
    // 60%: 場のポジティブチップを取得
    const cs = fieldPositive[Math.floor(Math.random() * fieldPositive.length)];
    return { chipStateId: cs.id, toPlayerId: cpuPlayerId };
  }

  if (myNegative.length > 0 && rand < 0.80) {
    // 40%: 自分のネガティブチップを場に戻す or 他プレイヤーに渡す
    const cs = myNegative[Math.floor(Math.random() * myNegative.length)];
    if (Math.random() < 0.5 || otherPlayers.length === 0) {
      // 場に戻す
      return { chipStateId: cs.id, toPlayerId: null };
    } else {
      // 他プレイヤーに渡す
      const target = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
      return { chipStateId: cs.id, toPlayerId: target.id };
    }
  }

  if (fieldNegative.length > 0 && rand < 0.90) {
    // 20%: 場のネガティブチップを誰かに押し付ける（CPUは自分には取らない）
    if (otherPlayers.length > 0) {
      const cs = fieldNegative[Math.floor(Math.random() * fieldNegative.length)];
      const target = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
      return { chipStateId: cs.id, toPlayerId: target.id };
    }
  }

  // 何もしない
  return null;
}
