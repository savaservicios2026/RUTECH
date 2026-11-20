// Turns an attached quote (PDF made by Teamleader) into the list of things to load for a delivery
// (Pablo, 2026-11-20: the technician ticks what is there; what is not ticked stays as missing).

export type QuoteLine = { code?: string; text: string; qty: number };

const SKIP = /^(portes|transporte|env[ií]o|montaje|instalaci[oó]n|descuento)\b/i;

/** Rows of text of a quote (one per printed line, columns joined by spaces) to its article lines. */
export function parseQuoteRows(rows: string[]): QuoteLine[] {
  const out: QuoteLine[] = [];
  let open: QuoteLine | null = null; // last line whose description wraps to the next row
  for (const raw of rows) {
    const row = raw.replace(/\s+/g, ' ').trim();
    // "MH003: Mancuerna Hexagonal 3 kgs 2 € 7,6032 21% € 3,19 € 15,21"
    const m = row.match(/^(.+?) (\d+(?:[.,]\d+)?) € ?[\d.,]+ \d+ ?% /);
    if (m) {
      let desc = m[1].trim();
      const qty = Number(m[2].replace(',', '.'));
      open = null;
      if (/^descripci[oó]n\b/i.test(desc) || SKIP.test(desc) || !qty) continue;
      let code: string | undefined;
      const c = desc.match(/^([A-Z0-9][A-Z0-9 _./-]{1,30}?): (.+)$/);
      if (c) { code = c[1].trim(); desc = c[2].trim(); }
      const line: QuoteLine = { code, text: desc, qty };
      out.push(line);
      if ((desc.match(/\(/g) || []).length > (desc.match(/\)/g) || []).length || /[-–]$/.test(desc)) open = line;
      continue;
    }
    // A long name continues on the next row, e.g. "Olympic Bar (2.2m - Handle Ø 28mm -" + "Load 700kg)"
    if (open && row && row.length < 60 && !/€/.test(row)) {
      open.text = `${open.text} ${row}`.replace(/ [-–] *$/, ' -');
      if ((open.text.match(/\(/g) || []).length <= (open.text.match(/\)/g) || []).length && !/[-–]$/.test(open.text)) open = null;
    } else open = null;
  }
  return out;
}

/** The rows of text of a PDF (from its data URL), top to bottom, page by page. */
export async function pdfRows(data: Uint8Array): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  if (typeof window !== 'undefined') {
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }
  const pdf = await pdfjs.getDocument({ data }).promise;
  const rows: string[] = [];
  for (let n = 1; n <= Math.min(pdf.numPages, 10); n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    const byY: { y: number; parts: { x: number; s: string }[] }[] = [];
    for (const it of content.items as { str: string; transform: number[] }[]) {
      if (!it.str?.trim()) continue;
      const x = it.transform[4], y = it.transform[5];
      let r = byY.find((g) => Math.abs(g.y - y) < 3);
      if (!r) byY.push((r = { y, parts: [] }));
      r.parts.push({ x, s: it.str });
    }
    byY.sort((a, b) => b.y - a.y);
    for (const r of byY) rows.push(r.parts.sort((a, b) => a.x - b.x).map((p) => p.s.trim()).join(' '));
  }
  return rows;
}

export async function quoteLinesFromDataUrl(dataUrl: string): Promise<QuoteLine[]> {
  const b64 = dataUrl.split(',', 2)[1] || '';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return parseQuoteRows(await pdfRows(bytes));
}
