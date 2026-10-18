import { useEffect, useRef, useState } from 'react';
import { isFirebaseEnabled, getFirestoreStore } from './firebase';

/**
 * Keeps a list of records in sync with the artifact's shared database (Claude's `db` capability),
 * or to Firebase in the standalone app, so office staff, technicians and Claude all see the same
 * data. With neither available the app keeps working with its local data.
 */

type WithId = { id: string };

// Sorted-key JSON so the same record always serializes identically
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

let dbPromise: Promise<any | null> | null = null;
function getDb(): Promise<any | null> {
  if (!dbPromise) {
    // Inside Claude: the artifact's shared store. Standalone app: Firebase.
    const claude = (window as any).claude;
    dbPromise = claude?.use
      ? claude.use('db').catch(() => null)
      : Promise.resolve(isFirebaseEnabled() ? getFirestoreStore() : null);
  }
  return dbPromise!;
}

export type CloudStatus = 'local' | 'connecting' | 'synced' | 'error';

export function useCloudCollection<T extends WithId>(
  collectionName: string,
  items: T[],
  setItems: (items: T[]) => void
): CloudStatus {
  const [status, setStatus] = useState<CloudStatus>('connecting');
  const collectionRef = useRef<any>(null);
  const syncedRef = useRef<Map<string, string>>(new Map());
  const loadedRef = useRef(false);
  const writeChainsRef = useRef<Map<string, Promise<void>>>(new Map());

  // Subscribe once to the shared collection
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    getDb().then((db) => {
      if (cancelled) return;
      if (!db) {
        setStatus('local');
        return;
      }
      const col = db.collection(collectionName);
      collectionRef.current = col;
      unsubscribe = col.onSnapshot(
        (snap: any) => {
          const next = new Map<string, string>();
          const docs: T[] = snap.docs.map((d: any) => {
            const data = { ...(d.data() as object), id: d.id } as T;
            next.set(d.id, stableStringify(data));
            return data;
          });
          syncedRef.current = next;
          loadedRef.current = true;
          setItems(docs);
          setStatus('synced');
        },
        () => setStatus('error')
      );
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [collectionName]);

  // Push local changes (edits made in the app) to the shared collection
  useEffect(() => {
    const col = collectionRef.current;
    if (!col || !loadedRef.current) return;
    const synced = syncedRef.current;
    const seen = new Set<string>();

    const enqueue = (id: string, op: () => Promise<void>) => {
      const prev = writeChainsRef.current.get(id) ?? Promise.resolve();
      const next = prev.then(op).catch(() => setStatus('error'));
      writeChainsRef.current.set(id, next);
    };

    items.forEach((item) => {
      seen.add(item.id);
      const json = stableStringify(item);
      if (synced.get(item.id) === json) return;
      synced.set(item.id, json);
      const body = JSON.parse(json);
      enqueue(item.id, () => col.doc(item.id).set(body));
    });

    Array.from(synced.keys()).forEach((id) => {
      if (seen.has(id)) return;
      synced.delete(id);
      enqueue(id, () => col.doc(id).delete());
    });
  }, [items]);

  return status;
}
