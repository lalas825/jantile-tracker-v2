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
]
