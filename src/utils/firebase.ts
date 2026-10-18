import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  Firestore,
} from 'firebase/firestore';
import { FIREBASE_CONFIG } from '../firebaseConfig';

let app: FirebaseApp | null = null;
let firestore: Firestore | null = null;
let auth: Auth | null = null;

function init() {
  if (app || !FIREBASE_CONFIG) return;
  app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  // Offline cache so technicians can keep working with poor coverage
  firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
}

export function isFirebaseEnabled(): boolean {
  return FIREBASE_CONFIG !== null;
}

export function getFirebaseAuth(): Auth | null {
  init();
  return auth;
}

/** Same small surface the app uses from Claude's shared store, backed by Firestore. */
export function getFirestoreStore() {
  init();
  if (!firestore) return null;
  const fs = firestore;
  return {
    collection(name: string) {
      return {
        onSnapshot(next: (snap: { docs: { id: string; data(): object }[] }) => void, error: (e: unknown) => void) {
          return onSnapshot(
            collection(fs, name),
            (snap) => next({ docs: snap.docs.map((d) => ({ id: d.id, data: () => d.data() })) }),
            error
          );
        },
        doc(id: string) {
          return {
            set: (body: object) => setDoc(doc(fs, name, id), body),
            delete: () => deleteDoc(doc(fs, name, id)),
          };
        },
      };
    },
  };
}
