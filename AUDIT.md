# JantileTracker2 — Auditoría Completa del Código

> Generado: 4 de marzo de 2026
> Proyecto: **JantileTracker2** — Sistema de gestión de proyectos de construcción/instalación de azulejos
> Paquete: `com.jantile.trackerv2` | Versión: 1.0.0

---

## 1. Resumen Ejecutivo

**JantileTracker2** es una aplicación multiplataforma (iOS, Android, Web) construida con **Expo/React Native** y **TypeScript**. Implementa un sistema completo de gestión para proyectos de instalación de azulejos y mosaicos, con soporte offline-first mediante **PowerSync** y backend en **Supabase** (PostgreSQL).

| Métrica | Valor |
|---------|-------|
| Archivos fuente (TS/TSX) | ~122 |
| Dependencias | 65 producción, 8 desarrollo |
| Páginas/rutas | 19 |
| Componentes reutilizables | ~60+ |
| Custom hooks | 9 |
| Servicios | 3 |
| Tests | 0 |
| Plataformas | iOS, Android, Web |

---

## 2. Stack Tecnológico

### Frontend
| Tecnología | Versión | Propósito |
|-----------|---------|-----------|
| Expo | 54.0.32 | Framework cross-platform |
| React | 19.1.0 | UI Library |
| React Native | 0.81.5 | Mobile framework |
| Expo Router | 6.0.22 | File-based routing |
| TypeScript | 5.9.2 | Tipado estático |
| NativeWind | 4.2.1 | TailwindCSS para RN |
| TailwindCSS | 3.4.19 | Utility-first CSS |
| Lucide React Native | 0.562.0 | Iconografía |
| React Native Chart Kit | 6.12.0 | Gráficos/charts |
| React Navigation | 7.x | Navegación |

### Backend & Datos
| Tecnología | Versión | Propósito |
|-----------|---------|-----------|
| Supabase | 2.93.1 | BaaS (Auth + PostgreSQL) |
| PowerSync React | 1.8.2 | Sync offline-first |
| PowerSync React Native | 1.29.0 | Sync nativo |
| Quick SQLite | 2.5.0 | Base de datos local |

### Funcionalidades Nativas
| Módulo | Propósito |
|--------|-----------|
| expo-media-library | Galería de fotos |
| expo-image-picker | Captura de imágenes |
| expo-secure-store | Almacenamiento seguro |
| expo-file-system | Sistema de archivos |
| expo-haptics | Feedback háptico |
| expo-print | Generación de PDFs |
| datetimepicker | Selector de fecha/hora |

---

## 3. Arquitectura del Proyecto

