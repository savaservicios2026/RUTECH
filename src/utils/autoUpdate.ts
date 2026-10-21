/**
 * Keeps every phone on the latest version: when a new version is published, the app reloads
 * itself. It waits while a form is open (e.g. a work order being filled in) so nothing is lost,
 * and reloads at once when the app comes back from the background.
 */
const CHECK_EVERY_MS = 2 * 60 * 1000;

async function latestBuild(): Promise<string | null> {
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json())?.build || null;
  } catch {
    return null;
  }
}

// Forms and dialogs are full-screen overlays
const formOpen = () => !!document.querySelector('.fixed.inset-0');

export function startAutoUpdate() {
  if (location.protocol !== 'https:') return;
  let pending: string | null = null;
  // Load the page again asking for that version, so no cached copy of the old one is used.
  // Only once every few minutes for the same version, in case the server still sends the old one.
  const reload = () => {
    const key = `rutech-update-${pending}`;
    try {
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last < 5 * 60 * 1000) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {}
    location.replace(`${location.pathname}?v=${pending}${location.hash}`);
  };

  const check = async () => {
    if (!pending) {
      const build = await latestBuild();
      if (!build || build === __BUILD_ID__) return;
      pending = build;
    }
    if (document.visibilityState === 'hidden' || !formOpen()) reload();
  };

  setInterval(check, CHECK_EVERY_MS);
  // Coming back to the app (unlocking the phone, switching from WhatsApp): check straight away
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.addEventListener('focus', check);
  // A form closed while an update was waiting
  document.addEventListener('click', () => {
    if (pending) setTimeout(() => !formOpen() && reload(), 800);
  });
  check();
}
