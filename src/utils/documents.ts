import { compressImage } from './tickets';

// A page must fit in one database document (1 MB) as a JPEG data URL
const MAX_PAGE_CHARS = 900_000;
export const MAX_DOC_PAGES = 8;

/** Canvas to a JPEG that fits the database: lowers quality, then size, until it fits. */
export function canvasToFittingJpeg(source: HTMLCanvasElement): string {
  let canvas = source;
  for (let round = 0; round < 6; round++) {
    for (const q of [0.82, 0.7, 0.6]) {
      const url = canvas.toDataURL('image/jpeg', q);
      if (url.length < MAX_PAGE_CHARS) return url;
    }
    const smaller = document.createElement('canvas');
    smaller.width = Math.round(canvas.width * 0.8);
    smaller.height = Math.round(canvas.height * 0.8);
    const ctx = smaller.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, smaller.width, smaller.height);
    ctx.drawImage(canvas, 0, 0, smaller.width, smaller.height);
    canvas = smaller;
  }
  throw new Error('too-big');
}

/** Each page of a PDF as an image (long side about 1600 px). Only the first pages if it is long. */
async function pdfToImages(file: File): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= Math.min(pdf.numPages, MAX_DOC_PAGES); n++) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 1600 / Math.max(base.width, base.height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push(canvasToFittingJpeg(canvas));
  }
  return pages;
}

/** A picked photo or PDF as page images, ready to annotate and sign. */
export async function fileToPages(file: File): Promise<string[]> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return pdfToImages(file);
  if (file.type.startsWith('image/')) return [await compressImage(file)];
  throw new Error('unsupported');
}