```
JantileTracker2/
├── src/
│   ├── app/                          # Rutas (Expo Router file-based)
│   │   ├── _layout.tsx               # Layout raíz con AuthGuard
│   │   ├── login.tsx                 # Pantalla de login/signup
│   │   ├── (tabs)/                   # Navegación por tabs
│   │   │   ├── _layout.tsx           # Tab layout (mobile tabs + desktop sidebar)
│   │   │   ├── index.tsx             # Dashboard principal
│   │   │   ├── jobs/                 # Módulo de trabajos
│   │   │   │   ├── index.tsx         # Lista de trabajos
│   │   │   │   ├── [id].tsx          # Detalle de trabajo
│   │   │   │   └── [id]/[unitId]/    # Detalle de unidad con tabs
│   │   │   ├── field.tsx             # Operaciones de campo
│   │   │   ├── warehouse.tsx         # Gestión de almacén
│   │   │   ├── shop.tsx              # Taller/equipamiento
│   │   │   ├── logistics.tsx         # Logística (oculto)
│   │   │   ├── manpower.tsx          # Gestión de personal
│   │   │   ├── reports.tsx           # Reportes/analytics
│   │   │   ├── polishers.tsx         # Gestión de pulidoras
│   │   │   ├── team-access.tsx       # Control de acceso
│   │   │   └── menu.tsx              # Menú drawer
│   │   ├── job-issues/[id].tsx       # Detalle de incidencias
│   │   └── logistics/new-request.tsx # Nueva solicitud logística
│   │
│   ├── components/                   # Componentes reutilizables
│   │   ├── dashboard/                # Widgets del dashboard
│   │   ├── jobs/                     # Componentes de trabajos
│   │   │   └── tabs/                 # Tabs del detalle de trabajo
│   │   ├── logistics/                # Componentes de logística
│   │   ├── warehouse/                # Componentes de almacén
│   │   ├── modals/                   # Modales globales
│   │   ├── navigation/               # Desktop navbar
│   │   ├── pickers/                  # Date/time pickers
│   │   ├── ui/                       # UI primitivos
│   │   └── wizard/                   # Wizard multi-step
│   │
│   ├── hooks/                        # Custom React hooks
│   ├── context/                      # React Context (Auth)
│   ├── services/                     # Lógica de negocio
│   ├── powersync/                    # Configuración de sync
│   ├── config/                       # Configuración (Supabase)
│   ├── constants/                    # Datos estáticos y temas
│   ├── utils/                        # Utilidades (PDF, etc.)
│   └── lib/                          # Integraciones
│
├── assets/                           # Imágenes y logos
├── android/                          # Proyecto nativo Android
├── dist/                             # Build web output
├── docs/                             # Documentación
└── [archivos de configuración]       # package.json, tsconfig, etc.
```

---

## 4. Esquema de Base de Datos (PowerSync/SQLite)

### Tablas Principales

#### `jobs` — Trabajos/Proyectos
| Campo | Descripción |
|-------|-------------|
| id, name, job_number | Identificación |
| address, gc_name | Ubicación y contratista general |
| total_units, total_budget | Métricas del proyecto |
| status | Estado del trabajo |

#### `floors` — Pisos
| Campo | Descripción |
|-------|-------------|
| id, job_id, name | Piso dentro de un trabajo |

#### `units` — Unidades
| Campo | Descripción |
|-------|-------------|
| id, floor_id, name, type | Unidad dentro de un piso (producción/logística) |

#### `areas` — Áreas de trabajo
| Campo | Descripción |
|-------|-------------|
| id, unit_id, name | Área dentro de una unidad |
| progress | Porcentaje de avance |

#### `workers` — Trabajadores
| Campo | Descripción |
|-------|-------------|
| id, name, role, status | Perfil del trabajador |
| phone, email | Contacto |

#### `profiles` — Perfiles de usuario
| Campo | Descripción |
|-------|-------------|
| id, full_name, email | Datos del usuario |
| role, avatar_url | Rol y avatar |

#### `crew_checkins` — Check-in/out de cuadrilla
| Campo | Descripción |
|-------|-------------|
| job_id, worker_id | Relación trabajo-trabajador |
| check_in_time, check_out_time | Horarios |

#### `project_materials` — Materiales del proyecto
| Campo | Descripción |
|-------|-------------|
| job_id, area_id | Relación con proyecto y área |
| product_code, product_name | Identificación del material |
| category, supplier | Clasificación |
| length, width, thickness | Dimensiones |
| net_qty, budget_qty, ordered_qty | Cantidades |
| received_qty, shop_stock_qty | Inventario |
| in_warehouse_qty, in_transit_qty | Estado logístico |
| pieces_per_unit, sqft_per_piece | Cálculos de azulejo |
| grout_info, caulk_info, trowel_presets | Especificaciones técnicas |

#### `delivery_tickets` — Tickets de entrega
| Campo | Descripción |
|-------|-------------|
| id, job_id | Relación con trabajo |
| items, approval status | Detalle y aprobación |

#### `purchase_orders` — Órdenes de compra
| Campo | Descripción |
|-------|-------------|
| id, vendor, amount | Datos de la orden |
| po_items (tabla relacionada) | Líneas de la orden |

#### `production_logs` — Registro de producción
| Campo | Descripción |
|-------|-------------|
| job_id, area_id, worker_id | Relaciones |
| regular_hours, ot_hours | Horas trabajadas |

