export type Database = {
  public: {
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Tables: {
      games: {
        Row: {
          id: string;
          room_code: string;
          status: 'lobby' | 'playing' | 'finished';
          host_player_id: string | null;
          total_holes: number;
          current_hole: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_code: string;
          status?: 'lobby' | 'playing' | 'finished';
          host_player_id?: string | null;
          total_holes?: number;
          current_hole?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_code?: string;
          status?: 'lobby' | 'playing' | 'finished';
          host_player_id?: string | null;
          total_holes?: number;
          current_hole?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      players: {
        Row: {
          id: string;
          game_id: string;
          name: string;
          display_order: number;
          is_host: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          name: string;
          display_order?: number;
          is_host?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          name?: string;
          display_order?: number;
          is_host?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      chip_templates: {
        Row: {
          id: string;
          name: string;
          chip_type: 'positive' | 'negative';
          default_point_value: number;
          image_url: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          chip_type: 'positive' | 'negative';
          default_point_value?: number;
          image_url?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          chip_type?: 'positive' | 'negative';
          default_point_value?: number;
          image_url?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      chip_definitions: {
        Row: {
          id: string;
          game_id: string;
          chip_template_id: string | null;
          name: string;
          chip_type: 'positive' | 'negative';
          point_value: number;
          image_url: string | null;
          is_default: boolean;
          is_active: boolean;
          sort_order: number;
        };
        Insert: {
          id?: string;
          game_id: string;
          chip_template_id?: string | null;
          name: string;
          chip_type: 'positive' | 'negative';
          point_value?: number;
          image_url?: string | null;
          is_default?: boolean;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          id?: string;
          game_id?: string;
          chip_template_id?: string | null;
          name?: string;
          chip_type?: 'positive' | 'negative';
          point_value?: number;
          image_url?: string | null;
          is_default?: boolean;
          is_active?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      chip_states: {
        Row: {
          id: string;
          game_id: string;
          chip_definition_id: string;
          holder_player_id: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          chip_definition_id: string;
          holder_player_id?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          chip_definition_id?: string;
          holder_player_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      game_events: {
        Row: {
          id: string;
          game_id: string;
          chip_state_id: string | null;
          from_player_id: string | null;
          to_player_id: string | null;
          hole_number: number | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          chip_state_id?: string | null;
          from_player_id?: string | null;
          to_player_id?: string | null;
          hole_number?: number | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          chip_state_id?: string | null;
          from_player_id?: string | null;
          to_player_id?: string | null;
          hole_number?: number | null;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
  };
};
