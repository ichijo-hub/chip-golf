// Client-side session management (localStorage)
const KEY = 'chip_golf_admin';
const VAL = 'authenticated';

export function verifyAdminPin(pin: string): boolean {
  if (pin !== (process.env.NEXT_PUBLIC_ADMIN_PIN ?? '')) return false;
  localStorage.setItem(KEY, VAL);
  return true;
}

export function checkAdminSession(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(KEY) === VAL;
}
