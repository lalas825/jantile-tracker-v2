# PROJECT MAP - JantileTracker2

**Fecha de Auditoria**: 5 de Marzo, 2026
**Estado**: Aplicacion en Produccion con Arquitectura Offline-First

---

## 1. TECNOLOGIAS Y VERSIONES

### Framework Principal

| Componente | Version | Notas |
|------------|---------|-------|
| **Expo** | 54.0.32 | Framework cross-platform (NO es Next.js) |
| **React** | 19.1.0 | UI con hooks |
| **React Native** | 0.81.5 | Runtime movil, New Architecture habilitada |
| **Expo Router** | 6.0.22 | Enrutamiento basado en archivos (App Router) |
| **TypeScript** | 5.9.2 | Tipado estatico |

### Estilos & UI

| Componente | Version | Proposito |
|------------|---------|-----------|
| **NativeWind** | 4.2.1 | Tailwind CSS para React Native |
| **TailwindCSS** | 3.4.19 | Utilidades CSS |
| **Lucide React Native** | 0.562.0 | Iconografia |
| **@expo/vector-icons** | 14.x | Ionicons, MaterialIcons |
| **@react-navigation** | 7.1.8-7.4.0 | Navegacion nativa (tabs, stack) |

### Manejo de Estado & Datos

| Componente | Version | Proposito |
|------------|---------|-----------|
| **PowerSync React Native** | 1.29.0 | Sync offline-first con SQLite local |
| **PowerSync React** | 1.8.2 | Hooks reactivos (shimmed en Android) |
| **@journeyapps/react-native-quick-sqlite** | 2.5.0 | Motor SQLite nativo |
| **@supabase/supabase-js** | 2.93.1 | Backend: Auth + PostgreSQL + Storage |
| **React Context API** | Built-in | Estado global (AuthContext) |

### Capacidades Nativas

| Modulo | Version | Funcionalidad |
|--------|---------|---------------|
| expo-secure-store | 15.0.8 | Almacenamiento seguro de tokens |
| expo-image-picker | 17.0.10 | Camara y galeria |
| expo-file-system | 19.0.21 | Operaciones de archivo (modo legacy) |
| expo-media-library | 18.2.1 | Acceso a galeria |
| expo-print | 15.0.8 | Generacion de PDFs |
| expo-haptics | 15.0.8 | Retroalimentacion haptica |
| expo-crypto | 1.0.5 | UUIDs |
| @react-native-community/datetimepicker | 8.4.4 | Selectores de fecha/hora |

### Librerias Adicionales

| Componente | Version | Proposito |
|------------|---------|-----------|
| react-native-chart-kit | 6.12.0 | Graficas del dashboard |
| date-fns | 3.6.0 | Utilidades de fecha |
| @dnd-kit/core | 6.3.1 | Drag & drop (solo web) |
| @dnd-kit/sortable | 10.0.0 | Listas ordenables (solo web) |
| buffer | 6.0.3 | Polyfill para subida de fotos |
| clsx | 2.1.1 | Utilidad de clases CSS |

**Total**: 65 dependencias de produccion + 8 de desarrollo

---

## 2. ARQUITECTURA DE DATOS

### Flujo de Conexion

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   App Movil      │◄───►│  PowerSync Cloud │◄───►│   Supabase      │
│ (SQLite local)   │sync │  (WebSocket)     │     │  (PostgreSQL)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                                                │
         │  Offline: lee/escribe SQLite local              │
         │  Online: sync bidireccional via PowerSync       │
         └────────────────────────────────────────────────┘

Web App: Consulta Supabase directamente (sin PowerSync)
```

### Configuracion de Supabase (`src/config/supabase.ts`)

- **URL**: `https://qxeyoyeqvmkufsfrdxug.supabase.co`
- **Almacenamiento de sesion**: SecureStore (movil) / localStorage (web)
- **Auto-refresh tokens**: Habilitado
- **Persistencia de sesion**: Habilitada

### PowerSync (`src/powersync/`)

- **Endpoint**: `https://6972a62c5f8ee4c52500ae6f.powersync.journeyapps.com`
- **DB local**: `jantile_tracker.db`
- **Conector** (`SupabaseConnector.ts`): Transforma operaciones CRUD de PowerSync a mutaciones Supabase (PUT/PATCH/DELETE)
- **Shim Android** (`powersync-react-shim.js`): Reemplaza `@powersync/react` via Metro resolver por incompatibilidad con New Architecture. Usa polling cada 2s en lugar de queries reactivos.

