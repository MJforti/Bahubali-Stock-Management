/**
 * Who is using this device, and the shared staff list.
 *
 * The list is a small roster of change records: each name is either added
 * or removed, with the time of that change. Phones exchange the whole
 * roster through a QR code or link, and when two rosters meet the newest
 * change for each name wins. That way removals spread to other phones
 * too, and adding someone back later wins over an older removal.
 */
const ROSTER_KEY = 'bahubali_staff_roster';
const LEGACY_NAMES_KEY = 'bahubali_staff_names';
const CURRENT_KEY = 'bahubali_current_staff';

/** n = name, t = time of last change (ms), r = 1 when removed */
export interface RosterEntry {
  n: string;
  t: number;
  r?: 1;
}

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
    /* storage unavailable: changes last for this session only */
  }
}

export function cleanName(input: string) {
  return input.replace(/\s+/g, ' ').trim().slice(0, 40);
}

const keyOf = (name: string) => name.toLowerCase();

function isEntry(e: any): e is RosterEntry {
  return e && typeof e.n === 'string' && cleanName(e.n) !== '' && typeof e.t === 'number' && isFinite(e.t);
}

export function getRoster(): RosterEntry[] {
  const stored = read<unknown>(ROSTER_KEY, null);
  if (Array.isArray(stored)) return stored.filter(isEntry);
  // One-time upgrade from the plain name list (treated as the oldest possible changes)
  const legacy = read<unknown>(LEGACY_NAMES_KEY, []);
  const roster: RosterEntry[] = Array.isArray(legacy)
    ? legacy.filter((n): n is string => typeof n === 'string' && cleanName(n) !== '').map((n) => ({ n: cleanName(n), t: 1 }))
    : [];
  write(ROSTER_KEY, roster);
  return roster;
}

function saveRoster(roster: RosterEntry[]) {
  write(ROSTER_KEY, roster);
}

/** Names currently on the list, sorted. */
export function getStaffNames(): string[] {
  return getRoster()
    .filter((e) => !e.r)
    .map((e) => e.n)
    .sort((a, b) => a.localeCompare(b));
}

function setEntry(name: string, removed: boolean) {
  const clean = cleanName(name);
  const roster = getRoster().filter((e) => keyOf(e.n) !== keyOf(clean));
  const prev = getRoster().find((e) => keyOf(e.n) === keyOf(clean));
  // Strictly newer than anything seen for this name, even if the phone clock is behind
  const t = Math.max(Date.now(), (prev?.t ?? 0) + 1);
  roster.push(removed ? { n: clean, t, r: 1 } : { n: clean, t });
  saveRoster(roster);
}

export function addStaffName(name: string) {
  setEntry(name, false);
}

export function removeStaffName(name: string) {
  setEntry(name, true);
}

/** Merges another phone's roster: newest change per name wins. Returns what changed here. */
export function mergeRoster(incoming: RosterEntry[]): { added: string[]; removed: string[] } {
  const mine = new Map(getRoster().map((e) => [keyOf(e.n), e]));
  const added: string[] = [];
  const removed: string[] = [];
  for (const e of incoming.filter(isEntry)) {
    const entry: RosterEntry = e.r ? { n: cleanName(e.n), t: e.t, r: 1 } : { n: cleanName(e.n), t: e.t };
    const k = keyOf(entry.n);
    const cur = mine.get(k);
    if (cur && cur.t >= entry.t) continue;
    const wasActive = cur ? !cur.r : false;
    const nowActive = !entry.r;
    if (!wasActive && nowActive) added.push(entry.n);
    if (wasActive && !nowActive) removed.push(cur!.n);
    mine.set(k, entry);
  }
  saveRoster(Array.from(mine.values()));
  return { added, removed };
}

export function getCurrentStaff(): string | null {
  const name = read<string | null>(CURRENT_KEY, null);
  return typeof name === 'string' && name.trim() ? name : null;
}

export function setCurrentStaff(name: string | null) {
  write(CURRENT_KEY, name);
}

// ---------- Sharing between phones (offline: QR code / link / pasted code) ----------

const CODE_V1 = 'BN1.'; // plain list of names (older app version)
const CODE_V2 = 'BN2.'; // roster with removals: [name, time, removed?][]

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

