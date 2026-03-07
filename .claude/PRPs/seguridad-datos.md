# Esquema de Seguridad RLS — JANTILE

## Objetivo

Restringir el acceso a datos a nivel de fila en Supabase para que cada usuario solo pueda operar sobre los `jobs` (y sus datos dependientes) donde tenga una asignacion registrada en `job_assignments`. Los roles `admin` y `pm` mantienen acceso global.

---

## 1. Tabla `profiles` (existente)

```sql
-- Ya existe en Supabase, vinculada a auth.users
CREATE TABLE IF NOT EXISTS profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT,
    email       TEXT,
    role        TEXT NOT NULL DEFAULT 'foreman'
                CHECK (role IN ('admin','pm','foreman','warehouse')),
    avatar_url  TEXT,
    updated_at  TIMESTAMPTZ DEFAULT now()
);
```

**Roles**: `admin` (acceso total), `pm` (acceso total), `foreman` (solo jobs asignados), `warehouse` (solo jobs asignados)

---

## 2. Tabla `jobs` (existente)

```sql
-- Columnas clave:
-- id UUID PK, name TEXT, job_number TEXT, status TEXT, foreman_email TEXT
```

---

## 3. Tabla `job_assignments` (NUEVA)

```sql
CREATE TABLE job_assignments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'member'
                CHECK (role IN ('owner','pm','foreman','viewer')),
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, job_id)
);

CREATE INDEX idx_ja_user ON job_assignments(user_id);
CREATE INDEX idx_ja_job  ON job_assignments(job_id);
```

---

## 4. Funciones Helper

### `user_has_job_access(job_id)`

Retorna `TRUE` si el usuario actual es admin/pm O tiene asignacion al job.

```sql
CREATE OR REPLACE FUNCTION public.user_has_job_access(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','pm')
    )
    OR EXISTS (
        SELECT 1 FROM job_assignments WHERE user_id = auth.uid() AND job_id = p_job_id
    );
$$;
```

### `job_id_for_area(area_id)`

Resuelve la jerarquia `areas -> units -> floors -> jobs`.

```sql
CREATE OR REPLACE FUNCTION public.job_id_for_area(p_area_id UUID)
RETURNS UUID
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
    SELECT f.job_id
    FROM areas a
    JOIN units u ON a.unit_id = u.id
    JOIN floors f ON u.floor_id = f.id
    WHERE a.id = p_area_id
    LIMIT 1;
$$;
```

---

## 5. Policies RLS

### `profiles`

| Policy | Operacion | Condicion |
|--------|-----------|-----------|
| `profiles_select_own` | SELECT | `id = auth.uid()` |
| `profiles_select_admin` | SELECT | Caller es admin/pm |
| `profiles_update_own` | UPDATE | `id = auth.uid()` |

### `job_assignments`

| Policy | Operacion | Condicion |
|--------|-----------|-----------|
| `ja_select_own` | SELECT | `user_id = auth.uid()` |
| `ja_select_admin` | SELECT | Caller es admin/pm |
| `ja_insert_admin` | INSERT | Caller es admin/pm |
| `ja_delete_admin` | DELETE | Caller es admin/pm |

### `jobs`

| Policy | Operacion | Condicion |
|--------|-----------|-----------|
| `jobs_select` | SELECT | `user_has_job_access(id)` |
| `jobs_insert` | INSERT | Caller es admin/pm |
| `jobs_update` | UPDATE | `user_has_job_access(id)` |
| `jobs_delete` | DELETE | Caller es admin |

### `checklist_items`

| Policy | Operacion | Condicion |
|--------|-----------|-----------|
| `checklist_select` | SELECT | `user_has_job_access(job_id_for_area(area_id))` |
| `checklist_insert` | INSERT | Mismo |
| `checklist_update` | UPDATE | Mismo |
| `checklist_delete` | DELETE | Mismo |

### Tablas intermedias (`floors`, `units`, `areas`)

| Tabla | Condicion |
|-------|-----------|
| `floors` | `user_has_job_access(job_id)` |
| `units` | `user_has_job_access((SELECT job_id FROM floors WHERE id = floor_id))` |
| `areas` | `user_has_job_access(job_id_for_area(id))` |

---

## 6. Impacto en PowerSync (sync-rules.yaml)

```yaml
bucket_definitions:
  user_jobs:
    parameters:
      - SELECT job_id FROM job_assignments WHERE user_id = request.user_id()
    data:
      - SELECT * FROM jobs WHERE id IN (bucket.job_id)
      - SELECT * FROM floors WHERE job_id IN (bucket.job_id)
      # ... cascada para units, areas, checklist_items

  global_admin:
    parameters:
      - SELECT id AS user_id FROM profiles
        WHERE role IN ('admin','pm') AND id = request.user_id()
    data:
      - SELECT * FROM jobs
      - SELECT * FROM floors
      # ... todas las tablas
```

---

## 7. Impacto en AppSchema.ts

Agregar tabla `job_assignments` al schema local de PowerSync para sincronizacion.

---

## 8. Verificacion

1. Foreman asignado a 1 job: solo ve ese job y sus checklists
2. Foreman NO ve jobs no asignados
3. Admin/PM ven todos los jobs
4. INSERT/DELETE de jobs restringido a admin/pm
5. PowerSync solo sincroniza datos de jobs asignados
