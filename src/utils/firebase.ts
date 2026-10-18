import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, signOut, Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDoc,
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

export function getFirestoreDb(): Firestore | null {
  init();
  return firestore;
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
        onSnapshot(
          next: (snap: { docs: { id: string; data(): object }[]; fromCache: boolean }) => void,
          error: (e: unknown) => void
        ) {
          return onSnapshot(
            collection(fs, name),
            (snap) =>
              next({
                docs: snap.docs.map((d) => ({ id: d.id, data: () => d.data() })),
                fromCache: snap.metadata.fromCache,
              }),
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

export type RoleRecord = { role: 'oficina' | 'tecnico'; technicianId?: string };

/** The role the office gave this login (roles/{email}), or null if it has none. */
export async function getRole(email: string): Promise<RoleRecord | null> {
  init();
  if (!firestore) return null;
  const snap = await getDoc(doc(firestore, 'roles', email.toLowerCase()));
  return snap.exists() ? (snap.data() as RoleRecord) : null;
}

/** Office only: gives a technician's login email access to their own jobs. */
export async function ensureTechnicianRole(email: string, technicianId: string): Promise<void> {
  init();
  if (!firestore) return;
  const ref = doc(firestore, 'roles', email.toLowerCase());
  const current = await getDoc(ref);
  const data = current.exists() ? (current.data() as RoleRecord) : null;
  if (data?.role === 'oficina' || (data?.role === 'tecnico' && data.technicianId === technicianId)) return;
  await setDoc(ref, { role: 'tecnico', technicianId });
}

export async function signOutUser(): Promise<void> {
  init();
  if (auth) await signOut(auth);
}
