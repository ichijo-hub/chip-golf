export type GameStatus = 'lobby' | 'playing' | 'finished';
export type ChipType = 'positive' | 'negative';

export interface Game {
  id: string;
  room_code: string;
  status: GameStatus;
  host_player_id: string | null;
  total_holes: number;
  current_hole: number;
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  game_id: string;
  name: string;
  display_order: number;
  is_host: boolean;
  created_at: string;
}

export interface ChipTemplate {
  id: string;
  name: string;
  chip_type: ChipType;
  default_point_value: number;
  image_url: string | null;
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

export interface GameEvent {
  id: string;
  game_id: string;
  chip_state_id: string | null;
  from_player_id: string | null;
  to_player_id: string | null;
  hole_number: number | null;
  description: string | null;
  created_at: string;
}
