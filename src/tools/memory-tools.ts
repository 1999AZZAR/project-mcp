import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const memoryTools: Tool[] = [
  // Project Guardian Memory Tools (12 tools)
  {
    name: 'initialize_memory',
    description: 'Initialize the project memory system and database schema',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'create_entity',
    description: 'Create entity/entities in the project knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        entities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Entity name' },
              entityType: { type: 'string', description: 'Type (project, task, person, resource)' },
              observations: { type: 'array', items: { type: 'string' }, description: 'Notes about the entity' },
            },
            required: ['name', 'entityType', 'observations'],
          },
          minItems: 1,
          description: 'Array of entities to create (supports single or batch)',
        },
      },
      required: ['entities'],
    },
  },
  {
    name: 'create_relation',
    description: 'Create relation(s) between project entities',
    inputSchema: {
      type: 'object',
      properties: {
        relations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string', description: 'Source entity name' },
              to: { type: 'string', description: 'Target entity name' },
              relationType: { type: 'string', description: 'Relationship type (depends_on, blocks, owns, etc.)' },
            },
            required: ['from', 'to', 'relationType'],
          },
          minItems: 1,
          description: 'Array of relations to create (supports single or batch)',
        },
      },
      required: ['relations'],
    },
  },
  {
    name: 'add_observation',
    description: 'Add observation(s) to project entity/entities',
    inputSchema: {
      type: 'object',
      properties: {
        observations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              entityName: { type: 'string', description: 'Entity name' },
              contents: { type: 'array', items: { type: 'string' }, description: 'Observations to add' },
            },
            required: ['entityName', 'contents'],
          },
          minItems: 1,
          description: 'Array of observation updates (supports single or batch)',
        },
      },
      required: ['observations'],
    },
  },
  {
    name: 'delete_entity',
    description: 'Delete entity/entities and their relations from project memory',
    inputSchema: {
      type: 'object',
      properties: {
        entityNames: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          description: 'Names of entities to delete (supports single or batch)',
        },
      },
      required: ['entityNames'],
    },
  },
  {
    name: 'delete_observation',
    description: 'Remove specific observation(s) from entity/entities',
    inputSchema: {
      type: 'object',
      properties: {
        deletions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              entityName: { type: 'string', description: 'Entity name' },
              observations: { type: 'array', items: { type: 'string' }, description: 'Observations to remove' },
            },
            required: ['entityName', 'observations'],
          },
          minItems: 1,
          description: 'Array of observation deletions (supports single or batch)',
        },
      },
      required: ['deletions'],
    },
  },
  {
    name: 'delete_relation',
    description: 'Delete relation(s) between project entities',
    inputSchema: {
      type: 'object',
      properties: {
        relations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string', description: 'Source entity name' },
              to: { type: 'string', description: 'Target entity name' },
              relationType: { type: 'string', description: 'Relationship type to delete' },
            },
            required: ['from', 'to', 'relationType'],
          },
          minItems: 1,
          description: 'Array of relations to delete (supports single or batch)',
        },
      },
      required: ['relations'],
    },
  },
  {
    name: 'read_graph',
    description: 'Read the entire project knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'search_nodes',
    description: 'Search project entities and relations with hybrid RAG and progressive disclosure',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term for entities and relations' },
        limit: { type: 'number', description: 'Max items to return (1-100, default 20)' },
        mode: { type: 'string', enum: ['keyword', 'vector', 'hybrid'], description: 'Search mode (default keyword)' },
        detailLevel: { type: 'string', enum: ['compact', 'summary', 'full'], description: 'Progressive disclosure level (compact: token-saving IDs & previews, summary: recent observations, full: complete graph)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'open_node',
    description: 'Get detailed information about project entity/entities',
    inputSchema: {
      type: 'object',
      properties: {
        names: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          description: 'Entity names to retrieve (supports single or batch)',
        },
      },
      required: ['names'],
    },
  },
  {
    name: 'get_file_context',
    description: 'Get historical memory, recent modifications, linked tasks, and open bugs for a specific file path before editing or reading',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Relative or absolute file path to look up' },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'get_timeline',
    description: 'Get a chronological feed of recent observations and project activity',
    inputSchema: {
      type: 'object',
      properties: {
        since: { type: 'string', description: 'ISO date string or timestamp filter' },
        entityType: { type: 'string', description: 'Filter by entity type (task, bug, decision, file, project)' },
        limit: { type: 'number', description: 'Max events to return (1-100, default 20)' },
      },
    },
  },
];
