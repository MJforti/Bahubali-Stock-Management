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
