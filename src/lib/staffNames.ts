/**
 * Who is using this device. Names are kept on the device only, so the
 * person picks their name once and every stock movement is recorded under it.
 */
const NAMES_KEY = 'bahubali_staff_names';
const CURRENT_KEY = 'bahubali_current_staff';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the name lasts for this session only */
  }
}

export function getStaffNames(): string[] {
  const names = read<string[]>(NAMES_KEY, []);
  return Array.isArray(names) ? names.filter((n) => typeof n === 'string' && n.trim()) : [];
}

export function saveStaffNames(names: string[]) {
  write(NAMES_KEY, names);
}

export function getCurrentStaff(): string | null {
  const name = read<string | null>(CURRENT_KEY, null);
  return typeof name === 'string' && name.trim() ? name : null;
}

export function setCurrentStaff(name: string | null) {
  write(CURRENT_KEY, name);
}

export function cleanName(input: string) {
  return input.replace(/\s+/g, ' ').trim().slice(0, 40);
}

// ---------- Sharing the list between phones (offline: QR code / link / pasted code) ----------

const CODE_PREFIX = 'BN1.';

function toBase64Url(text: string) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string) {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Short code that carries the name list, e.g. "BN1.WyJBbWl0IiwiUmFqIl0" */
export function encodeNames(names: string[]) {
  return CODE_PREFIX + toBase64Url(JSON.stringify(names));
}

/** Link that opens the app and adds the names (used for the QR code). */
export function shareLinkForNames(names: string[]) {
  return `${window.location.origin}/?names=${encodeURIComponent(encodeNames(names))}`;
}

/** Accepts a code or a full share link; returns the names, or null if it isn't one. */
export function decodeNames(input: string): string[] | null {
  const text = input.trim();
  let code = text;
  const fromLink = /[?&]names=([^&\s]+)/.exec(text);
  if (fromLink) code = decodeURIComponent(fromLink[1]);
  if (!code.startsWith(CODE_PREFIX)) return null;
  try {
    const list = JSON.parse(fromBase64Url(code.slice(CODE_PREFIX.length)));
    if (!Array.isArray(list)) return null;
    return list.filter((n) => typeof n === 'string').map(cleanName).filter(Boolean);
  } catch {
    return null;
  }
}

/** Adds names to this phone's list (no duplicates, case-insensitive). Returns how many were new. */
export function mergeStaffNames(incoming: string[]): number {
  const current = getStaffNames();
  const seen = new Set(current.map((n) => n.toLowerCase()));
  const added = incoming.filter((n) => {
    const key = n.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (added.length) saveStaffNames([...current, ...added].sort((a, b) => a.localeCompare(b)));
  return added.length;
}

/** If the app was opened from a share link/QR, import the names and clean the URL. */
export function importNamesFromUrl(): { added: number; total: number } | null {
  try {
    const url = new URL(window.location.href);
    const param = url.searchParams.get('names');
    if (!param) return null;
    url.searchParams.delete('names');
    window.history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
    const names = decodeNames(param);
    if (!names) return null;
    return { added: mergeStaffNames(names), total: names.length };
  } catch {
    return null;
  }
}