### Sync Rules (PowerSync Dashboard)

```yaml
bucket_definitions:
  global:  # Datos visibles para todos
    - SELECT * FROM workers, jobs, inventory, floors, units, areas,
      checklist_items, tickets, production_logs, area_photos, job_issues,
      issue_comments, project_materials, delivery_tickets, purchase_orders,
      po_items, material_claims, system_notifications

  by_user:  # Datos por usuario
    parameters: SELECT request.user_id() as user_id
    data:
      - SELECT * FROM profiles WHERE id = bucket.user_id
```

### Autenticacion (`src/context/AuthContext.tsx`)

**Flujo**:
1. Login con email/password via Supabase Auth
2. Sesion almacenada en SecureStore (movil) / localStorage (web)
3. Perfil cargado desde DB local (offline-first), fallback a Supabase
4. Permisos RBAC aplicados via AuthContext

**Roles y Permisos**:

| Rol | Permisos |
|-----|----------|
| `admin` | Acceso total (`*`) |
| `pm` | Acceso total (`*`) |
| `foreman` | `view_jobs`, `edit_daily_logs`, `view_my_tickets` |
| `warehouse` | `view_logistics`, `edit_inventory` |

---

## 3. ESTRUCTURA DE CARPETAS

```
src/
├── app/                          # Expo Router (rutas basadas en archivos)
│   ├── _layout.tsx              # Layout raiz: AuthGuard + PowerSyncWrapper
│   ├── login.tsx                # Pantalla de autenticacion
│   ├── (tabs)/                  # Navegacion principal (tabs abajo movil / sidebar desktop)
│   │   ├── _layout.tsx          # Layout de tabs responsive
│   │   ├── index.tsx            # Dashboard principal
│   │   ├── field.tsx            # Operaciones de campo
│   │   ├── jobs/                # Modulo de proyectos
│   │   │   ├── index.tsx        # Lista de trabajos
│   │   │   ├── [id].tsx         # Detalle de trabajo (4 tabs)
│   │   │   └── [id]/[unitId]/   # Detalle de unidad
│   │   ├── warehouse.tsx        # Recepcion e inventario
│   │   ├── logistics.tsx        # Logistica (tab oculto)
│   │   ├── manpower.tsx         # Gestion de personal
│   │   ├── polishers.tsx        # Maquinaria/pulidoras
│   │   ├── reports.tsx          # Reportes y analytics
│   │   ├── shop.tsx             # Equipos
│   │   ├── team-access.tsx      # Gestion de permisos
│   │   └── menu.tsx             # Menu drawer
│   ├── job-issues/[id].tsx      # Detalle de incidencia
│   └── logistics/new-request.tsx # Formulario de entrega
│
├── components/                   # 73 componentes reutilizables
│   ├── dashboard/               # Widgets de analytics
│   ├── jobs/                    # Componentes de detalle de trabajo
│   │   ├── AreaDetailsDrawer    # Fotos, checklists, issues de area
│   │   ├── LogisticsTab         # Presupuesto de materiales
│   │   ├── ProductionTab        # Seguimiento de progreso
│   │   └── tabs/                # Sub-tabs (Safety, Punchlist, Deficient)
│   ├── warehouse/               # Recepcion, despacho, inventario
│   ├── logistics/               # Tickets de entrega, presupuesto
│   ├── modals/                  # 7 modales especializados
│   ├── PowerSyncWrapper.tsx     # Inicializacion de DB (nativo)
│   └── PowerSyncWrapper.web.tsx # Fallback web (no-op)
│
├── services/                    # Capa de logica de negocio
│   ├── SupabaseService.ts       # 3,323 lineas - CRUD para todos los dominios
│   ├── OfflinePhotoService.ts   # Cola de fotos offline con sync
│   └── MockJobStore.ts          # Datos fixture
│
├── powersync/                   # Capa de sync offline
│   ├── db.ts                    # Instancia PowerSync (nativo)
│   ├── AppSchema.ts             # Definiciones de 21 tablas
│   ├── SupabaseConnector.ts     # Puente de sync
│   └── powersync-react-shim.js  # Shim Android (polling)
│
├── context/AuthContext.tsx       # Auth + RBAC
├── hooks/                       # 9 hooks custom
├── utils/                       # PDFs (DeliveryTicket, PolishersReport)
├── constants/                   # Templates, datos, tema
└── config/supabase.ts           # Cliente Supabase
```

### Logica de Negocio

