# Handoff: Bahubali Stock Management

Use this file to hand the project to another AI coding agent, or to a developer. Paste the prompt below into the agent and point it at this repository. It should read this whole file before changing anything.

---

## Prompt to give the agent

> You are taking over an existing, live project: a stock management app for **Bahubali Enterprises**, a hardware shop with several stores and godowns in India. It is a React web app that can be installed on phones (a PWA) and works offline. Staff use it on their phones every day.
>
> Read `HANDOFF.md` from start to finish before doing anything. It describes how the app works, the live services and the rules the owner has set. Then read the files it points to for your task.
>
> Rules:
> 1. **The app is live and has real stock data.** Never wipe, reset or reseed the database. Never drop tables or delete rows unless the owner asks for exactly that.
> 2. **The owner does not want to deal with the database.** Make every database change yourself (Supabase SQL / migrations). Keep it readable: clear table names, views with plain column names, and comments.
> 3. **After every change:** run `npm run build`, which must pass. Commit with a clear message, push, and merge into `main` (fast-forward). The owner said "always merge it, never ask". Vercel deploys `main` automatically.
> 4. **Keep it working offline.** Every feature has to work with no internet and sync later. The phone's own database (IndexedDB) is what the app reads and writes. Supabase is the shared copy the phones sync with.
> 5. **Dark theme only.** Keep the existing look: graphite greys, one amber accent, lucide icons, no gradients or emoji. Copy is plain, short and sentence case.
> 6. **Design for phones first.** Check every screen at 390px wide. Tap targets should be at least 44px.
> 7. **Tell the truth about testing.** If you couldn't test something, such as a real phone notification, say so.
> 8. Don't put any model or AI names in commits or code.
> 9. **Keep this file up to date.** Any change to a feature, file, database object or known caveat updates `HANDOFF.md` in the same commit, including a line in "Feature history".
>
> The task is: **<describe what you want here>**

---

## 1. What the app does

- **Stock register** for products. A product has:
  - name, brand, SKU, category, unit, rack location
  - cost price and selling price
  - minimum stock
  - a photo
- **Several stores.** "Main Store" always exists; others are godowns or shops, such as "Hudumpur Godawan" or "ShopeNo-5". Stock is kept per store. The store bar under the header picks one store or **All stores**.
- **Stock movements:**
  - Stock in, Stock out and count corrections ("adjustment").
  - Transfers between stores: two linked movements, an OUT and an IN, sharing a `transfer_id`.
- **Staff vs admin:**
  - Anyone can record stock in, out and transfers, and can see cost price.
  - The admin code unlocks:
    - adding, editing and deleting products and data sheet rows
    - restoring backups
    - managing stores
  - The code is checked in `verifyAdminPasscode`. Its value is not written in this file.
- **Name picker:** each phone picks who is using it. The name goes into every history entry. The staff list is shared between phones through sync.
- **History tab:**
  - Sections: All, Stock, Products, People and access, Stores and backup, Daily summaries.
  - Every action is logged with who did it and when.
- **Overview charts** (`src/components/dashboard/OverviewCharts.tsx`):
  - Stock in and out per day for the last 14 days; tap or hover a day for its figures.
  - Stock health: in stock / low / out, as a labelled bar.
  - Stock value by category at cost price.
  - Most taken out in the last 30 days.
  - Stock by store, shown only for All stores with more than one store.
  - Drawn with plain SVG/HTML (no chart library) and follows the selected store.
  - Colours, already checked for colour-blind separation on the dark surface:
    - stock in `#3987e5` (blue), stock out `#d95926` (orange);
    - status: ok `#0ca30c`, low `#fab219`, out `#d03b3b`, always shown with a text label.
- **PDF stock report** (`src/services/pdfReport.ts`, using jsPDF and jspdf-autotable, loaded only when needed):
  - "PDF report" button in Products and in the Data sheet, for staff and admin.
  - Follows the selected store. All stores gets one column per store, in landscape.
  - Contents: summary boxes, the full stock table, a "To restock" list per store, and page numbers.
  - Prices are written as "Rs" because the built-in PDF font has no ₹ sign.
  - Installed iPhone apps use the share sheet; everywhere else the file downloads.
  - Tested on iPhone: it works.
- **Data sheet:**
  - A spreadsheet-style view.
  - Excel import, with a downloadable sample sheet that matches the columns.
  - Excel export and PDF report.
  - Admins can delete rows.
- **Backup and alerts window** (header button):
  - Download a backup or restore one.
  - Low stock alerts switch.
  - Daily summary switch.
  - Send test alert.
- **Notifications** (web push, which arrives even when the app is closed):
  - **Low stock alert:** sent when a product's stock in a store drops to its minimum ("low") or to zero or below ("out"). Each drop alerts once; restocking above the minimum lets it alert again.
  - **Daily summary at 8 PM India time:**
    - one line for each store where stock moved, plus a restock line;
    - also saved and shown in History → Daily summaries.
- **Phone app (PWA):**
  - Installable.
  - Fully offline.
  - On phones, a full-screen "Update now" screen appears when a new version is ready. On larger screens it's a banner.
  - A rescue screen with a "Reload app" button appears if the app fails to start, so it never stays on a black screen.

