# チップゴルフ (Chip Golf) - 設計書

## 1. 概要

**アプリ名: チップゴルフ (Chip Golf)**

ベガスゴルフのカジノチップゲームをリアルタイムで複数人が遊べるWebアプリ。
各プレイヤーが自分のスマホからアクセスし、チップの移動をリアルタイム同期する。

---

## 2. 技術スタック

| レイヤー | 技術 | 理由 |
|---------|------|------|
| フロントエンド | Next.js 14 (App Router) | SSR/SSG対応、TypeScript標準 |
| スタイリング | Tailwind CSS | ユーティリティベースで高速開発 |
| バックエンド/DB | Supabase (PostgreSQL) | リアルタイム同期（Realtime）が標準搭載 |
| 画像ストレージ | Supabase Storage | チップ画像のアップロード先 |
| ホスティング | Vercel | Next.jsとの親和性、簡単デプロイ |
| ソース管理 | GitHub | Vercel連携で自動デプロイ |

---

## 3. 画面構成・ユーザーフロー

```
[トップ画面]
    │
    ├── ゲーム作成 → [ゲーム設定画面] → [待機ルーム] → [ゲーム画面] → [結果画面]
    │                                        ↑
    └── ゲーム参加（ルームコード入力）─────────┘
```

### 3.1 トップ画面 `/`
- 「新しいゲームを作成」ボタン
- 「ゲームに参加」＋ルームコード入力欄
- シンプルなロゴとルール説明リンク

### 3.2 ゲーム設定画面 `/game/new`
- ホスト名入力
- 使用するチップの選択・編集
  - デフォルトチップ一覧（ベガスゴルフ標準12枚）
  - チップの有効/無効トグル
  - 新規チップ追加フォーム（名前、+/-、画像アップロード）
- プレイホール数選択（9H / 18H / カスタム）
- 「ゲーム作成」→ ルームコード生成

### 3.3 待機ルーム `/game/[roomCode]/lobby`
- ルームコード表示（大きく、コピーボタン付き）
- QRコード表示（スマホで読み取りやすく）
- 参加者一覧（リアルタイム更新）
- ホストのみ「ゲーム開始」ボタン

### 3.4 ゲーム画面（メイン） `/game/[roomCode]/play`
- **場のチップエリア**: 誰にも割り当てられていないチップ一覧
- **プレイヤーエリア**: 各プレイヤーの手持ちチップ＆現在スコア
- **チップ操作**:
  - チップをタップ → 移動先プレイヤーを選択
  - または ドラッグ&ドロップ（PC向け）
- **現在ホール表示** + ホール送りボタン
- **イベントログ**: 「○○が『バーディー』チップを獲得！」など
- **「ゲーム終了」ボタン**（ホストのみ）

### 3.5 結果画面 `/game/[roomCode]/result`
- 順位表（ポジティブ・ネガティブ相殺後のスコア）
- 各プレイヤーの獲得チップ詳細
- 「もう一度遊ぶ」「トップに戻る」

---

## 4. データベース設計 (Supabase / PostgreSQL)

### 4.1 テーブル構成

```sql
-- ゲームルーム
CREATE TABLE games (
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
CREATE TABLE players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  display_order INT DEFAULT 0,
  is_host BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- チップ定義（ゲームごと）
CREATE TABLE chip_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,        -- 例: "バーディー", "OB"
  chip_type VARCHAR(10) NOT NULL,   -- positive | negative
  point_value INT DEFAULT 1,        -- 通常は1、カスタムで変更可
  image_url TEXT,                    -- Supabase Storage URL
  is_default BOOLEAN DEFAULT true,  -- デフォルトチップか
  is_active BOOLEAN DEFAULT true,   -- このゲームで使用するか
  sort_order INT DEFAULT 0
);

-- チップ状態（誰が持っているか）
CREATE TABLE chip_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  chip_definition_id UUID REFERENCES chip_definitions(id) ON DELETE CASCADE,
  holder_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  -- NULL = 場にある、UUID = そのプレイヤーが保持
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- イベントログ
CREATE TABLE game_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  chip_state_id UUID REFERENCES chip_states(id),
  from_player_id UUID REFERENCES players(id),  -- NULL = 場から
  to_player_id UUID REFERENCES players(id),
  hole_number INT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.2 RLS (Row Level Security) ポリシー

ゲーム参加者のみがデータにアクセスできるようにする。
認証は匿名認証（Supabase Anonymous Auth）を使い、
player_id をローカルストレージで保持する簡易方式。

```sql
-- games: ルームコードを知っていれば読み取り可
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read games" ON games FOR SELECT USING (true);
CREATE POLICY "Anyone can create games" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "Host can update games" ON games FOR UPDATE USING (true);

