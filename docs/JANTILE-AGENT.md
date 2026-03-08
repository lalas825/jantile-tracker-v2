# Jantile Agent — Documentacion Tecnica

## Resumen

Jantile Agent es un asistente AI de gestion de construccion que opera en dos canales:
- **Telegram Bot** — via webhook (`telegram-webhook`)
- **Web Chat** — widget flotante en la app web (`web-chat` + `FloatingChat.tsx`)

Ambos canales comparten la misma logica AI, herramientas y autenticacion a traves del modulo `_shared/`.

---

## Arquitectura

```
supabase/functions/
  _shared/                        ← Modulo compartido (NO se despliega)
    types.ts                      ← Tipos: Profile, ToolContext, ChatMessage
    ai/
      gemini.ts                   ← Motor AI: chatWithGemini, analyzePhoto
      tools.ts                    ← 18 tool declarations para Gemini Function Calling
      tool-handlers.ts            ← Implementacion de las 18 herramientas
      checklist-presets.ts         ← Templates de checklist por tipo de area
    auth/
      auth.ts                     ← Autenticacion multi-canal + contexto de acceso
  telegram-webhook/
    index.ts                      ← Webhook handler de Telegram (commands + AI + photos)
  web-chat/
    index.ts                      ← HTTP API: POST {message, session_id} → {response}

src/components/
  FloatingChat.tsx                ← Widget de chat flotante (solo web)
```

---

## Modelo AI

| Parametro | Valor |
|-----------|-------|
| **Modelo principal** | `gemini-2.5-flash` |
| **Modelo vision** | `gemini-2.5-flash-lite` |
| **API** | Google Generative AI v1beta |
| **Temperatura** | 0.7 (texto) / 0.5 (vision) |
| **Max tokens** | 2048 (texto) / 1024 (vision) |
| **Rondas de function calling** | Max 5 por request |
| **Tool calling mode** | `AUTO` |

### Modos de Operacion

1. **Texto + Tools** — El usuario envia texto, Gemini puede invocar herramientas (hasta 5 rondas de tool calls encadenados)
2. **Vision** — El usuario envia imagen, se analiza sin herramientas (modelo lite para velocidad)

### Formato de Respuesta

| Canal | Formato | Detalles |
|-------|---------|----------|
| Telegram | HTML | Solo tags compatibles: `<b>`, `<i>`, `<code>`, `<pre>`. Usa `•`/`▸` para listas |
| Web | Markdown | `**bold**`, `*italic*`, `` `code` `` |

---

## Herramientas (Function Calling)

18 herramientas disponibles, agrupadas por dominio:

### Jobs (Proyectos)
| Tool | Descripcion | Permisos |
|------|-------------|----------|
| `get_jobs` | Lista jobs activos con % de progreso | Todos (filtrado por asignacion) |
| `get_job_details` | Desglose: pisos → unidades → areas con progreso | Todos (filtrado) |
| `create_job` | Crear un nuevo job | Solo admin |
| `delete_job` | Eliminar job + cascada de todos sus datos | Solo admin |
| `bulk_create_structure` | Crear pisos/unidades/areas en lote (max 10 pisos/call) | Solo admin |

### Issues (Problemas)
| Tool | Descripcion | Permisos |
|------|-------------|----------|
| `get_issues` | Issues abiertas, filtro por job/prioridad | Todos (filtrado) |
| `create_issue` | Crear issue (tipo, prioridad, descripcion) | Todos |

### Checklist
| Tool | Descripcion | Permisos |
|------|-------------|----------|
| `get_checklist` | Items de checklist de un area | Todos |
| `update_checklist_items` | Marcar items completos/incompletos + recalcular progreso | Todos excepto warehouse/shop |
| `find_areas` | Buscar areas por nombre dentro de un job | Todos |

