# CLAUDE.md

## Project Purpose

JANTILE is a construction job management platform with offline-first synchronization. It tracks jobs, floors/units/areas, logistics (materials, delivery tickets, purchase orders), crew/workers, production logs, punchlist, deficiencies, safety, and AI-powered assistance. Built with Expo 54 / React Native 0.81.5 (New Architecture, Hermes) and PowerSync for offline-first data sync. Runs on Android (mobile-first) and Web.

## Architecture

- **Offline-first**: Mobile uses `db` (PowerSync/SQLite) for all reads/writes. Web uses `supabase` directly.
- **Platform check**: `const useSupabase = Platform.OS === 'web' || (db as any).isMock`
- **Platform files**: Native `.tsx` / `.ts`, web `.web.tsx` / `.web.ts` (db, AppSchema, hooks, widgets).
- **Sync**: PowerSync v1.29.0 syncs local SQLite with Supabase PostgreSQL via `SupabaseConnector`.
- **Service pattern**: `export const ServiceName = { ... }` object literal with methods.
- **Facade**: `SupabaseService.ts` is a pure delegate index (~100 lines) re-exporting from feature services.
- **Component rule**: Files < 500 lines. Logic in hooks (`src/features/*/hooks/`), visuals in components.

## Key Rules

1. **Data integrity first**: Never lose user data. Use `db.writeTransaction()` for multi-step ops. Use `INSERT OR REPLACE` / `upsert` with `onConflict` to handle re-syncs.
2. **Use SupabaseConnector for all DB ops**: All database access goes through PowerSync (`db`) on mobile and `supabase` on web. Never bypass the sync layer.
3. **Keep components under 500 lines**: Extract logic into hooks and services.
4. **PowerSync sync safety**: `SupabaseConnector.uploadData()` must skip orphaned ops and complete transactions on non-recoverable Postgres errors (23502, 23503, 23505, PGRST204, 42703). Never let unhandled errors block the CRUD queue.
5. **Photo uploads**: Always upload to Supabase Storage (bucket: `area-photos`) and store public URLs, never local file URIs.

## Tech Stack

- Expo 54, React Native 0.81.5, TypeScript, React 19.1
- PowerSync v1.29.0 (offline-first sync)
- Supabase (PostgreSQL + Storage + Auth + Edge Functions)
- NativeWind / TailwindCSS for styling
- Gemini 2.5 (Flash for tools, Flash-Lite for vision) — AI chat via Telegram & Web
- Android package: `com.jantile.trackerv2`

## Project Structure

