export type GameStatus = 'lobby' | 'playing' | 'finished';
export type ChipType = 'positive' | 'negative';
export type HoleMode = 'none' | '9h' | '18h_out' | '18h_in';

export interface Game {
  id: string;
  room_code: string;
  status: GameStatus;
  host_player_id: string | null;
  hole_mode?: HoleMode;
  total_holes: number;
  current_hole: number;
  olympic_enabled?: boolean;
  dracon_enabled?: boolean;
  niapin_enabled?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  game_id: string;
  name: string;
  display_order: number;
  is_host: boolean;
  is_spectator: boolean;
  comments: string[];
  created_at: string;
}

export interface ChipTemplate {
  id: string;
  name: string;
  chip_type: ChipType;
  default_point_value: number;
  image_url: string | null;
  image_scale: number | null;
  image_offset_y: number | null;
  condition: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface ChipDefinition {
  id: string;
  game_id: string;
  name: string;
  chip_type: ChipType;
  point_value: number;
  image_url: string | null;
  image_scale: number | null;
  image_offset_y: number | null;
  condition: string | null;
  chip_template_id: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface ChipState {
  id: string;
  game_id: string;
  chip_definition_id: string;
  holder_player_id: string | null;
  updated_at: string;
}

export interface SingleWinnerHoleLog {
  hole_number: number;
  winner_player_id: string | null;
  double_up: boolean;
  carryover: number;
  updated_at: string;
}

export interface OlympicEntry {
  position: number | null;  // rank: 1=farthest(金/4pts) … N=closest(最少pts). null = 獲得なし
}

export interface OlympicHoleLog {
  hole_number: number;
  entries: Record<string, OlympicEntry>;  // key: player_id
  updated_at: string;
}

export type SideGameType = 'olympic' | 'dracon' | 'niapin';

export interface GameEvent {
  id: string;
  game_id: string;
  chip_state_id: string | null;
  chip_definition_id: string | null;
  from_player_id: string | null;
  to_player_id: string | null;
  hole_number: number | null;
  description: string | null;
  side_game?: SideGameType | null; // サイドゲーム行の判別（旧データは description の絵文字で判定）
  edited_at?: string | null;       // ホストが記録を修正した日時
  created_at: string;
}