#### `job_issues` — Incidencias
| Campo | Descripción |
|-------|-------------|
| id, job_id, title | Identificación |
| priority (Low/Medium/High) | Prioridad |
| status (open/resolved) | Estado |
| photos | Evidencia fotográfica |

#### `issue_comments` — Comentarios de incidencias
| Campo | Descripción |
|-------|-------------|
| issue_id, author | Relación y autor |
| content | Texto del comentario |

#### `area_photos` — Fotos de áreas
| Campo | Descripción |
|-------|-------------|
| area_id | Área documentada |
| url, metadata | Imagen y datos |

#### `offline_photos` — Fotos offline (localOnly)
| Campo | Descripción |
|-------|-------------|
| Almacenamiento local | Cola de subida asíncrona |

#### `tickets` — Tickets de trabajo
| Campo | Descripción |
|-------|-------------|
| wizard_data | Datos del formulario multi-step |

#### `checklist_items` — Checklist por área
| Campo | Descripción |
|-------|-------------|
| area_id | Área asociada |
| tasks | Lista de verificación |

#### `system_notifications` — Notificaciones
| Campo | Descripción |
|-------|-------------|
| user_id, message | Destino y contenido |

#### `material_claims` — Reclamos de material
| Campo | Descripción |
|-------|-------------|
| Tracking de discrepancias | Material recibido vs. esperado |

---

## 5. Módulos Funcionales

### 5.1 Dashboard (`/`)
- KPIs en tiempo real (issues abiertas, resueltas, trabajos activos)
- Widget de velocidad de trabajo con gráficos
- Métricas de salud global (donut charts)
- Estado de check-in de cuadrillas
- Tracking de rendimiento

### 5.2 Gestión de Trabajos (`/jobs`)
- Listado con búsqueda y filtros
- Jerarquía: **Job → Floors → Units → Areas**
- Detalle con dirección, contratista general, conteo de unidades
- Tracking de progreso por área
- Cálculo de porcentaje de completitud

### 5.3 Detalle de Unidad (`/jobs/[id]/[unitId]`)
Sistema de tabs con múltiples vistas:

| Tab | Funcionalidad |
|-----|---------------|
| **JobSite** | Vista general del trabajo |
| **Logistics** | Materiales y entregas |
| **Production** | Tracking de avance |
| **Issues** | Reporte/tracking de defectos |
| **Photos** | Documentación fotográfica |
| **Safety** | Peligros y JHA |
| **SafetyToolbox** | Planificación pre-tarea |
| **Punchlist** | Items pendientes de completar |
| **LogTime** | Registro de horas |
| **TicketWork** | Tickets de trabajo |
| **Documents** | Gestión documental |
| **SignOffs** | Aprobaciones y firmas |
| **PreTaskPlan** | Planificación pre-tarea |
| **ScopeOfWork** | Alcance del trabajo |
| **Deficient** | Tracking de deficiencias |

### 5.4 Almacén/Warehouse (`/warehouse`)
- Dashboard de inventario
- Sistema de tickets de entrega
- Órdenes de compra con ítems
- Calendario de recepción/envío de materiales
- Tracking de inventario (stock, en tránsito, en almacén)
- Calculadora de azulejos
- Tracker de entregas en vivo
- Vista de órdenes directas
- Tracking de presupuesto por área

### 5.5 Operaciones de Campo (`/field`)
- Gestión de cuadrillas
- Flujo de aprobaciones de tickets de entrega
- Monitoreo en tiempo real

### 5.6 Personal/Manpower (`/manpower`)
- Perfiles de trabajadores
- Asignaciones a cuadrillas
- Check-in/check-out
- Asignación de roles

### 5.7 Taller/Shop (`/shop`)
- Gestión de equipos/herramientas
- Gestión de pulidoras
- Tracking de mantenimiento

### 5.8 Reportes (`/reports`)
- Dashboard analítico
- Métricas de rendimiento
- Generación de reportes

