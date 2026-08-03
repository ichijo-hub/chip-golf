import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// オフライン永続キャッシュ（IndexedDB）。ゴルフ場は電波が悪いため、リロードしても
// 直前のゲーム内容が出るようにする。
// 複数タブ方式を使う理由: 単一タブ方式は IndexedDB のリースを1タブしか持てず、
// 共有リンクを踏み直して2枚目のタブが開いたときに Firestore の起動自体が失敗しうる。
function initDb() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    }, 'chip-golf');
  } catch {
    // 既に初期化済み（dev の HMR でこのモジュールが再評価された場合など）
    return getFirestore(app, 'chip-golf');
  }
}

export const db = initDb();
export const storage = getStorage(app);