-- players: 同一ゲームの参加者のみ
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Game participants can read" ON players FOR SELECT USING (true);
CREATE POLICY "Anyone can join" ON players FOR INSERT WITH CHECK (true);

-- chip_states: リアルタイム同期対象
ALTER TABLE chip_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Game participants can read" ON chip_states FOR SELECT USING (true);
CREATE POLICY "Game participants can update" ON chip_states FOR UPDATE USING (true);
```

### 4.3 Supabase Realtime 設定

以下のテーブルをリアルタイム購読対象にする：
- `chip_states` → チップ移動をリアルタイム反映
- `players` → 参加者の入退室
- `games` → ゲームステータス変更
- `game_events` → イベントログ更新

---

## 5. チップシステム

### 5.1 デフォルトチップ（ベガスゴルフ標準）

#### ポジティブチップ (+1)
| チップ名 | 説明 |
|---------|------|
| バーディー | パーより1打少ない |
| パー | 規定打数でホールアウト |
| チップイン | グリーン外からカップイン |
| 砂イチ | バンカーから1打で寄せて1パット |
| ニアピン | ショートホールで最もピンに近い |
| 1パット | 1パットでホールアウト |

#### ネガティブチップ (-1)
| チップ名 | 説明 |
|---------|------|
| OB | アウトオブバウンズ |
| 池ポチャ | ウォーターハザード |
| バンカー | バンカーに入れる |
| 3パット | 3パット以上 |
| 木に当てる | ティーショットなどで木に当てる |
| 7打以上 | そのホールで7打以上叩く |

### 5.2 カスタムチップ
- ホストがゲーム設定時に追加可能
- 名前、ポジ/ネガ、ポイント値（デフォルト1）、画像を設定
- 画像は Supabase Storage にアップロード（最大2MB、jpg/png/webp）

---

## 6. 主要コンポーネント設計

```
src/
├── app/
│   ├── page.tsx                      # トップ画面
│   ├── game/
│   │   ├── new/page.tsx              # ゲーム設定
│   │   └── [roomCode]/
│   │       ├── lobby/page.tsx        # 待機ルーム
│   │       ├── play/page.tsx         # ゲーム画面
│   │       └── result/page.tsx       # 結果画面
│   └── layout.tsx
├── components/
│   ├── ChipCard.tsx                  # チップ表示カード
│   ├── ChipGrid.tsx                  # チップ一覧グリッド
│   ├── PlayerPanel.tsx               # プレイヤー情報パネル
│   ├── ChipTransferModal.tsx         # チップ移動先選択モーダル
│   ├── ScoreBoard.tsx                # スコアボード
│   ├── EventLog.tsx                  # イベントログ
│   ├── QRCode.tsx                    # QRコード表示
│   ├── ChipEditor.tsx               # カスタムチップ編集フォーム
│   └── ImageUploader.tsx             # 画像アップロード
├── hooks/
│   ├── useGameState.ts               # ゲーム状態管理
│   ├── useRealtimeChips.ts           # チップのリアルタイム購読
│   ├── useRealtimePlayers.ts         # プレイヤーのリアルタイム購読
│   └── useSupabase.ts               # Supabaseクライアント
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # ブラウザ用クライアント
│   │   ├── server.ts                 # サーバー用クライアント
│   │   └── types.ts                  # 型定義
│   ├── defaultChips.ts               # デフォルトチップデータ
│   ├── scoring.ts                    # スコア計算ロジック
│   └── roomCode.ts                   # ルームコード生成
└── types/
    └── index.ts                      # 共通型定義