## 2. Tech stack

- React 18, TypeScript, Vite, Tailwind CSS. Tailwind's `slate` colours are remapped to graphite greys in `tailwind.config.js`. Font: Plus Jakarta Sans. Icons: lucide-react.
- `xlsx` for Excel (loaded only when needed). `browser-image-compression` for photos.
- `jspdf` and `jspdf-autotable` for the PDF report (loaded only when needed).
- `@supabase/supabase-js` for sync.
- Hosting: **Vercel**. Pushing to `main` deploys to production at https://bahubali-stock-management.vercel.app.
  - Vercel project: `bahubali-stock-management`, id `prj_1ymGTCCqUKiBFMn62PDhxptuIcEG`
  - Vercel team: `team_MjFJEMOc2Z3kskTopZ573hoF`
- Database: **Supabase** project `bpbhnnnrjckcqjvgogsu`, region ap-south-1.
  - URL: `https://bpbhnnnrjckcqjvgogsu.supabase.co`
  - The public "publishable" key is in `src/lib/sync.ts`. It is meant to be public; security comes from RLS.

Commands:

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

`npm run build` runs a type check and then builds into `dist/`, including `dist/sw.js`.

## 3. How the data works

### On the phone (source of truth for the UI)
`src/lib/localDb.ts` is IndexedDB, at `DB_VERSION` 4. It has these stores:
- `products`
- `stock_transactions`
- `activity`
- `outbox`: local changes waiting to be sent
- `stores`
- `meta`

Every write goes into the local database and the `outbox` in one transaction, so nothing is lost offline. Other open tabs are notified with `notifyOtherTabs`.

### Sync (`src/lib/sync.ts`)
- **Push:** the outbox is sent through SECURITY DEFINER RPCs:
  - `sync_stores`
  - `sync_products`
  - `sync_movements`
  - `sync_activity`
  - `sync_staff`
- **Pull:** each table has a `sync_seq` column. The phone keeps a cursor and fetches rows newer than it.
- **Realtime:** Supabase `postgres_changes` triggers a sync when another phone changes something.
- **Exports:** `startSync`, `syncNow`, `onSyncStatus`, `resendEverything`. The navbar shows the sync status.
- Stock is **replayed on the server**: `recalc_product_stock(product_id)` replays all movements per store in time order, from `products.opening_by_store`. It fills `products.stock_by_store` (jsonb, keyed by store id) and `current_stock` (the total). The phone mirrors this logic in `src/lib/stores.ts`: `stockIn`, `stockMap`, `totalOf`.
- `MAIN_STORE_ID = '00000000-0000-4000-8000-000000000001'`.
- **Conflict rules:** the staff list and stores use last-writer-wins by timestamp. Movements and activity are append-only and merged by id.

### Main source files
| Area | Files |
|---|---|
| App shell, state, store scope, update screen | `src/App.tsx`, `src/main.tsx`, `index.html` (inline boot rescue script) |
| PWA / service worker | `src/pwa.ts`, `pwa/sw-template.js`. `vite.config.ts` turns it into `dist/sw.js` with the version and the list of files to cache. Pages load network-first with a 3 second timeout; app files are cache-first. Also handles `push`, `notificationclick` and `pushsubscriptionchange`. |
| Products / stock logic | `src/services/productService.ts`, `src/services/stockService.ts` (`recordStockMovement`, `transferStock`) |
| Stores | `src/lib/stores.ts`, `src/components/stores/StorePicker.tsx` |
| Activity log | `src/lib/activity.ts` (action types, `logActivity`, `setActor`) |
| Excel | `src/services/excelService.ts` (`SHEET_COLUMNS`, sample sheet, import validation), `src/components/excel/ExcelImportModal.tsx` |
| Alerts (phone side) | `src/lib/alerts.ts`: on/off, test, daily summary setting, and `refreshAlerts`, which re-registers if an update dropped the registration (an iPhone problem). The setting is remembered in localStorage `bahubali_alerts_wanted`. |
| Overview | `src/components/dashboard/DashboardView.tsx`, `src/components/dashboard/OverviewCharts.tsx`. `storeFigures` (per-store units and value) is computed in `App.tsx`. |
| PDF report | `src/services/pdfReport.ts` (`exportStockReportPdf`). `handleExportPdf` in `App.tsx` also logs it to History. |
| History | `src/components/history/StockHistoryView.tsx`, `src/components/history/DailySummaries.tsx` (reads the `daily_summaries` table and keeps a copy in localStorage for offline) |
| Types | `src/types/inventory.ts` |

## 4. Supabase (live)