```
src/
  app/                           Expo Router pages (file-based routing)
    (tabs)/                      Tab navigator
      _layout.tsx                Main tab layout (5 visible + hidden tabs, hamburger menu)
      index.tsx                  Dashboard (donut charts, health metrics, velocity)
      field.tsx                  Field ops (Action Center, Site Pulse, Logistics Radar)
      warehouse.tsx              Warehouse management
      shop.tsx                   Shop/Fabrication
      menu.tsx                   Main menu with navigation & sign-out
      manpower.tsx               Crew management (roster, roles, assignments)
      polishers.tsx              Production logs (multi-color status, PDF export)
      reports.tsx                Reports (placeholder)
      logistics.tsx              Legacy logistics (deprecated)
      jobs/
        _layout.tsx              Stack navigator for jobs
        index.tsx                Jobs list with search & create/edit
        [id].tsx                 Job detail (floors, units, areas, sub-tabs)
        [id]/[unitId]/index.tsx  Unit-level detail page
    admin/
      _layout.tsx                Admin section layout
      index.tsx                  Admin dashboard (user approval, job assignment)
    job-issues/[id].tsx          Issue detail view
    logistics/new-request.tsx    New logistics request
    login.tsx                    Email/password auth
    pending-approval.tsx         Pending access screen
    test-crud.tsx                Debug/test CRUD screen

  features/
    admin/                       Admin feature module
      components/
        AdminGuard.tsx           Admin-only route guard
        AdminDashboard.tsx       User approval & job assignment console
        RoleGuard.tsx            RoleGuard + RoleVisible components
        JobAssignmentManager.tsx Worker-to-job assignment
      index.ts                   Barrel export
    jobs/
      JobService.ts              Jobs, floors, units, areas, checklist, photos, issues CRUD
      index.ts
    logistics/
      LogisticsService.ts        Materials, delivery tickets, POs, inventory, discrepancies
      hooks/useMaterialForm.ts   Material form state hook
      index.ts
    crew/
      CrewService.ts             Workers, production logs, utilities
      index.ts

  services/
    SupabaseService.ts           Facade delegating to feature services
    OfflinePhotoService.ts       Offline photo queue for sync
    MockJobStore.ts              Mock data for testing

  components/
    PowerSyncWrapper.tsx         PowerSync DB context provider (init → render → connect background)
    PowerSyncWrapper.web.tsx     Web mock
    FloatingChat.tsx             Floating web chat widget (Gemini-powered)
    ProductionRow.tsx            Editable production log row with color picker
    StructureModule.tsx          Floor/unit/area tree editor with drag

    dashboard/
      GlobalHealthWidget.tsx/.web.tsx    Job health metrics
      JobVelocityWidget.tsx/.web.tsx     Job completion velocity chart
      chartConfig.ts                     Chart configuration

    jobs/
      AreaCard.tsx               Area card with progress
      AreaDetailsDrawer.tsx      Area details & photos drawer
      JobSiteTab.tsx             Job site logistics
      LogisticsTab.tsx           Project materials tab
      ProductionTab.tsx          Production logs & time tracking
      UnitLevelAccordion.tsx     Expandable unit with areas
      tabs/
        PunchlistTab.tsx         Punchlist items (3-col cards, detail modal, PDF report)
        DeficientTab.tsx         Deficient items tracking
        IssuesTab.tsx            Job issues & defects
        SafetyTab.tsx            Safety incidents & reports
        DocumentsTab.tsx         Project documents
        PhotosTab.tsx            Area photos gallery
        LogTimeTab.tsx           Worker time logging
        JHAView.tsx              Job Hazard Analysis
        PreTaskPlanView.tsx      Pre-task planning
        SafetyToolboxView.tsx    Safety toolbox talks
        ScopeOfWorkView.tsx      Scope of work
        SignOffsView.tsx         Inspection sign-offs
        TicketWorkView.tsx       Work tickets

    logistics/
      UnifiedLogisticsTable.tsx  Universal materials table
      AreaBudgetView.tsx         Area material budget
      ProjectTotalView.tsx       Project-wide budget
      DeliveriesView.tsx         Delivery tracking
      DeliveryTicketModal.tsx    Create/edit delivery tickets
      LiveDeliveryTracker.tsx    Real-time delivery status
      PurchaseOrderDrawer.tsx    PO creation & management
      PurchaseHistoryModal.tsx   Purchase history
      KanbanCard.tsx             Kanban-style material card
      AddBudgetItemModal.tsx     Add material to budget
      EditAreaModal.tsx          Edit area assignment
      TileCalculator.tsx         Tile/area calculator

    warehouse/
      WarehouseTab.tsx           Warehouse view switcher
      WarehouseSchedule.tsx      Operations schedule
      OutboundList.tsx           Outbound deliveries
      OutboundCalendar.tsx       Outbound schedule calendar
      ReceivingList.tsx          Receiving POs
      ReceivingCalendar.tsx      Receiving schedule calendar
      InventoryView.tsx          Inventory levels
      DeliveredHistory.tsx       Completed deliveries
      DiscrepancyHistory.tsx     Discrepancies & claims
      DirectOrdersView.tsx       Direct supplier orders
      AllocateStockModal.tsx     Stock allocation
      CalendarMonthView.tsx      Month calendar
      CalendarWeekView.tsx       Week calendar
      FleetManagementModal.tsx   Fleet/vehicle management

    modals/
      ReportPunchlistItemModal.tsx   Create punchlist item (photo upload)
      ReportDeficiencyModal.tsx      Report deficiency (photo upload)
      ReportJobIssueModal.tsx        Create job issue (photo upload)
      ReportSafetyIssueModal.tsx     Report safety incident (photo upload)
      ReceiveMaterialModal.tsx       Material receipt confirmation
      CloningModal.tsx               Clone floors/units structure
      StructureModal.tsx             Create/edit job structure

    navigation/
      DesktopNavbar.tsx          Desktop web navigation bar

    pickers/
      WebDatePicker.tsx          HTML date input wrapper
      WebTimePicker.tsx          HTML time input wrapper

  hooks/
    useJobsData.ts               Jobs list data with mock fallback
    useLogisticsData.ts/.web.ts  Logistics data (platform-specific)
    useDeliveryTickets.ts        Delivery ticket management
    usePolishersData.ts          Polishers production logs
    useSafeStatus.ts             Safety status checking
    use-color-scheme.ts/.web.ts  Color scheme detection
    use-theme-color.ts           Theme color hook

  config/
    supabase.ts                  Supabase client init (SecureStore adapter)

  powersync/
    db.ts / db.web.ts            PowerSync database instance / web mock
    AppSchema.ts / .web.ts       PowerSync table schema
    SupabaseConnector.ts         Sync connector with error recovery

  context/
    AuthContext.tsx               Auth context with role-based permissions

  constants/
    theme.ts                     Colors, fonts, theme
    CrewData.ts                  Crew roles & default data
    JobTemplates.ts              Job templates & checklist presets

  utils/
    DeliveryTicketPDF.ts         Delivery ticket PDF generation
    PolishersReportPDF.ts        Polishers production report PDF

supabase/
  functions/
    telegram-webhook/index.ts    Telegram bot webhook (Gemini AI chat)
    web-chat/index.ts            Web chat endpoint (Gemini AI + session history)
    _shared/
      ai/gemini.ts               Gemini API integration
      ai/tools.ts                Tool declarations (get_jobs, get_issues, etc.)
      ai/tool-handlers.ts        Tool execution handlers
      ai/checklist-presets.ts    Checklist templates
      auth/auth.ts               Auth utilities (JWT, role check, telegram_id lookup)
      types.ts                   Shared TypeScript types
  migrations/                    SQL migrations
```

