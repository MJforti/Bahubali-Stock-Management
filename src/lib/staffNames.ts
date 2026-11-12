/**
 * Who is using this device, and the shared staff list.
 *
 * The list is a small roster of change records: each name is either added
 * or removed, with the time of that change. It syncs through the central
 * database; when two versions meet, the newest change for each name wins.
 * That way removals spread to every phone, and adding someone back later
 * wins over an older removal.
 */
import { queue } from './localDb';

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

/** Fired whenever the staff list changes (here, in another tab, or through sync). */
export const STAFF_CHANGED_EVENT = 'bahubali-staff';

function saveRoster(roster: RosterEntry[]) {
  write(ROSTER_KEY, roster);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(STAFF_CHANGED_EVENT));
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
  queue([{ kind: 'staff', name: clean }]).catch(() => {});
}

export function addStaffName(name: string) {
  setEntry(name, false);
}

export function removeStaffName(name: string) {
  setEntry(name, true);
}

/**
 * Merges another roster (from the central database or a shared code): newest
 * change per name wins. Returns what changed here.
 * Pass queueChanges=false when the roster came from the central database.
 */
export function mergeRoster(incoming: RosterEntry[], queueChanges = true): { added: string[]; removed: string[] } {
  const mine = new Map(getRoster().map((e) => [keyOf(e.n), e]));
  const added: string[] = [];
  const removed: string[] = [];
  const changedNames: string[] = [];
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
    changedNames.push(entry.n);
  }
  saveRoster(Array.from(mine.values()));
  if (queueChanges && changedNames.length) queue(changedNames.map((name) => ({ kind: 'staff' as const, name }))).catch(() => {});
  return { added, removed };
}

export function getCurrentStaff(): string | null {
  const name = read<string | null>(CURRENT_KEY, null);
  return typeof name === 'string' && name.trim() ? name : null;
}

export function setCurrentStaff(name: string | null) {
  write(CURRENT_KEY, name);
}