### 5.9 Incidencias (`/job-issues/[id]`)
- Creación con fotos de evidencia
- Tracking de estado (abierta/resuelta)
- Niveles de prioridad (Baja/Media/Alta)
- Comentarios y discusión
- Adjuntos fotográficos

### 5.10 Control de Acceso (`/team-access`)
- Roles: Admin, PM, Foreman, Warehouse
- Control de permisos basado en roles
- Gestión de miembros del equipo

---

## 6. Servicios y Lógica de Negocio

### `SupabaseService.ts` (~250+ líneas)
Servicio centralizado para todas las operaciones con Supabase:
- CRUD de trabajos, materiales, tickets
- Operaciones de autenticación
- Queries optimizadas

### `OfflinePhotoService.ts`
- Cola de fotos para subida asíncrona
- Almacenamiento local con sync posterior
- Gestión de estados de upload

### `MockJobStore.ts`
- Datos mock para desarrollo
- Simulación de respuestas de API

---

## 7. Custom Hooks

| Hook | Propósito |
|------|-----------|
| `useJobsData` | Fetch y caché de trabajos |
| `useLogisticsData` | Datos de logística (nativo) |
| `useLogisticsData.web` | Datos de logística (web) |
| `useDeliveryTickets` | Operaciones de tickets de entrega |
| `usePolishersData` | Gestión de pulidoras |
| `useSafeStatus` | Estado de safe area |
| `useColorScheme` | Detección dark/light mode |
| `useColorScheme.web` | Tema para web |
| `useThemeColor` | Utilidades de color del tema |

---

## 8. Autenticación y Seguridad

### Sistema de Auth
- **Proveedor:** Supabase Auth
- **Contexto:** `AuthContext.tsx` — Proveedor global de autenticación
- **Almacenamiento:** Expo Secure Store para tokens
- **Guard:** Layout raíz con protección de rutas

### Roles y Permisos
| Rol | Descripción |
|-----|-------------|
| `admin` | Acceso completo al sistema |
| `pm` | Project Manager — gestión de proyectos |
| `foreman` | Capataz — operaciones de campo |
| `warehouse` | Almacenero — gestión de inventario |

---

## 9. Sincronización y Offline-First

### PowerSync
- **Endpoint:** `https://6972a62c5f8ee4c52500ae6f.powersync.journeyapps.com`
- **Sync Rules** (`sync-rules.yaml`):
  - **Bucket global:** Todas las tablas compartidas (workers, jobs, materials, tickets, photos, issues, notifications)
  - **Bucket por usuario:** Perfiles específicos del usuario autenticado
- **SQLite local:** Almacenamiento offline completo
- **Componentes wrapper:** `PowerSyncWrapper.tsx` (nativo) y `PowerSyncWrapper.web.tsx` (web)

---

## 10. Configuración de Build y Deploy

### Expo Application Services (EAS)
```json
{
  "build": {
    "preview": { "android": { "buildType": "apk" } },
    "production": { "android": { "buildType": "app-bundle" } }
  }
}
```
- **Android SDK:** 54
- **Preview:** APK directo
- **Production:** App Bundle para Play Store

### Vercel (Web)
- Configurado con rewrites para SPA routing
- Build output en `/dist/`

### Permisos Android
- Cámara
- Micrófono
- Media library (lectura/escritura)

---

## 11. Fuentes y Tipografía

| Fuente | Pesos | Uso |
|--------|-------|-----|
| Outfit | 400, 700, 900 | Títulos y UI |
| Inter | 400, 700, 900 | Texto general |

---

## 12. Componentes por Categoría

### Dashboard (4)
- `GlobalHealthWidget.tsx` / `.web.tsx` — Métricas KPI
- `JobVelocityWidget.tsx` / `.web.tsx` — Gráficos de rendimiento
- `chartConfig.ts` — Configuración de gráficos

