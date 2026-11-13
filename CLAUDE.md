# Project rules

- Read `HANDOFF.md` first: it describes the app, the live services and the owner's rules.
- **Keep `HANDOFF.md` up to date.** Every change that adds or alters a feature, a file, the database, the edge function or a known caveat must update `HANDOFF.md` in the same commit, including a line in "Feature history".
- After every change, `npm run build` must pass. Then commit, push and fast-forward `main` without asking.
