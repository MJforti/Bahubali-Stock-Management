# Bahubali Stock Management

A stock management app for **Bahubali Enterprises**, a hardware business with several stores and godowns. Staff use it on their phones every day to record stock coming in, going out and moving between stores. It works fully offline and syncs when a connection is back.

**Live app:** https://bahubali-stock-management.vercel.app

## Features

- **Stock register:** products with brand, SKU, category, unit, rack location, photos and minimum stock levels, tracked per store.
- **Stock in, out and transfers** between stores and godowns, each logged with who did it and when.
- **Overview dashboard:** units on shelves, low and out-of-stock counts, today's movements, and charts for the last 14 days, stock health, stock by category, most-issued items and stock by store. Every stat card opens the matching filtered list.
- **History:** a full activity log for stock, products, people and access, stores and backups, plus daily summaries.
- **Data sheet:** a spreadsheet-style view with Excel import (with a sample sheet), Excel export and a PDF stock report.
- **Notifications:** web push alerts when an item runs low or out, and a daily stock summary at 8 PM IST.
- **Staff and admin:** anyone can record movements; an admin code unlocks product editing, store management and backup restore.
- **Installable PWA:** works offline, shows an update screen when a new version is ready, and has a rescue screen if the app fails to start.

## Tech stack

- React 18, TypeScript, Vite, Tailwind CSS, lucide-react
- IndexedDB on the device as the app's working copy, synced with **Supabase** (Postgres, RPCs, storage, edge functions, pg_cron)
- `xlsx` for Excel, `jspdf` + `jspdf-autotable` for PDF reports, `browser-image-compression` for photos
- Web push via a Supabase edge function (`supabase/functions/send-stock-alerts`)
- Hosted on **Vercel**

## Getting started

```bash
npm install
npm run dev
```

Build for production (type check plus build into `dist/`, including the service worker):

```bash
npm run build
```

## Project structure

```
src/
  components/   UI by area: dashboard, products, stock, stores, history, datasheet, excel, settings
  lib/          local database, sync, stores, alerts, activity log
  services/     products, stock, Excel, PDF report, images, realtime sync
pwa/            service worker template
supabase/       SQL for tables, views, RPCs, alerts and daily summaries; the push edge function
```

## Database

The SQL files in `supabase/` are applied to the live Supabase project in this order: `schema.sql`, `stores.sql`, `transfers.sql`, `alerts.sql`, `daily_summary.sql`, `daily_summary_v2.sql`. The app reads tables and views directly and makes every write through security-definer RPCs, protected by row-level security.

**The live database holds real stock data.** Never wipe, reset or reseed it.

## Contributing

Read [`HANDOFF.md`](HANDOFF.md) before changing anything. It covers how the app works, the live services, known caveats and the owner's rules. Keep it up to date with every change.

## License

[MIT](LICENSE)