### Crew (Equipo)
| Tool | Descripcion | Permisos |
|------|-------------|----------|
| `get_manpower` | Crew activo en campo (check-in sin check-out) | Todos |
| `get_workers` | Roster de trabajadores (filtro por rol/status/job) | Todos excepto worker |
| `get_production_logs` | Horas de pulidores (reg + OT) por periodo | Todos excepto worker |
| `get_crew_checkins` | Registros de entrada/salida por fecha | Todos |
| `get_production_summary` | Resumen de produccion (horas + sqft) por fecha | Todos |

### Warehouse (Almacen)
| Tool | Descripcion | Permisos |
|------|-------------|----------|
| `get_materials` | Inventario de materiales de un job | admin, supervisor, pm, warehouse |
| `get_deliveries` | Tickets de entrega de un job | admin, supervisor, pm, warehouse |
| `get_purchase_orders` | Ordenes de compra con items | admin, supervisor, pm, warehouse |

---

## Sistema de Roles (RBAC)

7 roles con permisos diferenciados:

| Rol | Jobs | Issues | Checklists | Warehouse | Crew | Admin |
|-----|------|--------|------------|-----------|------|-------|
| `admin` | Full | Full | Full | Full | Full | CRUD Jobs |
| `supervisor` | Asignados | Full | Full | Full | Full | - |
| `pm` | Asignados | Full | Full | Full | Read | - |
| `foreman` | Asignados | Full | Full | - | Full | - |
| `worker` | Asignados | Create | Read | - | Self | - |
| `warehouse` | Read-only | Create | - | Full | Read workers | - |
| `shop` | Read-only | Create | - | - | Read workers | - |

### Filtrado de Acceso

- **Admin**: `jobIds = null` → sin filtro, ve todo
- **Otros roles**: `jobIds = [...]` → solo jobs asignados via tabla `job_assignments`
- Cada tool handler verifica acceso via `accessCheck()` y `applyJobFilter()`

---

## Autenticacion

### Telegram (`authenticateByTelegramId`)
```
telegram_id → profiles.telegram_id → Profile
```
- Valida que `profile.status === 'approved'`
- Usuarios no registrados → "Unauthorized"
- Usuarios pendientes → "Account pending approval"

### Web (`authenticateBySupabaseToken`)
```
Authorization: Bearer <jwt> → supabase.auth.getUser(token) → userId → profiles.id → Profile
```
- JWT de Supabase Auth estandar
- Misma validacion de `status === 'approved'`

---

## Canales

### Telegram Bot

**Endpoint**: `supabase/functions/telegram-webhook`
**Seguridad**: Header `x-telegram-bot-api-secret-token`

#### Comandos Directos
| Comando | Descripcion |
|---------|-------------|
| `/start` | Mensaje de bienvenida + lista de comandos |
| `/jobs` | Jobs activos con barra de progreso visual |
| `/issues` | Issues abiertas agrupadas por prioridad |
| `/manpower` | Crew activo en campo por job |
| `/new_issue <job#> <desc>` | Crear issue rapido |

#### Flujo AI
1. Texto libre → `chatWithGemini()` con historial (10 mensajes)
2. Foto → `analyzePhoto()` via modelo vision (analisis de construccion / floor plans)
3. Respuestas en HTML compatible con Telegram
4. Fallback: si HTML falla al enviar, reintenta sin `parse_mode`

#### Historial
- Tabla: `telegram_chat_history`
- Campos: `chat_id`, `role`, `content`, `created_at`
- Max: 10 mensajes cargados, 20 retenidos (auto-prune)

### Web Chat

**Endpoint**: `supabase/functions/web-chat`
**Auth**: JWT de Supabase en header `Authorization`

#### API
```
POST /web-chat
Headers: Authorization: Bearer <jwt>
Body: { "message": "...", "session_id": "uuid" }
Response: { "response": "..." }
```

#### CORS
- Permite `*` (todos los origenes)
- Headers: `authorization`, `x-client-info`, `apikey`, `content-type`
- Preflight `OPTIONS` → 204

