import { ToolContext } from '../types.ts'
import { getPresetForArea } from './checklist-presets.ts'

// ─── Access Helpers ──────────────────────────────────────────────────────────────

function accessCheck(ctx: ToolContext, jobId: string): string | null {
  if (ctx.jobIds !== null && !ctx.jobIds.includes(jobId)) {
    return 'Access denied: you are not assigned to this job.'
  }
  return null
}

function applyJobFilter(query: any, ctx: ToolContext, column = 'job_id') {
  if (ctx.jobIds !== null) {
    return query.in(column, ctx.jobIds)
  }
  return query
}

// ─── Router ──────────────────────────────────────────────────────────────────────

export async function handleToolCall(
  name: string,
  args: any,
  ctx: ToolContext
): Promise<any> {
  switch (name) {
    case 'get_jobs':
      return getJobs(args, ctx)
    case 'get_job_details':
      return getJobDetails(args, ctx)
    case 'get_issues':
      return getIssues(args, ctx)
    case 'create_issue':
      return createIssue(args, ctx)
    case 'get_manpower':
      return getManpower(args, ctx)
    case 'get_checklist':
      return getChecklist(args, ctx)
    case 'update_checklist_items':
      return updateChecklistItems(args, ctx)
    case 'find_areas':
      return findAreas(args, ctx)
    case 'get_production_summary':
      return getProductionSummary(args, ctx)
    case 'get_materials':
      return getMaterials(args, ctx)
    case 'get_deliveries':
      return getDeliveries(args, ctx)
    case 'get_purchase_orders':
      return getPurchaseOrders(args, ctx)
    case 'create_job':
      return createNewJob(args, ctx)
    case 'delete_job':
      return deleteJob(args, ctx)
    case 'bulk_create_structure':
      return bulkCreateStructure(args, ctx)
    case 'get_workers':
      return getWorkers(args, ctx)
    case 'get_production_logs':
      return getProductionLogs(args, ctx)
    case 'get_crew_checkins':
      return getCrewCheckins(args, ctx)
    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// ─── Tool Implementations ────────────────────────────────────────────────────────

async function getJobs(args: any, ctx: ToolContext) {
  let query = ctx.supabase
    .from('jobs')
    .select('*')
    .ilike('status', 'active')
    .order('name')

  query = applyJobFilter(query, ctx, 'id')

  if (args.job_name_filter) {
    const words = args.job_name_filter.trim().split(/\s+/)
    for (const word of words) {
      query = query.ilike('name', `%${word}%`)
    }
  }

  const { data: jobs, error } = await query
  if (error) return { error: `get_jobs failed: ${error.message} (${error.code})` }
  if (!jobs?.length) return { jobs: [], message: 'No active jobs found.' }

  const results = []
  for (const job of jobs) {
    const { data: floors } = await ctx.supabase
      .from('floors')
      .select('id')
      .eq('job_id', job.id)

    let avgProgress = 0
    if (floors?.length) {
      const floorIds = floors.map((f: any) => f.id)
      const { data: units } = await ctx.supabase
        .from('units')
        .select('id')
        .in('floor_id', floorIds)

      if (units?.length) {
        const unitIds = units.map((u: any) => u.id)
        const { data: areas } = await ctx.supabase
          .from('areas')
          .select('progress')
          .in('unit_id', unitIds)

        if (areas?.length) {
          const total = areas.reduce(
            (sum: number, a: any) => sum + (a.progress || 0),
            0
          )
          avgProgress = Math.round(total / areas.length)
        }
      }
    }
    results.push({ ...job, progress: avgProgress })
  }

  return { jobs: results }
}

async function getJobDetails(args: any, ctx: ToolContext) {
  const deny = accessCheck(ctx, args.job_id)
  if (deny) return { error: deny }

  const { data: job, error: jobErr } = await ctx.supabase
    .from('jobs')
    .select('*')
    .eq('id', args.job_id)
    .single()
  if (jobErr) return { error: `get_job_details failed: ${jobErr.message}` }
  if (!job) return { error: 'Job not found.' }

  const { data: floors } = await ctx.supabase
    .from('floors')
    .select('id, name')
    .eq('job_id', args.job_id)
    .order('name')

  const floorDetails = []
  for (const floor of floors || []) {
    const { data: units } = await ctx.supabase
      .from('units')
      .select('id, name, type')
      .eq('floor_id', floor.id)
      .order('name')

    const unitDetails = []
    for (const unit of units || []) {
      const { data: areas } = await ctx.supabase
        .from('areas')
        .select('id, name, progress, status, type')
        .eq('unit_id', unit.id)
        .order('name')
      unitDetails.push({ ...unit, areas: areas || [] })
    }
    floorDetails.push({ ...floor, units: unitDetails })
  }

  return { job, floors: floorDetails }
}

async function getIssues(args: any, ctx: ToolContext) {
  let query = ctx.supabase
    .from('job_issues')
    .select('id, job_id, type, priority, status, description, created_at')
    .eq('status', 'open')
    .order('priority', { ascending: false })
    .limit(20)

  if (args.job_id) {
    const deny = accessCheck(ctx, args.job_id)
    if (deny) return { error: deny }
    query = query.eq('job_id', args.job_id)
  } else {
    query = applyJobFilter(query, ctx)
  }

  if (args.priority) {
    query = query.eq('priority', args.priority)
  }

  const { data: issues, error } = await query
  if (error) return { error: error.message }

  if (issues?.length) {
    const jobIds = [...new Set(issues.map((i: any) => i.job_id))]
    const { data: jobs } = await ctx.supabase
      .from('jobs')
      .select('id, name')
      .in('id', jobIds)
    const jobMap: Record<string, string> = {}
    jobs?.forEach((j: any) => {
      jobMap[j.id] = j.name
    })
    return {
      issues: issues.map((i: any) => ({
        ...i,
        job_name: jobMap[i.job_id] || 'Unknown',
      })),
    }
  }

  return { issues: [], message: 'No open issues found.' }
}

async function createIssue(args: any, ctx: ToolContext) {
  const deny = accessCheck(ctx, args.job_id)
  if (deny) return { error: deny }

  const now = new Date().toISOString()
  const { error } = await ctx.supabase.from('job_issues').insert({
    id: crypto.randomUUID(),
    job_id: args.job_id,
    type: args.type || 'General',
    priority: args.priority || 'Medium',
    status: 'open',
    description: args.description,
    photo_url: args.photo_url || null,
    created_by: ctx.profile.id,
    created_at: now,
    updated_at: now,
  })
  if (error) return { error: error.message }

  const { data: job } = await ctx.supabase
    .from('jobs')
    .select('name')
    .eq('id', args.job_id)
    .single()
  return {
    success: true,
    job_name: job?.name,
    type: args.type || 'General',
    priority: args.priority || 'Medium',
  }
}

async function getManpower(args: any, ctx: ToolContext) {
  let query = ctx.supabase
    .from('crew_checkins')
    .select('job_id, worker_id, check_in, role')

  if (args.job_id) {
    const deny = accessCheck(ctx, args.job_id)
    if (deny) return { error: deny }
    query = query.eq('job_id', args.job_id)
  } else {
    query = applyJobFilter(query, ctx)
  }

  const { data: allCheckins, error } = await query
  if (error) return { error: error.message }

  const checkins = allCheckins?.filter((c: any) => !c.check_out) || []
  if (!checkins.length)
    return { active_workers: 0, message: 'No active crew in the field.' }

  const jobIds = [...new Set(checkins.map((c: any) => c.job_id))]
  const { data: jobs } = await ctx.supabase
    .from('jobs')
    .select('id, name')
    .in('id', jobIds)
  const jobMap: Record<string, string> = {}
  jobs?.forEach((j: any) => {
    jobMap[j.id] = j.name
  })

  const byJob: Record<string, { name: string; count: number }> = {}
  for (const c of checkins) {
    if (!byJob[c.job_id])
      byJob[c.job_id] = { name: jobMap[c.job_id] || c.job_id, count: 0 }
    byJob[c.job_id].count++
  }

  return { active_workers: checkins.length, by_job: Object.values(byJob) }
}

async function getChecklist(args: any, ctx: ToolContext) {
  const { data: area } = await ctx.supabase
    .from('areas')
    .select('id, name, unit_id, progress')
    .eq('id', args.area_id)
    .single()
  if (!area) return { error: 'Area not found.' }

  const { data: unit } = await ctx.supabase
    .from('units')
    .select('id, name, floor_id')
    .eq('id', area.unit_id)
    .single()
  if (!unit) return { error: 'Unit not found.' }

  const { data: floor } = await ctx.supabase
    .from('floors')
    .select('id, name, job_id')
    .eq('id', unit.floor_id)
    .single()
  if (!floor) return { error: 'Floor not found.' }

  const deny = accessCheck(ctx, floor.job_id)
  if (deny) return { error: deny }

  const { data: items, error } = await ctx.supabase
    .from('checklist_items')
    .select('id, text, status, completed, position')
    .eq('area_id', args.area_id)
    .order('position')
  if (error) return { error: error.message }

  return {
    area: { id: area.id, name: area.name, progress: area.progress },
    unit_name: unit.name,
    floor_name: floor.name,
    items: items || [],
  }
}

async function updateChecklistItems(args: any, ctx: ToolContext) {
  if (!args.items?.length) return { error: 'No items provided.' }

  const { data: firstItem } = await ctx.supabase
    .from('checklist_items')
    .select('area_id')
    .eq('id', args.items[0].item_id)
    .single()
  if (!firstItem) return { error: 'Checklist item not found.' }

  const areaId = firstItem.area_id

  const { data: area } = await ctx.supabase
    .from('areas')
    .select('unit_id')
    .eq('id', areaId)
    .single()
  if (!area) return { error: 'Area not found.' }

  const { data: unit } = await ctx.supabase
    .from('units')
    .select('floor_id')
    .eq('id', area.unit_id)
    .single()
  if (!unit) return { error: 'Unit not found.' }

  const { data: floor } = await ctx.supabase
    .from('floors')
    .select('job_id')
    .eq('id', unit.floor_id)
    .single()
  if (!floor) return { error: 'Floor not found.' }

  const deny = accessCheck(ctx, floor.job_id)
  if (deny) return { error: deny }

  let updated = 0
  for (const item of args.items) {
    const completed = item.status === 'COMPLETED' ? 1 : 0
    const { error } = await ctx.supabase
      .from('checklist_items')
      .update({ status: item.status, completed })
      .eq('id', item.item_id)
    if (!error) updated++
  }

  const { data: allItems } = await ctx.supabase
    .from('checklist_items')
    .select('status, completed')
    .eq('area_id', areaId)

  const validItems = (allItems || []).filter((i: any) => i.status !== 'NA')
  const completedCount = validItems.filter(
    (i: any) => i.status === 'COMPLETED' || i.completed === 1
  ).length
  const progress =
    validItems.length > 0
      ? Math.round((completedCount / validItems.length) * 100)
      : 0

  await ctx.supabase.from('areas').update({ progress }).eq('id', areaId)

  return { updated, total_items: allItems?.length || 0, new_progress: progress }
}

async function findAreas(args: any, ctx: ToolContext) {
  const deny = accessCheck(ctx, args.job_id)
  if (deny) return { error: deny }

  const { data: floors } = await ctx.supabase
    .from('floors')
    .select('id, name')
    .eq('job_id', args.job_id)
  if (!floors?.length)
    return { areas: [], message: 'No floors found for this job.' }

  const floorIds = floors.map((f: any) => f.id)
  const floorMap: Record<string, string> = {}
  floors.forEach((f: any) => {
    floorMap[f.id] = f.name
  })

  const { data: units } = await ctx.supabase
    .from('units')
    .select('id, name, floor_id')
    .in('floor_id', floorIds)
  if (!units?.length) return { areas: [], message: 'No units found.' }

  const unitIds = units.map((u: any) => u.id)
  const unitMap: Record<string, { name: string; floor_id: string }> = {}
  units.forEach((u: any) => {
    unitMap[u.id] = { name: u.name, floor_id: u.floor_id }
  })

  let areaQuery = ctx.supabase
    .from('areas')
    .select('id, name, unit_id, progress, status, type')
    .in('unit_id', unitIds)

  if (args.area_name) {
    areaQuery = areaQuery.ilike('name', `%${args.area_name}%`)
  }

  const { data: areas, error } = await areaQuery.order('name').limit(30)
  if (error) return { error: error.message }

  return {
    areas: (areas || []).map((a: any) => {
      const unit = unitMap[a.unit_id]
      return {
        ...a,
        unit_name: unit?.name,
        floor_name: unit ? floorMap[unit.floor_id] : undefined,
      }
    }),
  }
}

async function getProductionSummary(args: any, ctx: ToolContext) {
  let query = ctx.supabase
    .from('production_logs')
    .select('job_id, job_name, reg_hours, ot_hours, sqft_installed, worker_id')
    .eq('date', args.date)

  if (args.job_id) {
    const deny = accessCheck(ctx, args.job_id)
    if (deny) return { error: deny }
    query = query.eq('job_id', args.job_id)
  } else {
    query = applyJobFilter(query, ctx)
  }

  const { data: logs, error } = await query
  if (error) return { error: error.message }
  if (!logs?.length)
    return { date: args.date, message: 'No production data for this date.' }

  let totalRegHours = 0,
    totalOtHours = 0,
    totalSqft = 0
  const workers = new Set<string>()
  const byJob: Record<
    string,
    { name: string; reg_hours: number; ot_hours: number; sqft: number }
  > = {}

  for (const log of logs) {
    const reg = parseFloat(log.reg_hours) || 0
    const ot = parseFloat(log.ot_hours) || 0
    const sqft = log.sqft_installed || 0
    totalRegHours += reg
    totalOtHours += ot
    totalSqft += sqft
    if (log.worker_id) workers.add(log.worker_id)

    const jid = log.job_id
    if (!byJob[jid])
      byJob[jid] = {
        name: log.job_name || jid,
        reg_hours: 0,
        ot_hours: 0,
        sqft: 0,
      }
    byJob[jid].reg_hours += reg
    byJob[jid].ot_hours += ot
    byJob[jid].sqft += sqft
  }

  return {
    date: args.date,
    total_workers: workers.size,
    total_reg_hours: Math.round(totalRegHours * 10) / 10,
    total_ot_hours: Math.round(totalOtHours * 10) / 10,
    total_sqft: Math.round(totalSqft * 10) / 10,
    by_job: Object.values(byJob),
  }
}

// ─── Warehouse Tools ─────────────────────────────────────────────────────────────

async function getMaterials(args: any, ctx: ToolContext) {
  const deny = accessCheck(ctx, args.job_id)
  if (deny) return { error: deny }

  let query = ctx.supabase
    .from('project_materials')
    .select(
      'id, product_name, product_code, category, supplier, unit, net_qty, budget_qty, ordered_qty, in_warehouse_qty, in_transit, received_at_job, qty_damaged, qty_missing, expected_date'
    )
    .eq('job_id', args.job_id)
    .order('category')
    .order('product_name')
    .limit(50)

  if (args.category) {
    query = query.ilike('category', `%${args.category}%`)
  }

  const { data: materials, error } = await query
  if (error) return { error: error.message }
  if (!materials?.length)
    return { materials: [], message: 'No materials found for this job.' }

  return { materials }
}

async function getDeliveries(args: any, ctx: ToolContext) {
  const deny = accessCheck(ctx, args.job_id)
  if (deny) return { error: deny }

  let query = ctx.supabase
    .from('delivery_tickets')
    .select(
      'id, ticket_number, status, destination, requested_date, due_date, due_time, items, notes, assigned_to, created_at'
    )
    .eq('job_id', args.job_id)
    .order('due_date', { ascending: false })
    .limit(20)

  if (args.status) {
    query = query.eq('status', args.status)
  }

  const { data: tickets, error } = await query
  if (error) return { error: error.message }
  if (!tickets?.length)
    return { deliveries: [], message: 'No delivery tickets found.' }

  const deliveries = tickets.map((t: any) => {
    let parsedItems = []
    try {
      parsedItems = typeof t.items === 'string' ? JSON.parse(t.items) : t.items || []
    } catch {
      parsedItems = []
    }
    return { ...t, items: parsedItems }
  })

  return { deliveries }
}

async function getPurchaseOrders(args: any, ctx: ToolContext) {
  const deny = accessCheck(ctx, args.job_id)
  if (deny) return { error: deny }

  let query = ctx.supabase
    .from('purchase_orders')
    .select(
      'id, po_number, vendor, status, order_date, expected_date, total_amount, notes, created_at'
    )
    .eq('job_id', args.job_id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (args.status) {
    query = query.eq('status', args.status)
  }

  const { data: orders, error } = await query
  if (error) return { error: error.message }
  if (!orders?.length)
    return { purchase_orders: [], message: 'No purchase orders found.' }

  const poIds = orders.map((o: any) => o.id)
  const { data: items } = await ctx.supabase
    .from('po_items')
    .select('po_id, material_id, quantity_ordered, received_qty, item_cost')
    .in('po_id', poIds)

  const materialIds = [
    ...new Set((items || []).map((i: any) => i.material_id).filter(Boolean)),
  ]
  let materialMap: Record<string, string> = {}
  if (materialIds.length) {
    const { data: mats } = await ctx.supabase
      .from('project_materials')
      .select('id, product_name')
      .in('id', materialIds)
    mats?.forEach((m: any) => {
      materialMap[m.id] = m.product_name
    })
  }

  const result = orders.map((o: any) => ({
    ...o,
    items: (items || [])
      .filter((i: any) => i.po_id === o.id)
      .map((i: any) => ({
        material_name: materialMap[i.material_id] || 'Unknown',
        quantity_ordered: i.quantity_ordered,
        received_qty: i.received_qty,
        item_cost: i.item_cost,
      })),
  }))

  return { purchase_orders: result }
}

// ─── Job Creation Tools ──────────────────────────────────────────────────────────

async function createNewJob(args: any, ctx: ToolContext) {
  if (ctx.profile.role !== 'admin') {
    return { error: 'Only admins can create jobs.' }
  }

  if (!args.name?.trim()) return { error: 'Job name is required.' }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  const { error } = await ctx.supabase.from('jobs').insert({
    id,
    name: args.name.trim(),
    address: args.address || null,
    general_contractor: args.general_contractor || null,
    status: 'active',
    created_at: now,
  })

  if (error) return { error: `Failed to create job: ${error.message}` }

  return { success: true, job_id: id, name: args.name.trim() }
}

async function bulkCreateStructure(args: any, ctx: ToolContext) {
  if (ctx.profile.role !== 'admin') {
    return { error: 'Only admins can create job structures.' }
  }

  if (!args.job_id) return { error: 'job_id is required.' }
  if (!args.floors?.length) return { error: 'No floors provided.' }
  if (args.floors.length > 10) {
    return { error: 'Max 10 floors per call. Call again for more.' }
  }

  const { data: job } = await ctx.supabase
    .from('jobs')
    .select('id, name')
    .eq('id', args.job_id)
    .single()
  if (!job) return { error: 'Job not found.' }

  // If floor_id is provided, validate it exists
  let existingFloorId: string | null = null
  if (args.floor_id) {
    const { data: existingFloor } = await ctx.supabase
      .from('floors')
      .select('id, name')
      .eq('id', args.floor_id)
      .single()
    if (!existingFloor) return { error: 'Floor not found. Check the floor_id.' }
    existingFloorId = existingFloor.id
  }

  let floorsCreated = 0
  let unitsCreated = 0
  let areasCreated = 0
  let checklistItemsCreated = 0

  for (const floor of args.floors) {
    let floorId: string

    if (existingFloorId) {
      // Use existing floor — don't create a new one
      floorId = existingFloorId
    } else {
      // Create new floor
      floorId = crypto.randomUUID()
      const { error: floorErr } = await ctx.supabase.from('floors').insert({
        id: floorId,
        job_id: args.job_id,
        name: floor.name,
        created_at: new Date().toISOString(),
      })
      if (floorErr) {
        console.error(`[Bulk] Floor insert error:`, floorErr)
        continue
      }
      floorsCreated++
    }

    if (!floor.units?.length) continue

    for (const unit of floor.units) {
      const unitId = crypto.randomUUID()
      const { error: unitErr } = await ctx.supabase.from('units').insert({
        id: unitId,
        floor_id: floorId,
        name: unit.name,
        description: unit.description || '',
        type: 'production',
        created_at: new Date().toISOString(),
      })
      if (unitErr) {
        console.error(`[Bulk] Unit insert error:`, unitErr)
        continue
      }
      unitsCreated++

      if (!unit.areas?.length) continue

      for (const areaEntry of unit.areas) {
        // Support both string (legacy) and object { name, description } formats
        const areaName = typeof areaEntry === 'string' ? areaEntry : areaEntry.name
        const areaDescription = typeof areaEntry === 'string' ? '' : (areaEntry.description || '')

        const areaId = crypto.randomUUID()
        const { error: areaErr } = await ctx.supabase.from('areas').insert({
          id: areaId,
          unit_id: unitId,
          name: areaName,
          description: areaDescription,
          type: 'production',
          status: 'NOT_STARTED',
          progress: 0,
          created_at: new Date().toISOString(),
        })
        if (areaErr) {
          console.error(`[Bulk] Area insert error:`, areaErr)
          continue
        }
        areasCreated++

        const preset = getPresetForArea(areaName)
        if (preset.length > 0) {
          const baseTime = Date.now()
          const items = preset.map((text, index) => ({
            area_id: areaId,
            text,
            completed: 0,
            status: 'NOT_STARTED',
            position: index,
            created_at: new Date(baseTime + index * 10).toISOString(),
          }))

          const { error: itemsErr } = await ctx.supabase
            .from('checklist_items')
            .insert(items)
          if (!itemsErr) {
            checklistItemsCreated += items.length
          } else {
            console.error(`[Bulk] Checklist insert error:`, itemsErr)
          }
        }
      }
    }
  }

  return {
    success: true,
    job_name: job.name,
    floors_created: floorsCreated,
    units_created: unitsCreated,
    areas_created: areasCreated,
    checklist_items_created: checklistItemsCreated,
  }
}

// ─── Job Deletion (cascade) ─────────────────────────────────────────────────────

async function deleteJob(args: any, ctx: ToolContext) {
  if (ctx.profile.role !== 'admin') {
    return { error: 'Only admins can delete jobs.' }
  }

  if (!args.job_id) return { error: 'job_id is required.' }

  const { data: job } = await ctx.supabase
    .from('jobs')
    .select('id, name')
    .eq('id', args.job_id)
    .single()
  if (!job) return { error: 'Job not found.' }

  const { data: floors } = await ctx.supabase
    .from('floors')
    .select('id')
    .eq('job_id', args.job_id)

  const floorIds = (floors || []).map((f: any) => f.id)

  let unitsDeleted = 0
  let areasDeleted = 0
  let checklistDeleted = 0

  if (floorIds.length > 0) {
    const { data: units } = await ctx.supabase
      .from('units')
      .select('id')
      .in('floor_id', floorIds)

    const unitIds = (units || []).map((u: any) => u.id)

    if (unitIds.length > 0) {
      const { data: areas } = await ctx.supabase
        .from('areas')
        .select('id')
        .in('unit_id', unitIds)

      const areaIds = (areas || []).map((a: any) => a.id)

      if (areaIds.length > 0) {
        const { count: ciCount } = await ctx.supabase
          .from('checklist_items')
          .delete({ count: 'exact' })
          .in('area_id', areaIds)
        checklistDeleted = ciCount || 0

        await ctx.supabase
          .from('area_photos')
          .delete()
          .in('area_id', areaIds)

        await ctx.supabase
          .from('areas')
          .delete()
          .in('unit_id', unitIds)
        areasDeleted = areaIds.length
      }

      await ctx.supabase
        .from('units')
        .delete()
        .in('floor_id', floorIds)
      unitsDeleted = unitIds.length
    }

    await ctx.supabase
      .from('floors')
      .delete()
      .eq('job_id', args.job_id)
  }

  await ctx.supabase.from('job_issues').delete().eq('job_id', args.job_id)
  await ctx.supabase.from('project_materials').delete().eq('job_id', args.job_id)
  await ctx.supabase.from('delivery_tickets').delete().eq('job_id', args.job_id)
  await ctx.supabase.from('purchase_orders').delete().eq('job_id', args.job_id)

  const { error: jobErr } = await ctx.supabase
    .from('jobs')
    .delete()
    .eq('id', args.job_id)

  if (jobErr) return { error: `Failed to delete job: ${jobErr.message}` }

  return {
    success: true,
    deleted_job: job.name,
    floors_deleted: floorIds.length,
    units_deleted: unitsDeleted,
    areas_deleted: areasDeleted,
    checklist_items_deleted: checklistDeleted,
  }
}

// ─── Workers ────────────────────────────────────────────────────────────────────

async function getWorkers(args: any, ctx: ToolContext) {
  let query = ctx.supabase
    .from('workers')
    .select('id, name, role, status, phone, email, assigned_job_ids')
    .order('name')

  if (args.status) {
    query = query.eq('status', args.status)
  }

  if (args.role_filter) {
    query = query.ilike('role', `%${args.role_filter}%`)
  }

  const { data, error } = await query

  if (error) return { error: error.message }
  if (!data?.length) return { workers: [], message: 'No workers found' }

  let workers = data

  // Filter by job assignment if requested
  if (args.job_id) {
    workers = workers.filter((w: any) => {
      try {
        const jobIds = typeof w.assigned_job_ids === 'string'
          ? JSON.parse(w.assigned_job_ids)
          : w.assigned_job_ids || []
        return Array.isArray(jobIds) && jobIds.includes(args.job_id)
      } catch {
        return false
      }
    })
  }

  // Resolve job names for assigned_job_ids
  const allJobIds = new Set<string>()
  for (const w of workers) {
    try {
      const ids = typeof w.assigned_job_ids === 'string'
        ? JSON.parse(w.assigned_job_ids)
        : w.assigned_job_ids || []
      if (Array.isArray(ids)) ids.forEach((id: string) => allJobIds.add(id))
    } catch { /* ignore */ }
  }

  let jobMap: Record<string, string> = {}
  if (allJobIds.size > 0) {
    const { data: jobs } = await ctx.supabase
      .from('jobs')
      .select('id, name')
      .in('id', [...allJobIds])
    if (jobs) {
      jobMap = Object.fromEntries(jobs.map((j: any) => [j.id, j.name]))
    }
  }

  return {
    count: workers.length,
    workers: workers.map((w: any) => {
      let assignedJobs: string[] = []
      try {
        const ids = typeof w.assigned_job_ids === 'string'
          ? JSON.parse(w.assigned_job_ids)
          : w.assigned_job_ids || []
        if (Array.isArray(ids)) {
          assignedJobs = ids.map((id: string) => jobMap[id] || 'Unknown')
        }
      } catch { /* ignore */ }

      return {
        name: w.name,
        role: w.role,
        status: w.status,
        phone: w.phone || null,
        email: w.email || null,
        assigned_jobs: assignedJobs,
      }
    }),
  }
}

// ─── Production Logs ────────────────────────────────────────────────────────────

async function getProductionLogs(args: any, ctx: ToolContext) {
  let query = ctx.supabase
    .from('production_logs')
    .select('id, date, worker_id, job_id, job_name, pl_number, unit, reg_hours, ot_hours, ticket_number, is_jantile, is_ticket, notes')
    .gte('date', args.start_date)
    .lte('date', args.end_date)
    .order('date', { ascending: false })
    .limit(500)

  if (args.job_id) {
    query = query.eq('job_id', args.job_id)
  }

  if (args.worker_id) {
    query = query.eq('worker_id', args.worker_id)
  }

  // Apply job access filter
  query = applyJobFilter(query, ctx)

  const { data, error } = await query

  if (error) return { error: error.message }
  if (!data?.length) return { logs: [], message: 'No production logs found for this period' }

  // Resolve worker names via separate query
  const workerIds = [...new Set(data.map((l: any) => l.worker_id).filter(Boolean))]
  let workerMap: Record<string, string> = {}
  if (workerIds.length > 0) {
    const { data: workers } = await ctx.supabase
      .from('workers')
      .select('id, name')
      .in('id', workerIds)
    if (workers) {
      workerMap = Object.fromEntries(workers.map((w: any) => [w.id, w.name]))
    }
  }

  // Summarize
  let totalRegHours = 0
  let totalOtHours = 0
  const byWorker: Record<string, { name: string; reg: number; ot: number; dates: Set<string> }> = {}

  for (const log of data) {
    const reg = parseFloat(log.reg_hours) || 0
    const ot = parseFloat(log.ot_hours) || 0
    totalRegHours += reg
    totalOtHours += ot

    const workerName = workerMap[log.worker_id] || 'Unknown'
    if (!byWorker[workerName]) {
      byWorker[workerName] = { name: workerName, reg: 0, ot: 0, dates: new Set() }
    }
    byWorker[workerName].reg += reg
    byWorker[workerName].ot += ot
    if (log.date) byWorker[workerName].dates.add(log.date)
  }

  return {
    period: `${args.start_date} to ${args.end_date}`,
    total_entries: data.length,
    total_regular_hours: Math.round(totalRegHours * 100) / 100,
    total_overtime_hours: Math.round(totalOtHours * 100) / 100,
    total_hours: Math.round((totalRegHours + totalOtHours) * 100) / 100,
    by_worker: Object.values(byWorker).map(w => ({
      name: w.name,
      regular_hours: Math.round(w.reg * 100) / 100,
      overtime_hours: Math.round(w.ot * 100) / 100,
      total_hours: Math.round((w.reg + w.ot) * 100) / 100,
      days_worked: w.dates.size,
    })).sort((a, b) => b.total_hours - a.total_hours),
  }
}

// ─── Crew Check-ins ─────────────────────────────────────────────────────────────

async function getCrewCheckins(args: any, ctx: ToolContext) {
  let query = ctx.supabase
    .from('crew_checkins')
    .select('id, worker_id, job_id, check_in, check_out')
    .gte('check_in', `${args.date}T00:00:00`)
    .lt('check_in', `${args.date}T23:59:59`)
    .order('check_in', { ascending: false })

  if (args.job_id) {
    query = query.eq('job_id', args.job_id)
  }

  query = applyJobFilter(query, ctx)

  const { data, error } = await query

  if (error) return { error: error.message }
  if (!data?.length) return { checkins: [], message: 'No check-ins found for this date' }

  // Resolve worker and job names via separate queries
  const workerIds = [...new Set(data.map((c: any) => c.worker_id).filter(Boolean))]
  const jobIds = [...new Set(data.map((c: any) => c.job_id).filter(Boolean))]

  let workerMap: Record<string, string> = {}
  let jobMap: Record<string, string> = {}

  if (workerIds.length > 0) {
    const { data: workers } = await ctx.supabase
      .from('workers')
      .select('id, name')
      .in('id', workerIds)
    if (workers) {
      workerMap = Object.fromEntries(workers.map((w: any) => [w.id, w.name]))
    }
  }

  if (jobIds.length > 0) {
    const { data: jobs } = await ctx.supabase
      .from('jobs')
      .select('id, name')
      .in('id', jobIds)
    if (jobs) {
      jobMap = Object.fromEntries(jobs.map((j: any) => [j.id, j.name]))
    }
  }

  return {
    date: args.date,
    total_checkins: data.length,
    checkins: data.map((c: any) => {
      const checkIn = new Date(c.check_in)
      const checkOut = c.check_out ? new Date(c.check_out) : null
      const hoursWorked = checkOut
        ? Math.round(((checkOut.getTime() - checkIn.getTime()) / 3600000) * 100) / 100
        : null

      return {
        worker: workerMap[c.worker_id] || 'Unknown',
        job: jobMap[c.job_id] || 'Unknown',
        check_in: checkIn.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        check_out: checkOut
          ? checkOut.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : 'Still on site',
        hours_worked: hoursWorked,
      }
    }),
  }
}
