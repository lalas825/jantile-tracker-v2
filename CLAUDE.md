# CLAUDE.md

## Project Purpose

JANTILE is a construction job management app with offline-first synchronization. It tracks jobs, logistics (materials, delivery tickets, purchase orders), crew/workers, and production logs. Built with Expo 54 / React Native 0.81.5 (New Architecture, Hermes) and PowerSync for offline-first data sync.

## Architecture

- **Offline-first**: Mobile uses `db` (PowerSync/SQLite) for all reads/writes. Web uses `supabase` directly.
- **Platform check**: `const useSupabase = Platform.OS === 'web' || (db as any).isMock`
- **Sync**: PowerSync v1.29.0 syncs local SQLite with Supabase PostgreSQL via `SupabaseConnector`.
- **Service pattern**: `export const ServiceName = { ... }` object literal with methods. SupabaseService.ts is a pure delegate index (~99 lines) that re-exports from feature services.

## Key Rules

1. **Data integrity first**: Never lose user data. Use transactions (`db.writeTransaction()`) for multi-step operations. Use `INSERT OR REPLACE` / `upsert` to handle re-syncs gracefully.
2. **Use SupabaseConnector for all DB operations**: All database access goes through PowerSync (`db`) on mobile and `supabase` on web. Never bypass the sync layer.
3. **Keep component files under 500 lines**: Extract logic into hooks (`src/features/*/hooks/`) and services (`src/features/*/`). Components should be visual shells.

## Project Structure

```
src/
  features/
    jobs/         JobService.ts, index.ts
    logistics/    LogisticsService.ts, index.ts, hooks/useMaterialForm.ts
    crew/         CrewService.ts, index.ts
  services/
    SupabaseService.ts    Pure delegate index (re-exports from features)
    OfflinePhotoService.ts
  config/
    supabase.ts
  powersync/
    db.ts
  components/               Visual shells only
  app/                      Expo Router pages
```

## Tech Stack

- Expo 54, React Native 0.81.5, TypeScript
- PowerSync v1.29.0 (offline-first sync)
- Supabase (PostgreSQL + Storage + Auth)
- NativeWind (Tailwind CSS for RN)
- Android package: `com.jantile.trackerv2`
