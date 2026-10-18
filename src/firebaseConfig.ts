/**
 * Firebase project used by the standalone RUTECH app (shared data + worker logins).
 * Paste the `firebaseConfig` object from Firebase console > Project settings > Your apps here.
 * While it is null the app keeps data on the device only (or in Claude's shared store when opened in Claude).
 */
export const FIREBASE_CONFIG: null | {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
} = null;
