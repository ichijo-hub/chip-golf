-- チップゴルフ データベースセットアップ
-- Supabase SQLエディタで実行してください

-- ゲームルーム
CREATE TABLE IF NOT EXISTS games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code VARCHAR(6) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'lobby',  -- lobby | playing | finished
  host_player_id UUID,
  total_holes INT DEFAULT 9,
  current_hole INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- プレイヤー
CREATE TABLE IF NOT EXISTS players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  display_order INT DEFAULT 0,
  is_host BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- チップ定義（ゲームごと）
CREATE TABLE IF NOT EXISTS chip_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  chip_type VARCHAR(10) NOT NULL,   -- positive | negative
  point_value INT DEFAULT 1,
  image_url TEXT,
  is_default BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0
);

-- チップ状態（誰が持っているか）
CREATE TABLE IF NOT EXISTS chip_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  chip_definition_id UUID REFERENCES chip_definitions(id) ON DELETE CASCADE,
  holder_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- イベントログ
CREATE TABLE IF NOT EXISTS game_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  chip_state_id UUID REFERENCES chip_states(id),
  from_player_id UUID REFERENCES players(id),
  to_player_id UUID REFERENCES players(id),
  hole_number INT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 有効化
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE chip_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chip_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;

-- games ポリシー
CREATE POLICY "Anyone can read games" ON games FOR SELECT USING (true);
CREATE POLICY "Anyone can create games" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update games" ON games FOR UPDATE USING (true);

-- players ポリシー
CREATE POLICY "Anyone can read players" ON players FOR SELECT USING (true);
CREATE POLICY "Anyone can join" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update players" ON players FOR UPDATE USING (true);

-- chip_definitions ポリシー
CREATE POLICY "Anyone can read chip_definitions" ON chip_definitions FOR SELECT USING (true);
CREATE POLICY "Anyone can create chip_definitions" ON chip_definitions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update chip_definitions" ON chip_definitions FOR UPDATE USING (true);

-- chip_states ポリシー
CREATE POLICY "Anyone can read chip_states" ON chip_states FOR SELECT USING (true);
CREATE POLICY "Anyone can create chip_states" ON chip_states FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update chip_states" ON chip_states FOR UPDATE USING (true);

-- game_events ポリシー
CREATE POLICY "Anyone can read game_events" ON game_events FOR SELECT USING (true);
CREATE POLICY "Anyone can create game_events" ON game_events FOR INSERT WITH CHECK (true);

-- Realtimeを有効化（Supabase Dashboard > Database > Replication で設定）
-- chip_states, players, games, game_events テーブルを有効化
