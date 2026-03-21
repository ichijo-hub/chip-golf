import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(req: NextRequest) {
  const { gameId, senderPlayerId, title, body } = await req.json();

  if (!gameId || !title) {
    return NextResponse.json({ error: 'missing params' }, { status: 400 });
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription, player_id')
    .eq('game_id', gameId);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const targets = subs.filter(s => s.player_id !== senderPlayerId);

  const results = await Promise.allSettled(
    targets.map(s =>
      webpush.sendNotification(
        s.subscription as webpush.PushSubscription,
        JSON.stringify({ title, body }),
      )
    )
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  return NextResponse.json({ sent });
}
