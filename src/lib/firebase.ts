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
  enableMultiTabIndexedDbPersistence
} from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Silence technical Firestore logs (prevents 'Could not reach Cloud Firestore backend' noise)
setLogLevel('silent');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || (firebaseConfigJson as any).databaseURL,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || firebaseConfigJson.appId,
};

// Initialize Firebase App safely (singleton pattern for Next.js hot-reload)
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);
export const googleProvider: GoogleAuthProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Cloud Firestore with target database ID
const databaseId = firebaseConfigJson.firestoreDatabaseId && firebaseConfigJson.firestoreDatabaseId !== '(default)'
  ? firebaseConfigJson.firestoreDatabaseId
  : undefined;

export const db: Firestore = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
export const rtdb: Database = getDatabase(app);

// Native Multi-Tab IndexedDB Offline Persistence
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('[Firestore Persistence] Multiple tabs open; persistence active in primary tab.');
    } else if (err.code === 'unimplemented') {
      console.warn('[Firestore Persistence] Browser does not support multi-tab IndexedDB persistence.');
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