The SQL files in `supabase/` have all been applied to the live project, in this order. They are safe to read and edit, but the live database already has them:
1. `schema.sql`: base tables, readable views, sync RPCs, RLS and the `product-photos` storage bucket.
2. `stores.sql`: the stores table, per-store stock, replay per store, and the views `store_stock`, `movement_history` and `activity_history`.
3. `transfers.sql`: `transfer_id` on movements; transfers shown as "Transfer to/from X".
4. `alerts.sql`: the low stock alert tables and functions:
   - tables `stock_alerts` and `push_subscriptions` (private);
   - RPCs `subscribe_push` and `unsubscribe_push`;
   - service-role functions `claim_stock_alerts`, `record_alerts_sent` and `push_config`. `push_config` reads the VAPID keys from **Supabase Vault**: `vapid_public_key`, `vapid_private_key` and `vapid_subject`;
   - an insert trigger that calls the edge function through `pg_net`;
   - the alert check added to `recalc_product_stock`;
   - view `alert_history`.
5. `daily_summary.sql`: an older first version, now **replaced**. Its `daily_stock_summary()` was dropped. Only the `daily_summary` column on `push_subscriptions` and the `set_daily_summary` / `daily_summary_setting` RPCs are still in use.
6. `daily_summary_v2.sql`: the current daily summary:
   - table `daily_summaries` (day, data jsonb, sent_at, sent_to);
   - `build_daily_summary(date)`;
   - `run_daily_summary()`, which deletes and re-inserts today's row;
   - `claim_daily_summary()`, `record_summary_sent()`;
   - an insert trigger that calls the edge function;
   - **pg_cron** job `daily-stock-summary` at `30 14 * * *` (UTC), which is 8:00 PM IST.

**Edge function** `send-stock-alerts` (`supabase/functions/send-stock-alerts/index.ts`):
- Deployed with `verify_jwt = false`. It takes no instructions from callers:
  - it only delivers alerts and summaries already stored in the database, each exactly once;
  - a call with `{test:true, endpoint}` sends a test only to a phone that is already registered.
- When it sends a summary or alerts, it uses `npm:web-push`. Phones that answer 404 or 410 are removed.

**Security model:**
- Anonymous visitors (the app) can **read** the main tables and views.
- All writes go through SECURITY DEFINER RPCs.
- `push_subscriptions` cannot be read by the app.
- The Supabase security advisor warns about SECURITY DEFINER functions; this is expected.

**Readable views for the owner:** `store_stock`, `movement_history`, `activity_history`, `alert_history`.

## 5. Owner's standing instructions
- Always commit, push and merge to `main` without asking.
- Make database changes yourself; don't ask the owner to do them.
- Dark theme only. Keep the UI clean, organised and not crowded.
- Staff can do stock in, out and transfers, and can see cost price, without the admin code.
- Supabase, Vercel and GitHub tool calls are auto-approved (`.claude/settings.json`).
- Keep `HANDOFF.md` updated with every change (also stated in `CLAUDE.md`).

## 6. Known caveats and where things stand
- **Charts and reports read only the phone's local data**, so a phone shows figures as of its last sync.
- **iPhone notifications** only work when the app is added to the Home Screen and opened from there. An update could drop the push registration. The app now re-registers when it opens or comes back to the front (`refreshAlerts`, plus `pushsubscriptionchange`). This was not yet confirmed on a real iPhone across a full update.
- If the boot rescue screen appears, its "Reload app" button clears the app's cached files and service worker; data stays safe. The grey text at the bottom shows the actual error. Ask the owner for a screenshot.
- `push_subscriptions` may contain a few dead iPhone registrations. They are removed automatically the first time Apple returns 410.
- The Vercel Blob store `bahubali-name-codes` is no longer used and can be deleted if wanted.
- `MASTER PROMPT_ Bahubali Enterprises Live Stock Management System.md` is the original brief. Some of it is outdated: for example, the app is now local-first with Supabase sync.

## 7. Feature history (oldest → newest)
1. Fixed the Supabase setup, silent failures and the schema.
2. Made it fully offline (IndexedDB), added a sync button, and made it an installable PWA.
3. Redesigned the UI (dark only) with the `unslop` skill in `.claude/skills/unslop`.
4. Staff stock in/out without admin; name picker; shared name list.
5. Activity history with sections.
6. Moved to Supabase live sync while staying offline-first. Earlier file and QR sharing was removed.
7. Cost price visible to staff; admins can delete data sheet rows.
8. Multiple stores with per-store stock; Excel import plus a sample sheet.
9. Full-screen update screen on phones.
10. Transfers between stores.
11. Low stock push alerts; a send test alert button; a fix for the black screen after updates.
12. Daily 8 PM summary that only the scheduled job can trigger, saved and shown in History.
13. iPhone alerts re-register after app updates. Confirmed working on iPhone (test alert, low stock alert and summary).
14. PDF stock report. Works on iPhone.
15. Overview charts. Work on the owner's phone.
16. Handoff file (this one). `.claude/settings.json` auto-approves Supabase, Vercel and GitHub tool calls.

## 8. How to verify changes
- `npm run build` must pass.
- For UI, run `npm run build && npx vite preview` and check at 390×844 in a browser or Playwright. Set `localStorage.bahubali_current_staff = '"Raj"'` (the value is a JSON string) to skip the name picker in tests.
- For database changes, apply them as a Supabase migration, then check them with a `select` query. Notification tests:
  - `select net.http_post(...)` to the function URL;
  - then read `net._http_response` for the result.