La logica de negocio reside principalmente en:
- **`src/services/SupabaseService.ts`**: Monolito con 40+ metodos async cubriendo CRUD para todos los dominios (jobs, workers, materials, tickets, etc.)
- **`src/services/OfflinePhotoService.ts`**: Cola de fotos con retry automatico cada 30s
- **`src/powersync/SupabaseConnector.ts`**: Transformacion de operaciones CRUD para sync

---

## 4. COMPLEJIDAD Y DEUDA TECNICA

### Top 3 Archivos mas Complejos

#### 1. `src/services/SupabaseService.ts` — 3,323 lineas
- **Problema**: Monolito unico que maneja TODA la logica de datos
- **Contenido**: 40+ metodos async, tipos/interfaces, logica de plataforma (web vs native)
- **Riesgo**: Dificil de mantener, testear, y refactorizar
- **Recomendacion**: Dividir en servicios por dominio (JobService, MaterialService, WorkerService, etc.)

#### 2. `src/components/logistics/AddBudgetItemModal.tsx` — 1,151 lineas
- **Problema**: Calculadora de materiales con estado de formulario complejo
- **Contenido**: Presets de trowel, calculos de cobertura (sqft/bag), costos con desperdicio, especificaciones de grout/caulk
- **Riesgo**: Logica de calculo mezclada con UI
- **Recomendacion**: Extraer logica de calculo a funciones utilitarias separadas

#### 3. `src/components/warehouse/ReceivingList.tsx` — 957 lineas
- **Problema**: Recepcion de PO con tracking granular
- **Contenido**: Recepcion por cantidad/piezas/cajas, reporte de danos, notas de discrepancia, modales multiples
- **Riesgo**: Alta complejidad de estado
- **Recomendacion**: Descomponer en sub-componentes

### Workarounds Conocidos

| Workaround | Archivo | Severidad | Descripcion |
|------------|---------|-----------|-------------|
| PowerSync Shim | `metro.config.js` + `powersync-react-shim.js` | ALTA | `@powersync/react` falla en Android New Arch. Polling cada 2s como reemplazo |
| Column Stripping | `SupabaseConnector.ts` | MEDIA | Columnas locales (`foreman_email`, `position`) no existen en Supabase |
| Boolean Coercion | `SupabaseConnector.ts` | MEDIA | SQLite booleans → integers para PostgreSQL |
| @dnd-kit Guards | `DeliveriesView.tsx`, `CalendarWeekView.tsx` | MEDIA | Drag & drop solo disponible en web, guarded con `Platform.OS` |
| File Path Recovery | `OfflinePhotoService.ts` | BAJA | Paths de sandbox cambian con actualizaciones de app |

### Metricas de Calidad

| Metrica | Valor | Estado |
|---------|-------|--------|
| Archivos de test | 0 | **CRITICO - Sin tests** |
| Usos de tipo `any` | 487+ | **Mejorable** |
| Console.error/warn | 144+ | Exceso de logging debug |
| TODOs pendientes | 2 | Minimo |

---

## 5. FLUJOS CRITICOS / FUNCIONALIDADES IMPLEMENTADAS

### Pantallas y Modulos (19 rutas)

| Modulo | Ruta | Estado | Complejidad |
|--------|------|--------|-------------|
| **Dashboard** | `/(tabs)/` | Completo | Alta |
| **Login** | `/login` | Completo | Media |
| **Gestion de Trabajos** | `/(tabs)/jobs` | Completo | Muy Alta |
| **Detalle de Trabajo** | `/(tabs)/jobs/[id]` | Completo | Muy Alta |
| **Detalle de Unidad** | `/(tabs)/jobs/[id]/[unitId]` | Parcial (TODOs) | Alta |
| **Operaciones de Campo** | `/(tabs)/field` | Completo | Alta |
| **Almacen/Recepcion** | `/(tabs)/warehouse` | Completo | Muy Alta |
| **Logistica** | `/(tabs)/logistics` | Completo | Alta |
| **Manpower** | `/(tabs)/manpower` | Completo | Alta |
| **Pulidoras/Equipo** | `/(tabs)/polishers` | Completo | Media |
| **Reportes** | `/(tabs)/reports` | Completo | Media |
| **Incidencias** | `/job-issues/[id]` | Completo | Media |
| **Acceso de Equipo** | `/(tabs)/team-access` | Completo | Baja |

### Funcionalidades Principales

