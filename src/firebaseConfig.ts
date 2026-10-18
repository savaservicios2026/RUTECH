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
} = {
  apiKey: "AIzaSyBuBlY62FvQhA3aJ-JDJgxVexgs1Kay4Uo",
  authDomain: "rutech-61f25.firebaseapp.com",
  projectId: "rutech-61f25",
  storageBucket: "rutech-61f25.firebasestorage.app",
  messagingSenderId: "720563381196",
  appId: "1:720563381196:web:bc1f2ce7bb84a66742b369",
};