/** Code carrying this phone's whole roster, including removals. Times are sent in seconds to keep the QR small. */
export function encodeRoster(roster: RosterEntry[] = getRoster()) {
  const compact = roster.map((e) => (e.r ? [e.n, Math.ceil(e.t / 1000), 1] : [e.n, Math.ceil(e.t / 1000)]));
  return CODE_V2 + toBase64Url(JSON.stringify(compact));
}

/** Link that opens the app and applies the roster (used for the QR code). */
export function shareLink() {
  return `${window.location.origin}/?names=${encodeURIComponent(encodeRoster())}`;
}

/** Accepts a code or a full share link (new or old format); returns roster entries, or null. */
export function decodeShared(input: string): RosterEntry[] | null {
  let code = input.trim();
  const fromLink = /[?&]names=([^&\s]+)/.exec(code);
  if (fromLink) code = decodeURIComponent(fromLink[1]);
  try {
    if (code.startsWith(CODE_V2)) {
      const list = JSON.parse(fromBase64Url(code.slice(CODE_V2.length)));
      if (!Array.isArray(list)) return null;
      return list
        .filter((x) => Array.isArray(x) && typeof x[0] === 'string' && typeof x[1] === 'number')
        .map((x) => (x[2] ? { n: cleanName(x[0]), t: x[1] * 1000, r: 1 as const } : { n: cleanName(x[0]), t: x[1] * 1000 }))
        .filter(isEntry);
    }
    if (code.startsWith(CODE_V1)) {
      const list = JSON.parse(fromBase64Url(code.slice(CODE_V1.length)));
      if (!Array.isArray(list)) return null;
      // Old codes only know additions; give them the oldest time so they never undo a removal
      return list.filter((n) => typeof n === 'string' && cleanName(n)).map((n) => ({ n: cleanName(n), t: 1 }));
    }
  } catch {
    return null;
  }
  return null;
}

export interface ImportResult {
  added: string[];
  removed: string[];
}

/** If the app was opened from a share link/QR, apply it and clean the URL. */
export function importFromUrl(): ImportResult | null {
  try {
    const url = new URL(window.location.href);
    const param = url.searchParams.get('names');
    if (!param) return null;
    url.searchParams.delete('names');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    const roster = decodeShared(param);
    return roster ? mergeRoster(roster) : null;
  } catch {
    return null;
  }
}

export function describeImport(r: ImportResult): string {
  const parts: string[] = [];
  if (r.added.length) parts.push(`added ${r.added.join(', ')}`);
  if (r.removed.length) parts.push(`removed ${r.removed.join(', ')}`);
  if (!parts.length) return 'This phone was already up to date';
  const text = parts.join(' and ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------- Short 6-character codes (online) ----------

const SHORT_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/** "k7q m2x" / "K7Q-M2X" -> "K7QM2X", or null if it isn't a short code. */
export function normalizeShortCode(input: string): string | null {
  const c = input.toUpperCase().replace(/[\s-]/g, '');
  if (c.length !== 6) return null;
  for (const ch of c) if (!SHORT_ALPHABET.includes(ch)) return null;
  return c;
}

/** "K7QM2X" -> "K7Q M2X" for reading out loud */
export const formatShortCode = (c: string) => `${c.slice(0, 3)} ${c.slice(3)}`;

async function apiError(res: Response, fallback: string) {
  try {
    const body = await res.json();
    return new Error(body?.error || fallback);
  } catch {
    return new Error(fallback);
  }
}

/** Uploads this phone's list and returns a short code (needs internet). */
export async function createShortCode(): Promise<string> {
  if (!navigator.onLine) throw new Error('No internet. Use the long code or QR code instead');
  let res: Response;
  try {
    res = await fetch('/api/names', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roster: getRoster() })
    });
  } catch {
    throw new Error('No internet. Use the long code or QR code instead');
  }
  if (!res.ok) throw await apiError(res, 'Could not make a short code right now');
  const { code } = await res.json();
  return code;
}

/** Looks up a short code and returns the list it holds (needs internet). */
export async function fetchShortCode(code: string): Promise<RosterEntry[]> {
  let res: Response;
  try {
    res = await fetch(`/api/names?code=${encodeURIComponent(code)}`, { cache: 'no-store' });
  } catch {
    throw new Error('Short codes need internet. Try again when connected, or use the long code');
  }
  if (!res.ok) throw await apiError(res, 'Could not look up that code');
  const { roster } = await res.json();
  if (!Array.isArray(roster)) throw new Error('Could not look up that code');
  return roster;
}