1. **Autenticacion con RBAC**: Login, sesion persistente, 4 roles (admin, pm, foreman, warehouse)
2. **Gestion de Proyectos**: CRUD de trabajos, pisos, unidades, areas con checklists
3. **Seguimiento de Produccion**: Logs diarios, horas regulares/OT, asignacion de trabajadores
4. **Sistema de Fotos Offline**: Captura con camara, almacenamiento local, sync automatico
5. **Almacen y Recepcion**: Ordenes de compra, recepcion granular, reporte de discrepancias
6. **Logistica de Entregas**: Tickets de entrega, aprobaciones (supervisor/foreman), generacion PDF
7. **Presupuesto de Materiales**: Calculadora de materiales con presets, costos, desperdicio
8. **Reporte de Incidencias**: Issues por area con fotos, comentarios, prioridades
9. **Manpower**: Asignacion de personal a proyectos, scheduling
10. **Generacion de PDFs**: Tickets de entrega, reportes de pulidoras
11. **Dashboard Analitico**: Widgets de salud de proyecto, velocidad, estado de equipo
12. **Sync Bidireccional**: Datos sincronizados entre movil y web via PowerSync + Supabase

### Esquema de Base de Datos (21 tablas)

| Tabla | Proposito | Sync |
|-------|-----------|------|
| `workers` | Personal/equipo | Si |
| `jobs` | Proyectos | Si |
| `floors` | Pisos por proyecto | Si |
| `units` | Unidades por piso | Si |
| `areas` | Areas por unidad | Si |
| `checklist_items` | Items de checklist | Si |
| `tickets` | Tickets de issues | Si |
| `production_logs` | Logs de produccion | Si |
| `profiles` | Perfiles de usuario | Si |
| `area_photos` | Fotos de area | Si |
| `job_issues` | Incidencias | Si |
| `issue_comments` | Comentarios | Si |
| `project_materials` | Materiales/presupuesto | Si |
| `delivery_tickets` | Tickets de entrega | Si |
| `purchase_orders` | Ordenes de compra | Si |
| `po_items` | Items de OC | Si |
| `material_claims` | Reclamos de material | Si |
| `system_notifications` | Notificaciones | Si |
| `inventory` | Inventario | Si |
| `offline_photos` | Cola de fotos offline | **Solo local** |

---

## 6. STACK COMPLETO

```
┌─────────────────────────────────────────┐
│         Pantallas / Rutas (19)          │  Expo Router file-based
├─────────────────────────────────────────┤
│      Componentes (73 reutilizables)     │  NativeWind + React Native
├─────────────────────────────────────────┤
│         Custom Hooks (9)                │  Data fetching, tema, status
├─────────────────────────────────────────┤
│    Services (SupabaseService, etc.)     │  Operaciones CRUD (3,323 lineas)
├─────────────────────────────────────────┤
│       AuthContext + RBAC                │  Permisos basados en roles
├─────────────────────────────────────────┤
│     PowerSync + Connector               │  Puente de sync offline
├─────────────────────────────────────────┤
│       SQLite Local DB                   │  Quick SQLite + PowerSync
├─────────────────────────────────────────┤
│       Supabase Backend                  │  PostgreSQL + Auth + Storage
└─────────────────────────────────────────┘
```

### Flujo de Datos

- **Lectura**: SQLite local (PowerSync) → UI (instantaneo, offline)
- **Escritura**: SQLite local → Cola PowerSync → Supabase (async)
- **Sync**: Polling cada 2s (shim) + WebSocket PowerSync
- **Auth**: JWT Supabase en SecureStore/localStorage
- **Fotos**: Camara → archivo local → cola offline → Supabase Storage (background)

---

## 7. RECOMENDACIONES

### Prioridad Alta
1. **Agregar tests**: 0 archivos de test. Priorizar SupabaseService y flujo de sync
2. **Refactorizar SupabaseService**: Dividir monolito de 3,323 lineas en servicios por dominio
3. **Reducir usos de `any`**: 487+ instancias afectan type safety
4. **Monitorear shim PowerSync**: Polling cada 2s es aceptable pero no ideal

### Prioridad Media
1. **Completar TODOs**: 2 TODOs en pantalla de unidad (fotos/issues)
2. **Consistencia de schema**: Columnas locales vs Supabase requieren mantenimiento manual
3. **Error tracking**: Implementar Sentry o similar para produccion
4. **Consolidar logging**: 144+ console.error/warn en produccion

### Prioridad Baja
1. **Soporte web completo**: Actualmente usa mocks; considerar implementacion completa
2. **Documentar workarounds**: PowerSync shim, column stripping, dnd-kit guards
3. **Limpiar logs de debug**: Remover console.log de builds de produccion