## Roles & Access Control

| Role | Main Menu | Job Sub-tabs |
|------|-----------|--------------|
| admin | All modules + Admin panel | All tabs |
| supervisor | Dashboard(assigned), Jobs, Warehouse, Field, Shop, Manpower, Polishers | All tabs |
| pm | Dashboard(assigned), Jobs(assigned), Warehouse, Shop | Production, Logistics, Issues, Safety, Docs, Punchlist, Deficient, Payroll, Analytics |
| foreman | Dashboard(assigned), Jobs(assigned) | Production, Job Site, Issues, Safety, Docs, Punchlist, Deficient |
| warehouse | Dashboard(global, view-only), Warehouse | N/A |
| shop | Dashboard(global, view-only), Shop | N/A |

- **Pending Access**: New users get `status: 'pending'`, redirected to `/pending-approval`. Admin approves from `/admin`.
- Role visibility enforced by `RoleGuard` / `RoleVisible` components and `visibleTabs` filter in `[id].tsx`.

## Database Tables (PowerSync Schema)

jobs, floors, units, areas, checklist_items, area_photos, job_issues, issue_comments, profiles, system_notifications, job_assignments, workers, production_logs, project_materials, delivery_tickets, purchase_orders, warehouse_inventory, discrepancy_records, web_chat_history, work_tickets, document_signatures

## AI Integration

- **Telegram Bot**: Edge Function webhook at `supabase/functions/telegram-webhook/`. Auth via `telegram_id` in profiles. Gemini 2.5 Flash for text+tools.
- **Web Chat**: Floating widget (`FloatingChat.tsx`) → Edge Function `web-chat/`. Session history in `web_chat_history` table.
- **Tools**: get_jobs, get_job_details, get_issues, create_issue, get_workers, get_production_logs, etc.

## Documents Module (Ticket Work + Digital Signatures)

The Documents module provides a complete digital workflow for T&M (Time & Material) work tickets with GC signature capture.

### Architecture

