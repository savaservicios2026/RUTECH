import { collection, deleteDoc, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { Attachment } from '../types';
import { getFirestoreDb, getFirebaseAuth } from './firebase';
import { compressImage, readAsDataUrl } from './tickets';

// One Firestore document holds at most 1 MB, so each file has to fit in that
const MAX_FILE_CHARS = 950_000;

/** Turns a picked photo or file into an attachment that fits the database, or explains why not. */
export async function prepareAttachment(
  file: File,
  serviceId: string,
  section: Attachment['section']
): Promise<Attachment> {
  let dataUrl: string;
  let type = file.type || 'application/octet-stream';
  if (file.type.startsWith('image/') && !file.type.includes('gif')) {
    dataUrl = await compressImage(file);
    type = 'image/jpeg';
  } else {
    dataUrl = await readAsDataUrl(file);
    if (dataUrl.length > MAX_FILE_CHARS) throw new Error('too-big');
  }
  return {
    id: `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    serviceId,
    section,
    name: file.name.slice(0, 120),
    type,
    dataUrl,
    createdAt: new Date().toISOString(),
    by: getFirebaseAuth()?.currentUser?.email || undefined,
  };
}

export async function saveAttachment(att: Attachment): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('no-db');
  await setDoc(doc(db, 'attachments', att.id), JSON.parse(JSON.stringify(att)));
}

export async function removeAttachment(id: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  await deleteDoc(doc(db, 'attachments', id));
}

/** Live list of a job's attachments (photos and files of the service and of its work order). */
export function watchAttachments(serviceId: string, onChange: (items: Attachment[]) => void): () => void {
  const db = getFirestoreDb();
  if (!db) {
    onChange([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(db, 'attachments'), where('serviceId', '==', serviceId)),
    (snap) =>
      onChange(
        snap.docs
          .map((d) => ({ ...(d.data() as Attachment), id: d.id }))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      ),
    () => onChange([])
  );
}

/** Opens an attachment in a new tab (data URLs cannot be opened directly as a link). */
export function openAttachment(att: Attachment) {
  const [meta, b64] = att.dataUrl.split(',');
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: meta.match(/data:([^;]+)/)?.[1] || att.type });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.download = att.name;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
