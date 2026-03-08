export const toolDeclarations = [
  {
    name: 'get_jobs',
    description: 'Get active jobs with progress percentage. Admin sees all, others see assigned only.',
    parameters: {
      type: 'object',
      properties: {
        job_name_filter: {
          type: 'string',
          description: 'Optional partial job name to filter by',
        },
      },
    },
  },
  {
    name: 'get_job_details',
    description: 'Get detailed breakdown of a job: floors, units, areas with progress.',
    parameters: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'The job UUID' },
      },
      required: ['job_id'],
    },
  },
  {
    name: 'get_issues',
    description: 'Get open issues, optionally filtered by job or priority.',
    parameters: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'Optional job UUID filter' },
        priority: {
          type: 'string',
          enum: ['High', 'Medium', 'Low'],
          description: 'Optional priority filter',
        },
      },
    },
  },
  {
    name: 'create_issue',
    description: 'Create a new issue for a job.',
    parameters: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'The job UUID' },
        description: { type: 'string', description: 'Issue description' },
        type: {
          type: 'string',
          enum: ['General', 'Safety', 'Quality', 'Material', 'Equipment'],
          description: 'Issue type (default: General)',
        },
        priority: {
          type: 'string',
          enum: ['High', 'Medium', 'Low'],
          description: 'Priority (default: Medium)',
        },
        photo_url: { type: 'string', description: 'Optional photo URL' },
      },
      required: ['job_id', 'description'],
    },
  },
  {
    name: 'get_manpower',
    description: 'Get currently active crew checked in at job sites.',
    parameters: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'Optional job UUID filter' },
      },
    },
  },
  {
    name: 'get_checklist',
    description: 'Get checklist items for a specific area.',
    parameters: {
      type: 'object',
      properties: {
        area_id: { type: 'string', description: 'The area UUID' },
      },
      required: ['area_id'],
    },
  },
  {
    name: 'update_checklist_items',
    description:
      'Update status of checklist items and recalculate area progress.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              item_id: { type: 'string', description: 'Checklist item UUID' },
              status: {
                type: 'string',
                enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'NA'],
              },
            },
            required: ['item_id', 'status'],
          },
          description: 'Items to update',
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'find_areas',
    description:
      'Search areas by name within a job. Returns area with unit/floor info.',
    parameters: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'The job UUID' },
        area_name: { type: 'string', description: 'Partial area name search' },
      },
      required: ['job_id'],
    },
  },
  {
    name: 'get_production_summary',
    description: 'Get production summary (hours + sqft) for a date.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date YYYY-MM-DD' },
        job_id: { type: 'string', description: 'Optional job UUID filter' },
      },
      required: ['date'],
    },
  },
  {
    name: 'get_materials',
    description:
      'Get materials inventory for a job. Shows quantities: ordered, in warehouse, in transit, received at job.',
    parameters: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'The job UUID' },
        category: {
          type: 'string',
          description: 'Optional category filter (e.g. Tile, Grout, Trim)',
        },
      },
      required: ['job_id'],
    },
  },
  {
    name: 'get_deliveries',
    description:
      'Get delivery tickets for a job. Shows ticket number, status, destination, due date, and items.',
    parameters: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'The job UUID' },
        status: {
          type: 'string',
          enum: ['pending', 'scheduled', 'in_transit', 'delivered', 'cancelled'],
          description: 'Optional status filter',
        },
      },
      required: ['job_id'],
    },
  },
  {
    name: 'get_purchase_orders',
    description:
      'Get purchase orders for a job. Shows PO number, vendor, status, total amount, and items.',
    parameters: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'The job UUID' },
        status: {
          type: 'string',
          enum: ['draft', 'submitted', 'approved', 'ordered', 'received', 'cancelled'],
          description: 'Optional status filter',
        },
      },
      required: ['job_id'],
    },
  },
  {
    name: 'create_job',
    description:
      'Create a new job. Returns the job_id for use with bulk_create_structure. Admin only.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Job name (e.g. "Riverside Tower")' },
        address: { type: 'string', description: 'Job site address' },
        general_contractor: {
          type: 'string',
          description: 'General contractor name (optional)',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_job',
    description:
      'Delete a job and ALL its data (floors, units, areas, checklists, issues, materials). Admin only. IRREVERSIBLE.',
    parameters: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'The job UUID to delete' },
      },
      required: ['job_id'],
    },
  },
  {
    name: 'bulk_create_structure',
    description:
      'Bulk create units and areas for a job. Can create new floors OR add to an existing floor via floor_id. Each area auto-gets a checklist based on its name. Max 10 floors per call.',
    parameters: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'The job UUID' },
        floor_id: {
          type: 'string',
          description: 'Optional: existing floor UUID to add units to. If provided, the "floors" array should have exactly 1 entry (its name is ignored, the existing floor is used).',
        },
        floors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Floor name (e.g. "Floor 1"). Ignored if floor_id is provided.' },
              units: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      description: 'Unit name (e.g. "Unit 1A", "L1-F2")',
                    },
                    description: {
                      type: 'string',
                      description: 'Unit description (e.g. "BHS BOH Restroom", "North Wing")',
                    },
                    areas: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: {
                            type: 'string',
                            description: 'Area name — gets auto-checklist. Valid: Master Bathroom, Secondary Bathroom, Powder Room, Kitchen, Foyer, Laundry, Vestibule, Corridor, Restroom, Janitor Room, Locker Room',
                          },
                          description: {
                            type: 'string',
                            description: 'Area description/drawing page (e.g. "1S.2.141", "Room A-101")',
                          },
                        },
                        required: ['name'],
                      },
                      description: 'Areas to create in this unit',
                    },
                  },
                  required: ['name', 'areas'],
                },
              },
            },
            required: ['units'],
          },
          description: 'Floors to create (max 10 per call). If floor_id is provided, use 1 entry.',
        },
      },
      required: ['job_id', 'floors'],
    },
  },
  {
    name: 'get_workers',
    description:
      'Get crew roster. Shows name, role, status, phone, email, and assigned jobs.',
    parameters: {
      type: 'object',
      properties: {
        role_filter: {
          type: 'string',
          description: 'Optional role filter (e.g. Polisher, Foreman, Helper)',
        },
        status: {
          type: 'string',
          enum: ['Active', 'Inactive'],
          description: 'Optional status filter (default: all)',
        },
        job_id: {
          type: 'string',
          description: 'Optional job UUID — only workers assigned to this job',
        },
      },
    },
  },
  {
    name: 'get_production_logs',
    description:
      'Get production logs (polisher hours). Shows worker, job, unit, regular hours, overtime hours, date, and ticket info.',
    parameters: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date YYYY-MM-DD (required)',
        },
        end_date: {
          type: 'string',
          description: 'End date YYYY-MM-DD (required)',
        },
        job_id: {
          type: 'string',
          description: 'Optional job UUID filter',
        },
        worker_id: {
          type: 'string',
          description: 'Optional worker UUID filter',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_crew_checkins',
    description:
      'Get crew check-in/check-out records for attendance tracking. Shows worker, job, check-in time, check-out time, and hours worked.',
    parameters: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date YYYY-MM-DD (required)',
        },
        job_id: {
          type: 'string',
          description: 'Optional job UUID filter',
        },
      },
      required: ['date'],
    },
  },
]