```
Flow: Create Ticket → Send for Signature → GC Signs via Public URL → PDF with Signature

src/features/documents/
  types.ts              WorkTicket, DocumentSignature, LaborEntry, MaterialEntry types
  DocumentService.ts    CRUD + signature lifecycle (source of truth for all document logic)
  index.ts              Barrel export

src/components/documents/
  TicketCard.tsx         Ticket card with status badge + contextual actions
  CreateTicketModal.tsx  Create/edit T&M ticket (labor, materials, trade, description)
  SendToGCModal.tsx      Send for signature (email + copy link, saves GC info per job)
  SignatureCanvas.tsx    Native signature capture (WebView-based)
  SignatureCanvas.web.tsx Web signature capture (HTML5 canvas + pointer events)

src/app/sign/
  _layout.tsx           Public layout (no auth, no tabs)
  [token].tsx           Public signing page (token-based, no login required)

src/utils/
  DocumentPDF.ts        PDF generation ("ORDER FOR ADDITIONAL WORK" format + signature overlay)
```

### Key Flows

1. **Create**: `DocumentService.createWorkTicket()` → generates `signature_token` via `crypto.randomUUID()` → status `draft`
2. **Send**: `DocumentService.createSignatureRequest()` → inserts `document_signatures` row → updates ticket to `pending_signature` → returns sign URL
3. **Sign**: GC opens `/sign/{token}` → `DocumentService.getDocumentByToken()` (public, supabase only) → `SignatureCanvas` captures base64 → `DocumentService.submitSignature()` uploads PNG to `signatures` bucket → updates status to `signed`
4. **PDF**: `DocumentPDF.printTicket()` → generates HTML with Jantile letterhead, labor/materials tables, signature overlay → `expo-print` (native) / `window.open` (web)
5. **Audit**: `AuditService.log()` fire-and-forget for `PDF_GENERATED` and `SIGNATURE_SUBMITTED` events → `audit_logs` table

### Critical Rules (Blindaje)

- **`createSignatureRequest` MUST always use Supabase directly** — never PowerSync. The public signing page reads from Supabase, so the record must exist server-side immediately. (Bug found: PowerSync insert → sync delay → "Unable to load document")
- **PowerSync JSON fields must be parsed** — PowerSync stores JSONB as TEXT in SQLite. Any `useQuery()` result with JSON columns (e.g., `delivery_tickets.items`, `work_tickets.labor/materials`) must be parsed with `JSON.parse()` before use. (Bug found: `ticket.items.reduce()` on a string → "undefined is not a function")
- **CreateTicketModal uses bottom sheet pattern** on mobile — `justifyContent: 'flex-end'` + `animationType: 'slide'` + `KeyboardAvoidingView`. Never use centered modals with `ScrollView flex:1` (the parent has no fixed height → content collapses).
- **Form state must reset on modal open** — `useState` initial values only run on mount. Use `useEffect([visible, editTicket])` to reset form fields when the modal opens.
- **After sending for signature, auto-switch to Pending tab** — otherwise the user thinks the ticket "disappeared".

### Database

- `work_tickets`: T&M tickets with status lifecycle (draft → pending_signature → signed/declined)
- `document_signatures`: Shared signature records (reusable for PTP, JHA, etc. later)
- `audit_logs`: Event tracking (event_type, payload jsonb, user_id). RLS: insert for authenticated, select for admin/pm only
- `signatures` bucket: Public Supabase Storage for signature PNGs
- RLS: work_tickets gated by `job_assignments`, document_signatures open for token-based access

### Extensibility

The signature infrastructure (`document_signatures` table, `SignatureCanvas`, `SendToGCModal`, `/sign/[token]` page) is **shared** and designed to support future document types (PTP, JHA, Safety Toolbox, Sign-Offs). To add a new doc type:
1. Add the type to `DocumentType` union in `types.ts`
2. Add a new table + CRUD methods in `DocumentService.ts`
3. Extend `getDocumentByToken()` switch to handle the new type
4. Add PDF generation method in `DocumentPDF.ts`

## Pages & Features: Status

