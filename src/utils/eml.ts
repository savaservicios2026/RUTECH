/**
 * Builds an email file (.eml) with attachments that opens in Outlook as a new message ready to
 * send ("X-Unsent: 1"): To, subject, text and the photos and videos already attached.
 */
export interface EmlAttachment {
  name: string;
  dataUrl: string; // data:<type>;base64,<data>
}

const b64 = (text: string) => btoa(unescape(encodeURIComponent(text)));
const wrap = (s: string) => s.replace(/.{1,76}/g, '$&\r\n');
const encodedWord = (text: string) => `=?UTF-8?B?${b64(text)}?=`;

export function buildEml(to: string, subject: string, body: string, attachments: EmlAttachment[]): Blob {
  const boundary = `----=_RUTECH_${Date.now().toString(36)}`;
  const parts: string[] = [
    `To: ${to}`,
    `Subject: ${encodedWord(subject)}`,
    'X-Unsent: 1',
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(b64(body)),
  ];
  attachments.forEach((a) => {
    const [meta, data] = a.dataUrl.split(',');
    const type = meta.match(/data:([^;]+)/)?.[1] || 'application/octet-stream';
    parts.push(
      `--${boundary}`,
      `Content-Type: ${type}; name="${encodedWord(a.name)}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${encodedWord(a.name)}"`,
      '',
      wrap(data)
    );
  });
  parts.push(`--${boundary}--`, '');
  return new Blob([parts.join('\r\n')], { type: 'message/rfc822' });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
