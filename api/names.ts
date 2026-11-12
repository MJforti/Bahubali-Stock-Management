/**
 * Short codes for the staff name list.
 *
 * POST /api/names  { roster }  -> { code: "K7QM2X" }   (stores the list for 7 days)
 * GET  /api/names?code=K7QM2X  -> { roster }
 *
 * Codes are 6 characters from an alphabet without look-alikes (no I, L, O, U,
 * no 0/1), case-insensitive, so they can be read out loud. Lists are kept in
 * Vercel Blob storage; only this function reads and writes them.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put, head } from '@vercel/blob';
import { randomInt } from 'node:crypto';

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'; // 30 symbols, ~729 million codes
const CODE_LENGTH = 6;
const MAX_ENTRIES = 300;
const MAX_BODY_BYTES = 30_000;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface Entry {
  n: string;
  t: number;
  r?: 1;
}

const pathFor = (code: string) => `name-lists/${code}.json`;

function newCode() {
  let c = '';
  for (let i = 0; i < CODE_LENGTH; i++) c += ALPHABET[randomInt(ALPHABET.length)];
  return c;
}

/** Accepts "k7q-m2x", "K7Q M2X" etc. */
function normalizeCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const c = input.toUpperCase().replace(/[\s-]/g, '');
  if (c.length !== CODE_LENGTH) return null;
  for (const ch of c) if (!ALPHABET.includes(ch)) return null;
  return c;
}

function validRoster(x: unknown): Entry[] | null {
  if (!Array.isArray(x) || x.length > MAX_ENTRIES) return null;
  const out: Entry[] = [];
  for (const e of x) {
    if (!e || typeof e.n !== 'string' || typeof e.t !== 'number' || !isFinite(e.t)) return null;
    const n = e.n.replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!n) continue;
    out.push(e.r ? { n, t: e.t, r: 1 } : { n, t: e.t });
  }
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'POST') {
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
      if (raw.length > MAX_BODY_BYTES) return res.status(413).json({ error: 'List is too large' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const roster = validRoster(body?.roster);
      if (!roster) return res.status(400).json({ error: 'Not a valid name list' });

      // Pick a code that isn't in use
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = newCode();
        const exists = await head(pathFor(code)).then(() => true, () => false);
        if (exists) continue;
        await put(pathFor(code), JSON.stringify({ roster, created: Date.now() }), {
          access: 'public',
          contentType: 'application/json',
          addRandomSuffix: false,
          cacheControlMaxAge: 60
        });
        return res.status(201).json({ code, expires: Date.now() + TTL_MS });
      }
      return res.status(503).json({ error: 'Could not make a code, please try again' });
    }

    if (req.method === 'GET') {
      const code = normalizeCode(req.query.code);
      if (!code) return res.status(400).json({ error: 'Codes are 6 letters and numbers' });
      const meta = await head(pathFor(code)).catch(() => null);
      if (!meta) return res.status(404).json({ error: 'No list found for that code' });
      const stored = await fetch(meta.url).then((r) => r.json());
      if (!stored || Date.now() - Number(stored.created) > TTL_MS) {
        return res.status(410).json({ error: 'That code has expired. Make a new one' });
      }
      return res.status(200).json({ roster: stored.roster });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('names api error', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again' });
  }
}