```

---

## 7. リアルタイム同期の仕組み

```
[プレイヤーA のスマホ]          [Supabase]          [プレイヤーB のスマホ]
        │                          │                          │
        │  チップをタップ            │                          │
        │  → UPDATE chip_states    │                          │
        │ ─────────────────────>   │                          │
        │                          │  Realtime broadcast      │
        │                          │ ─────────────────────>   │
        │                          │                          │  画面更新
        │  Realtime broadcast      │                          │
        │ <─────────────────────   │                          │
        │  画面更新                 │                          │
```

### Supabase Realtime Channel 設計

```typescript
// チップ状態の購読
const channel = supabase
  .channel(`game:${roomCode}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'chip_states',
    filter: `game_id=eq.${gameId}`
  }, handleChipChange)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'players',
    filter: `game_id=eq.${gameId}`
  }, handlePlayerChange)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'games',
    filter: `id=eq.${gameId}`
  }, handleGameChange)
  .subscribe();
```

---

## 8. API設計

Supabase のクライアントライブラリを直接使用し、
Next.js の Server Actions は補助的に使用。

### 主要操作

| 操作 | 方法 | 説明 |
|------|------|------|
| ゲーム作成 | Server Action | games + chip_definitions + chip_states INSERT |
| ゲーム参加 | Server Action | players INSERT |
| チップ移動 | Client SDK | chip_states UPDATE + game_events INSERT |
| ゲーム開始 | Client SDK | games UPDATE (status → playing) |
| ゲーム終了 | Client SDK | games UPDATE (status → finished) |
| 画像アップロード | Client SDK | Supabase Storage upload |

---

## 9. セキュリティ考慮

- **匿名認証**: Supabase Anonymous Auth でセッション管理
- **player_id**: ローカルストレージに保存、再接続時に復元
- **ルームコード**: 6桁英数字（大文字）で推測困難
- **RLS**: ゲーム参加者以外のデータアクセスを制限
- **画像**: Supabase Storageのバケットポリシーで制限（2MB上限）

---

## 10. 実装優先順位

### Phase 1: 基本動作（MVP）
1. プロジェクトセットアップ（Next.js + Supabase）
2. DB テーブル作成 + RLS
3. トップ画面 + ゲーム作成
4. 待機ルーム（参加・リアルタイム同期）
5. ゲーム画面（チップ表示・移動）
6. 結果画面

### Phase 2: 体験向上
7. カスタムチップ作成 + 画像アップロード
8. QRコード表示
9. ドラッグ&ドロップ対応
10. イベントログ
11. アニメーション・サウンド

### Phase 3: 拡張
12. ゲーム履歴保存
13. チップテンプレート保存・共有
14. PWA対応（ホーム画面に追加）
15. SNSシェア機能

---

## 11. 環境変数

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  # サーバーサイドのみ
```

---

## 12. Supabase セットアップ手順

1. [supabase.com](https://supabase.com) でプロジェクト作成
2. SQLエディタで上記テーブル作成クエリを実行
3. Authentication → Settings → Anonymous sign-ins を有効化
4. Storage → 新しいバケット `chip-images` を作成（Public）
5. Realtime → テーブル `chip_states`, `players`, `games`, `game_events` を有効化
6. プロジェクトURL と anon key を `.env.local` に設定

---

## 13. Claude Code での開発フロー

```bash
# 1. プロジェクト作成
npx create-next-app@latest chip-golf --typescript --tailwind --app --src-dir

# 2. 依存関係インストール
cd chip-golf
npm install @supabase/supabase-js @supabase/ssr qrcode.react

# 3. Supabase クライアント設定
# → lib/supabase/client.ts, server.ts を作成

# 4. 型定義生成
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/supabase/types.ts

# 5. 各画面を順番に実装
# → Phase 1 の順番で進める
```

---

## 14. UIデザイン方針

- **テーマ**: カジノ風（ダークグリーンベース、ゴールドアクセント）
- **チップ表示**: 丸型カード、カジノチップを模した外観
- **レスポンシブ**: モバイルファースト（主にスマホで使用）
- **操作性**: タップ中心、大きめのタッチターゲット
- **フィードバック**: チップ移動時にアニメーション + バイブレーション
