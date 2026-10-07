// ==============================================================================
// AniDub India — Firebase & Firestore Client Configuration
// ==============================================================================
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  Firestore, 
  doc, 
  getDocFromServer, 
  setLogLevel,
  enableMultiTabIndexedDbPersistence,
  enableIndexedDbPersistence
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getDatabase, Database, ref, push, set, get, remove, onValue } from 'firebase/database';

// Silence Firebase database warnings and image color extraction fallback warnings in console
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (
      msg.includes('@firebase/database') || 
      msg.includes('FastAverageColor') || 
      msg.includes('DynamicAmbientGlow') || 
      msg.includes('AnimeDetailPage')
    ) {
      return;
    }
    originalWarn(...args);
  };
}
import firebaseConfigJson from '../../firebase-applet-config.json';

// Silence technical Firestore logs (prevents 'Could not reach Cloud Firestore backend' noise)
setLogLevel('silent');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || firebaseConfigJson.appId,
  databaseURL: 'https://keen-matrix-p40ks-default-rtdb.firebaseio.com'
};

// Initialize Firebase App safely (singleton pattern for Next.js hot-reload)
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);
export const googleProvider: GoogleAuthProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firebase Realtime Database (RTDB)
export const rtdb: Database = getDatabase(app, 'https://keen-matrix-p40ks-default-rtdb.firebaseio.com');
export { ref, push, set, get, remove, onValue };

// Initialize Cloud Firestore with target database ID
const databaseId = firebaseConfigJson.firestoreDatabaseId && firebaseConfigJson.firestoreDatabaseId !== '(default)'
  ? firebaseConfigJson.firestoreDatabaseId
  : undefined;

export const db: Firestore = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

// Native Multi-Tab IndexedDB Offline Persistence with single-tab fallback
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('[Firestore Persistence] Multiple tabs open; persistence active in primary tab.');
    } else if (err.code === 'unimplemented') {
      // Browser does not support multi-tab persistence, fallback to standard IndexedDB persistence
      enableIndexedDbPersistence(db).catch((singleErr) => {
        console.warn('[Firestore Persistence] Single-tab persistence fallback error:', singleErr?.message);
      });
    } else {
      console.info('[Firestore Persistence] Persistence status:', err?.message || err);
    }
  });
}

// Connection test helper
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'system', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Client appears offline or firestore connecting...');
    }
    return false;
  }
}

export default db;
