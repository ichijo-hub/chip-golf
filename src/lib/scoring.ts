import { ChipDefinition, ChipState, Player } from '@/types';

export interface PlayerScore {
  player: Player;
  positivePoints: number;
  negativePoints: number;
  netScore: number;
  chips: ChipDefinition[];
}

export function calculateScores(
  players: Player[],
  chipStates: ChipState[],
  chipDefinitions: ChipDefinition[]
): PlayerScore[] {
  return players
    .map((player) => {
      const playerChipStates = chipStates.filter(
        (cs) => cs.holder_player_id === player.id
      );
      const playerChips = playerChipStates
        .map((cs) => chipDefinitions.find((cd) => cd.id === cs.chip_definition_id))
        .filter((cd): cd is ChipDefinition => cd !== undefined);

      const positivePoints = playerChips
        .filter((cd) => cd.chip_type === 'positive')
        .reduce((sum, cd) => sum + cd.point_value, 0);

      const negativePoints = playerChips
        .filter((cd) => cd.chip_type === 'negative')
        .reduce((sum, cd) => sum + cd.point_value, 0);

      return {
        player,
        positivePoints,
        negativePoints,
        netScore: positivePoints - negativePoints,
        chips: playerChips,
      };
    })
    .sort((a, b) => b.netScore - a.netScore);
}
