'use server';
import { cookies } from 'next/headers';

const COOKIE_KEY = 'chip_golf_admin';
const COOKIE_VAL = 'authenticated';

export async function verifyAdminPin(pin: string): Promise<boolean> {
  if (!process.env.ADMIN_PIN || pin !== process.env.ADMIN_PIN) return false;
  (await cookies()).set(COOKIE_KEY, COOKIE_VAL, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
  return true;
}

export async function checkAdminSession(): Promise<boolean> {
  return (await cookies()).get(COOKIE_KEY)?.value === COOKIE_VAL;
}