#### Historial
- Tabla: `web_chat_history`
- Campos: `session_id`, `user_id`, `role`, `content`, `created_at`
- Max: 10 mensajes cargados, 20 retenidos (auto-prune)

### FloatingChat (Frontend)

Widget React Native Web (`Platform.OS === 'web'` only):
- Boton flotante azul (esquina inferior derecha)
- Panel expandible 380x520px con historial de chat
- Session ID generado con `crypto.randomUUID()` por sesion
- Llama a `supabase.functions.invoke('web-chat', { body })`
- Solo visible para usuarios autenticados

---

## Checklist Presets

Cada area creada via `bulk_create_structure` recibe automaticamente un checklist basado en su tipo:

| Tipo de Area | Items | Tareas |
|-------------|-------|--------|
| Master/Secondary Bathroom | 12 | Soundproof, Mud, Waterproof, Heat Mat, Floor Tile, Wall Tile, Tub Deck, Base, Grout, Caulk, Sealer, Vanity Top |
| Powder Room, Locker, Janitor, Laundry | 10 | Soundproof, Mud, Waterproof, Floor Tile, Wall Tile, Base, Grout, Caulk, Sealer, Vanity Top |
| Kitchen | 6 | Counter Top, Backsplash, Island, Akemi, Caulk, Sealer |
| Foyer, Vestibule, Corridor | 8 | Soundproof, Mud, Waterproof, Floor Tile, Base, Grout, Caulk, Sealer |

---

## System Instructions

El agente recibe instrucciones contextuales dinamicas:

1. **Base Instruction** — Comportamiento general, estilo de respuesta, reglas de tool usage
2. **Format Instruction** — HTML (Telegram) o Markdown (Web)
3. **Role Instruction** — Permisos y restricciones segun rol del usuario
4. **Date Context** — Fecha actual (`{TODAY}`) y lunes de la semana (`{MONDAY}`) inyectados para auto-calculo
5. **User Context** — Nombre y rol del usuario actual

### Vision Instruction
Para analisis de imagenes:
- Fotos de construccion → calidad, tipo de trabajo, problemas
- Floor plans / spreadsheets → extraccion de estructura (pisos/unidades/areas)

---

## Manejo de Errores

| Error | Comportamiento |
|-------|---------------|
| Gemini API error (HTTP) | Retorna mensaje con status code |
| `MALFORMED_FUNCTION_CALL` | Retorna error inmediato (sin retry para evitar timeout) |
| `SAFETY` block | Mensaje pidiendo reformular |
| Tool execution error | Se envia como `functionResponse` con `{ error }` para que Gemini lo maneje |
| Telegram HTML parse error | Fallback a texto plano (sin parse_mode) |
| Auth failure | 401 con mensaje contextual |
| Request timeout (5 rondas) | Mensaje sugiriendo simplificar la pregunta |

---

## Tablas de Base de Datos Utilizadas

### Datos de Negocio
`jobs`, `floors`, `units`, `areas`, `checklist_items`, `area_photos`,
`job_issues`, `project_materials`, `delivery_tickets`, `purchase_orders`, `po_items`,
`workers`, `production_logs`, `crew_checkins`

### Auth y Acceso
`profiles`, `job_assignments`

### Historial de Chat
`telegram_chat_history`, `web_chat_history`

---

## Deploy

```bash
# Telegram webhook (requiere --no-verify-jwt por validacion manual del secret)
npx supabase functions deploy telegram-webhook --no-verify-jwt

# Web chat (requiere --no-verify-jwt, auth manual via JWT)
npx supabase functions deploy web-chat --no-verify-jwt
```

### Variables de Entorno Requeridas
| Variable | Uso |
|----------|-----|
| `GEMINI_API_KEY` | API key de Google AI |
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram |
| `TELEGRAM_WEBHOOK_SECRET` | Secret para validar webhooks |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (acceso completo a DB) |