### Jobs (14)
- `AreaCard.tsx` — Tarjeta de área
- `AreaDetailsDrawer.tsx` — Panel de detalles
- `JobSiteTab.tsx` — Tab de sitio
- `LogisticsTab.tsx` — Tab logística
- `ProductionTab.tsx` — Tab producción
- `UnitLevelAccordion.tsx` — Acordeón de unidades
- 8 tabs especializados en `tabs/`

### Logística (13)
- `DeliveryTicketModal.tsx` — Creación de tickets
- `TileCalculator.tsx` — Calculadora de materiales
- `LiveDeliveryTracker.tsx` — Tracking en vivo
- `UnifiedLogisticsTable.tsx` — Tabla unificada
- `AreaBudgetView.tsx` — Presupuesto por área
- 8 componentes adicionales

### Almacén (14)
- `InventoryView.tsx` — Niveles de stock
- `ReceivingCalendar.tsx` / `OutboundCalendar.tsx` — Calendarios
- `FleetManagementModal.tsx` — Gestión de flota
- `DirectOrdersView.tsx` — Órdenes directas
- 10 componentes adicionales

### Modales (7)
- `CloningModal.tsx` — Clonar trabajo/área
- `ReceiveMaterialModal.tsx` — Recibir material
- `ReportDeficiencyModal.tsx` — Reportar deficiencia
- `ReportJobIssueModal.tsx` — Reportar incidencia
- `ReportPunchlistItemModal.tsx` — Item de punchlist
- `ReportSafetyIssueModal.tsx` — Peligro de seguridad
- `StructureModal.tsx` — Edición de estructura

---

## 13. Utilidades

| Archivo | Propósito |
|---------|-----------|
| `DeliveryTicketPDF.ts` | Generación de PDF para tickets de entrega |
| `global.css` | Estilos globales de Tailwind |
| `polyfills.ts` | Polyfills para APIs del navegador |

---

## 14. Estado Actual y Observaciones

### Fortalezas
- Arquitectura offline-first robusta con PowerSync
- Cobertura funcional amplia (jobs, materials, warehouse, safety, crew)
- Soporte multiplataforma real (iOS, Android, Web)
- Sistema de roles y permisos implementado
- UI consistente con TailwindCSS/NativeWind

### Áreas de Mejora
- **Sin tests:** No hay cobertura de testing (unit, integration, e2e)
- **Sin documentación técnica:** Solo README genérico de Expo
- **Datos mock:** MockJobStore sugiere que algunos flujos aún usan datos simulados
- **Tabs ocultos:** Varias secciones están marcadas como ocultas en la navegación (logistics, manpower, reports, polishers, menu, team-access)
- **Proyecto duplicado:** Existe una copia nested en `jantile-tracker-v2/` dentro del proyecto principal
- **Proyecto antiguo:** `/c/dev/JantleTracker2/` (con typo en el nombre) contiene restos de una versión anterior

### Servicios Externos
| Servicio | URL |
|----------|-----|
| Supabase | `https://qxeyoyeqvmkufsfrdxug.supabase.co` |
| PowerSync | `https://6972a62c5f8ee4c52500ae6f.powersync.journeyapps.com` |
| Vercel | Configurado para deploy web |

---

## 15. Mapa de Rutas

```
/login                          → Autenticación
/                               → Dashboard (KPIs, charts, health)
/jobs                           → Lista de trabajos
/jobs/[id]                      → Detalle del trabajo
/jobs/[id]/[unitId]             → Detalle de unidad (multi-tab)
/field                          → Operaciones de campo
/warehouse                      → Gestión de almacén
/shop                           → Taller y equipos
/logistics                      → Logística (oculto)
/manpower                       → Personal (oculto)
/reports                        → Reportes (oculto)
/polishers                      → Pulidoras (oculto)
/team-access                    → Control de acceso (oculto)
/menu                           → Menú drawer (oculto)
/job-issues/[id]                → Detalle de incidencia
/logistics/new-request          → Nueva solicitud logística
```

---

*Documento generado automáticamente mediante auditoría de código.*