### Fully Built
- **Login / Auth flow** — Email/password, role-based redirect, pending approval
- **Dashboard** — Donut charts (job completion), health metrics, velocity widget
- **Jobs list** — Search, create/edit modal, job cards
- **Job detail** — Floor/unit/area tree, expandable accordions, area progress
- **Production tab** — Worker time tracking, production logs
- **Logistics tab** — Project materials table, area budget
- **Punchlist tab** — 3-col clickable cards, detail modal, photo upload to Storage, PDF report with photos
- **Issues tab** — Job issues with photo upload, status tracking
- **Safety tab** — Safety incidents with photo upload
- **Deficient tab** — Deficiency tracking with photo upload
- **Photos tab** — Area photo gallery
- **Warehouse** — Receiving, outbound, inventory, calendar views, fleet management, stock allocation
- **Manpower** — Worker roster, roles, status, job assignments
- **Polishers** — Multi-color production logs, week/day view, PDF export
- **Admin panel** — User approval, role management, job assignment
- **Telegram bot** — AI chat with tool calling (jobs, issues, crew queries)
- **Web chat** — Floating Gemini widget with session history
- **Offline loading** — Immediate UI with local data, background sync
- **PowerSync sync** — Error recovery, orphaned op handling, constraint violation skip
- **RLS** — Row-level security on 10 tables with job_assignments multi-tenancy

### Needs Improvement / Optimization
- **Reports page** (`reports.tsx`) — Placeholder, needs real analytics & export functionality
- **Field page** (`field.tsx`) — Action Center, Site Pulse, Logistics Radar built but may need refinement with real data
- **Documents tab** (`DocumentsTab.tsx`) — Basic document management, could add file upload/preview
- **Log Time tab** (`LogTimeTab.tsx`) — Basic time logging, could add approval workflow
- **JHA View** (`JHAView.tsx`) — Job Hazard Analysis, needs form templates
- **Pre-Task Plan** (`PreTaskPlanView.tsx`) — Pre-task planning, needs structured templates
- **Safety Toolbox** (`SafetyToolboxView.tsx`) — Toolbox talks, needs content library
- **Scope of Work** (`ScopeOfWorkView.tsx`) — SOW details, could add versioning
- **Sign-Offs** (`SignOffsView.tsx`) — Inspection sign-offs, needs digital signature flow
- **Ticket Work** (`TicketWorkView.tsx`) — Work tickets, needs workflow integration
- **Delivery Tracker** (`LiveDeliveryTracker.tsx`) — Real-time tracking, could add GPS integration
- **TileCalculator** (`TileCalculator.tsx`) — Calculator tool, could add more material types
- **Logistics legacy page** (`logistics.tsx`) — Deprecated, should be removed
- **SupabaseService.bak.ts** — Backup file, should be deleted
- **test-crud.tsx** — Debug screen, should be removed in production builds
- **Web platform** — Functional but secondary; some hooks/widgets have `.web.ts` stubs

### Potential Enhancements
- Push notifications for issue updates / delivery arrivals
- Digital signature capture for sign-offs
- Barcode/QR scanning for material tracking
- GPS location tracking for deliveries
- Dashboard export to PDF/Excel
- Worker scheduling and shift management
- Material waste tracking
- Photo annotation/markup tools

## Build & Deploy (Android)

- **Standalone APK**: Set `debuggableVariants = []` in `android/app/build.gradle` to bundle JS.
- **ADB reverse**: `adb reverse tcp:8081 tcp:8081` for Metro with USB device.
- **local.properties**: `expo prebuild --clean` deletes it. Recreate: `sdk.dir=C:\\Users\\lalas\\AppData\\Local\\Android\\Sdk`.
- **Edge Functions**: `npx supabase functions deploy telegram-webhook --no-verify-jwt` (Telegram can't send JWT).
- **Data migrations**: Create temp SQL in `supabase/migrations/`, push with `npx supabase db push --linked`, delete temp file.

## Historico de Arquitectura

| Fecha | Cambio | Estado |
|-------|--------|--------|
| 2026-03-13 | JFK T1 Level 2: 6 units, 31 areas. Level 3: 5 units, 18 areas. Data entry via SQL migrations. | Produccion |
| 2026-03-12 | Code audit (CRITICAL/HIGH/MEDIUM fixes). Punchlist overhaul: photo upload to Storage, 3-col cards, detail modal, PDF report with photos. Offline loading fix (non-blocking connect). Runtime warnings fix (SafeAreaView, LayoutAnimation, jobs route). | Produccion |
| 2026-03-07 | Pending Access System, Role access overhaul (7 roles), Telegram Gateway (Edge Function webhook, 4 commands). | Produccion |
| 2026-03-06 | RLS Estricto (Multi-tenancy). `job_assignments`, helper functions, RLS policies on 10 tables. | Produccion |
