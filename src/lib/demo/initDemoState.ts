import { Player, ChipDefinition, ChipState } from '@/types';
import { DEFAULT_CHIPS } from '@/lib/defaultChips';

export interface DemoEvent {
  id: string;
  description: string;
  createdAt: string;
}

export interface DemoState {
  players: Player[];
  chipDefs: ChipDefinition[];
  chipStates: ChipState[];
  events: DemoEvent[];
  myPlayerId: string;
  cpuPlayerIds: string[];
  currentHole: number;
  totalHoles: number;
  status: 'playing' | 'finished';
}

export function initDemoState(playerName: string, cpuCount: number): DemoState {
  const now = new Date().toISOString();
  const gameId = 'demo';

  // プレイヤー生成
  const myPlayerId = crypto.randomUUID();
  const cpuPlayerIds: string[] = [];
  for (let i = 0; i < cpuCount; i++) {
    cpuPlayerIds.push(crypto.randomUUID());
  }

  const myName = playerName.trim() || 'あなた';
  const players: Player[] = [
    {
      id: myPlayerId,
      game_id: gameId,
      name: myName,
      display_order: 0,
      is_host: true,
      created_at: now,
    },
    ...cpuPlayerIds.map((id, i) => ({
      id,
      game_id: gameId,
      name: `CPU ${i + 1}`,
      display_order: i + 1,
      is_host: false,
      created_at: now,
    })),
  ];

  // チップ定義生成
  const chipDefs: ChipDefinition[] = DEFAULT_CHIPS.map((chip) => ({
    id: crypto.randomUUID(),
    game_id: gameId,
    name: chip.name,
    chip_type: chip.chip_type,
    point_value: chip.point_value,
    image_url: chip.image_url ?? null,
    image_scale: chip.image_scale ?? null,
    image_offset_y: chip.image_offset_y ?? null,
    condition: chip.condition ?? null,
    chip_template_id: null,
    is_default: true,
    is_active: true,
    sort_order: chip.sort_order,
  }));

  // チップステート生成（全て場にある状態）
  const chipStates: ChipState[] = chipDefs.map((def) => ({
    id: crypto.randomUUID(),
    game_id: gameId,
    chip_definition_id: def.id,
    holder_player_id: null,
    updated_at: now,
  }));

  return {
    players,
    chipDefs,
    chipStates,
    events: [],
    myPlayerId,
    cpuPlayerIds,
    currentHole: 1,
    totalHoles: 9,
    status: 'playing',
  };
}
