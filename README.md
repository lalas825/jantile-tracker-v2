# JANTILE Tracker

Construction job management platform with offline-first synchronization. Built for field teams managing large-scale projects with real-time data sync when connectivity is available.

## Features

### Job Management
- Hierarchical structure: Jobs > Floors > Units > Areas
- Area progress tracking with visual indicators
- Checklist items per area with completion status
- Job cloning for repeating structures

### Production & Crew
- Worker roster with roles and job assignments
- Production log tracking (polishers/marble workers)
- Multi-color status system for production entries
- Time logging per worker per area
- PDF export for production reports

### Logistics & Warehouse
- Project material budgeting (per-area and project-wide)
- Purchase order creation and tracking
- Delivery ticket management with PDF generation
- Warehouse inventory levels with stock allocation
- Receiving and outbound calendar views
- Fleet/vehicle management
- Live delivery status tracking

### Quality & Safety
- Punchlist items with photo documentation
- Deficiency tracking and resolution
- Job issue reporting with photo upload
- Safety incident reporting
- Job Hazard Analysis (JHA)
- Pre-task planning
- Safety toolbox talks
- Inspection sign-offs

### AI-Powered Assistance
- **Telegram Bot**: Query jobs, issues, crew data via natural language
- **Web Chat Widget**: Floating chat with session history
- Powered by Gemini 2.5 with tool calling for real-time data access

### Role-Based Access Control
7 roles with granular permissions:
- **Admin**: Full access + user management
- **Supervisor**: All field operations
- **PM**: Production, logistics, issues, safety, docs
- **Foreman**: Production and field operations
- **Worker**: Assigned jobs only
- **Warehouse**: Warehouse operations only
- **Shop**: Shop/fabrication only

### Offline-First Architecture
- Immediate UI load with local SQLite data
- Background sync via PowerSync when online
- Conflict resolution with error recovery
- Photo queue for offline uploads

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo 54, React Native 0.81.5, React 19.1 |
| Language | TypeScript |
| Routing | Expo Router (file-based) |
| Styling | NativeWind (TailwindCSS for RN) |
| Database | Supabase (PostgreSQL) |
| Offline Sync | PowerSync v1.29.0 (SQLite) |
| Auth | Supabase Auth (email/password) |
| Storage | Supabase Storage (photos) |
| AI | Gemini 2.5 Flash (Supabase Edge Functions) |
| Charts | react-native-chart-kit |
| Icons | Lucide React Native |
| PDF | expo-print (HTML-based) |

## Project Structure

```
src/
  app/              Expo Router pages
    (tabs)/          Tab navigation (Dashboard, Jobs, Field, Warehouse, Shop, etc.)
    admin/           Admin panel
  features/
    admin/           Role guards, user approval, job assignments
    jobs/            JobService - CRUD for jobs, floors, units, areas, checklists, photos
    logistics/       LogisticsService - materials, deliveries, POs, inventory
    crew/            CrewService - workers, production logs
  services/
    SupabaseService.ts    Facade re-exporting from feature services
    OfflinePhotoService.ts
  components/
    dashboard/       Health widgets, velocity charts
    jobs/            Area cards, unit accordions, sub-tab views
    logistics/       Material tables, delivery modals, PO drawers
    warehouse/       Inventory, calendars, receiving/outbound lists
    modals/          Issue/safety/punchlist/deficiency report modals
  hooks/             Data fetching hooks (platform-specific)
  powersync/         Database schema, sync connector, error recovery
  config/            Supabase client configuration
  context/           AuthContext (role-based permissions)
  constants/         Theme, crew data, job templates
  utils/             PDF generation utilities

supabase/
  functions/
    telegram-webhook/    Telegram bot AI webhook
    web-chat/            Web chat AI endpoint
    _shared/             AI tools, auth, types
  migrations/            SQL migrations
```

## Getting Started

### Prerequisites
- Node.js 18+
- Android SDK (for mobile builds)
- Supabase project with PowerSync enabled

### Installation

```bash
git clone <repo-url>
cd JantileTracker2
npm install
```

### Development

```bash
# Start Metro bundler
npx expo start

# Run on Android device (USB)
adb reverse tcp:8081 tcp:8081
npx expo run:android

# Run on web
npx expo start --web
```

### Build Standalone APK

1. Set `debuggableVariants = []` in `android/app/build.gradle`
2. Run: `cd android && ./gradlew assembleDebug`
3. APK output: `android/app/build/outputs/apk/debug/app-debug.apk`
4. Install: `adb install -r <apk-path>`

### Deploy Edge Functions

```bash
# Telegram webhook (no JWT required)
npx supabase functions deploy telegram-webhook --no-verify-jwt

# Web chat
npx supabase functions deploy web-chat
```

### Database Migrations

```bash
# Push migrations to remote
npx supabase db push --linked

# Pull remote schema
npx supabase db pull
```

## Environment

The app requires a Supabase project with:
- PostgreSQL database with PowerSync sync rules
- Storage bucket: `area-photos` (public, for issue/area photos)
- Auth configured for email/password
- Edge Functions runtime for AI chat
- Row-Level Security policies on all tables
- `job_assignments` table for multi-tenancy access control

## License

Proprietary. All rights reserved.
