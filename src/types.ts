/* eslint-disable no-control-regex */
import { z } from 'zod';

// Database types
export const DatabaseTypeSchema = z.enum(['sqlite', 'postgresql', 'mysql', 'mongodb']);
type DatabaseType = z.infer<typeof DatabaseTypeSchema>;

// Database operations schemas
export const CreateDatabaseSchema = z.object({
  name: z.string().min(1).max(255),
  type: DatabaseTypeSchema.default('sqlite'),
  path: z.string().optional(), // For SQLite file path
});

export const ListDatabasesSchema = z.object({
  type: DatabaseTypeSchema.optional(),
});

export const DropDatabaseSchema = z.object({
  name: z.string().min(1),
  type: DatabaseTypeSchema.default('sqlite'),
});

// Table operations schemas
export const CreateTableSchema = z.object({
  database: z.string().min(1),
  name: z.string().min(1).max(255),
  schema: z.object({
    columns: z.array(z.object({
      name: z.string().min(1),
      type: z.string().min(1),
      constraints: z.array(z.string()).optional(),
      defaultValue: z.string().optional(),
    })),
    primaryKey: z.array(z.string()).optional(),
    indexes: z.array(z.object({
      name: z.string(),
      columns: z.array(z.string()),
      unique: z.boolean().optional(),
    })).optional(),
  }),
});

export const ListTablesSchema = z.object({
  database: z.string().min(1),
});

export const DescribeTableSchema = z.object({
  database: z.string().min(1),
  table: z.string().min(1),
});

export const DropTableSchema = z.object({
  database: z.string().min(1),
  table: z.string().min(1),
});

// CRUD operations schemas
export const InsertDataSchema = z.object({
  database: z.string().min(1),
  table: z.string().min(1),
  records: z.array(z.record(z.any())).min(1),
});

export const QueryDataSchema = z.object({
  database: z.string().min(1),
  table: z.string().min(1),
  conditions: z.record(z.any()).optional(),
  limit: z.number().min(1).max(10000).optional(),
  offset: z.number().min(0).optional(),
  orderBy: z.string().optional(),
  orderDirection: z.enum(['ASC', 'DESC']).optional(),
});

export const UpdateDataSchema = z.object({
  database: z.string().min(1),
  table: z.string().min(1),
  conditions: z.record(z.any()),
  updates: z.record(z.any()),
});

export const DeleteDataSchema = z.object({
  database: z.string().min(1),
  table: z.string().min(1),
  conditions: z.record(z.any()),
});

export const CountRecordsSchema = z.object({
  database: z.string().min(1),
  table: z.string().min(1),
  conditions: z.record(z.any()).optional(),
});

// Advanced operations schemas
export const ExecuteSqlSchema = z.object({
  database: z.string().min(1),
  query: z.string().min(1),
  parameters: z.array(z.any()).optional(),
});

export const ImportFromFileSchema = z.object({
  database: z.string().min(1),
  table: z.string().min(1),
  filePath: z.string().min(1),
  format: z.enum(['csv', 'json', 'sql']).default('csv'),
  options: z.object({
    delimiter: z.string().optional(),
    hasHeader: z.boolean().optional(),
    encoding: z.string().optional(),
  }).optional(),
});

export const ExportToFileSchema = z.object({
  database: z.string().min(1),
  table: z.string().min(1),
  filePath: z.string().min(1),
  format: z.enum(['csv', 'json', 'sql']).default('csv'),
  conditions: z.record(z.any()).optional(),
  options: z.object({
    delimiter: z.string().optional(),
    includeHeader: z.boolean().optional(),
    encoding: z.string().optional(),
  }).optional(),
});

export const BackupDatabaseSchema = z.object({
  database: z.string().min(1),
  backupPath: z.string().min(1),
});

export const RestoreDatabaseSchema = z.object({
  backupPath: z.string().min(1),
  databaseName: z.string().min(1),
});

// Memory Management schemas
// P1-C2: optional provenance refs for externally-sourced observation facts.
// Parallel to `contents` by index; absent entries stay bare strings.
export const ObservationProvenanceSchema = z.object({
  source: z.string().min(1),
  retrieved_at: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  freshness: z.enum(['fresh', 'cached', 'stale']).optional(),
});

export const CreateEntitySchema = z.object({  name: z.string().min(1),
  entityType: z.string().min(1),
  observations: z.array(z.string()).min(1),
});

export const CreateEntitiesSchema = z.object({
  entities: z.array(z.object({
    name: z.string().min(1),
    entityType: z.string().min(1),
    observations: z.array(z.string()),
    provenance: z.array(ObservationProvenanceSchema).optional(),
  })).min(1),
});

export const CreateRelationSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  relationType: z.string().min(1),
});

export const CreateRelationsSchema = z.object({
  relations: z.array(z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    relationType: z.string().min(1),
  })).min(1),
});

export const AddObservationSchema = z.object({
  entityName: z.string().min(1),
  contents: z.array(z.string()).min(1),
});

export const AddObservationsSchema = z.object({
  observations: z.array(z.object({
    entityName: z.string().min(1),
    contents: z.array(z.string()),
    provenance: z.array(ObservationProvenanceSchema).optional(),
  })).min(1),
});

export const DeleteEntitySchema = z.object({
  entityName: z.string().min(1),
});

export const DeleteEntitiesSchema = z.object({
  entityNames: z.array(z.string()).min(1),
});

export const DeleteObservationSchema = z.object({
  entityName: z.string().min(1),
  observations: z.array(z.string()).min(1),
});

export const DeleteObservationsSchema = z.object({
  deletions: z.array(z.object({
    entityName: z.string().min(1),
    observations: z.array(z.string()),
  })).min(1),
});

export const DeleteRelationSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  relationType: z.string().min(1),
});

export const DeleteRelationsSchema = z.object({
  relations: z.array(z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    relationType: z.string().min(1),
  })).min(1),
});

const EntityItemSchema = z.object({
  name: z.string().min(1),
  entityType: z.string().min(1),
  observations: z.array(z.string()),
  provenance: z.array(ObservationProvenanceSchema).optional(),
});

const RelationItemSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  relationType: z.string().min(1),
});

const ObservationItemSchema = z.object({
  entityName: z.string().min(1),
  contents: z.array(z.string()),
  provenance: z.array(ObservationProvenanceSchema).optional(),
});

const ObservationDeletionItemSchema = z.object({
  entityName: z.string().min(1),
  observations: z.array(z.string()),
});

export const MemoryEditSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create_entities'), entities: z.array(EntityItemSchema).min(1) }).strict(),
  z.object({ action: z.literal('create_relations'), relations: z.array(RelationItemSchema).min(1) }).strict(),
  z.object({ action: z.literal('add_observations'), observations: z.array(ObservationItemSchema).min(1) }).strict(),
  z.object({ action: z.literal('delete_entities'), entityNames: z.array(z.string().min(1)).min(1) }).strict(),
  z.object({ action: z.literal('delete_observations'), deletions: z.array(ObservationDeletionItemSchema).min(1) }).strict(),
  z.object({ action: z.literal('delete_relations'), relations: z.array(RelationItemSchema).min(1) }).strict(),
]);

export const SearchNodesSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(20).optional(),
  mode: z.enum(['keyword', 'vector', 'hybrid']).default('keyword').optional(),
  detailLevel: z.enum(['compact', 'summary', 'full']).default('full').optional(),
});

export const GetFileContextSchema = z.object({
  filePath: z.string().min(1),
});
export type GetFileContextInput = z.infer<typeof GetFileContextSchema>;

export const GetTimelineSchema = z.object({
  since: z.string().optional(),
  entityType: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20).optional(),
});
export type GetTimelineInput = z.infer<typeof GetTimelineSchema>;

export const ReadGraphStreamSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(1000).default(500).optional(),
});

export const ReadGraphSchema = z.object({
  database: z.enum(['project', 'central']).optional(),
  limit: z.number().int().min(1).max(10000).optional(),
  offset: z.number().int().min(0).optional(),
});

export const OpenNodeSchema = z.object({
  name: z.string().min(1),
});

export const OpenNodesSchema = z.object({
  names: z.array(z.string()).min(1),
});

export const SafeRevisionSchema = z.string().min(1).max(200).refine(
  value => !value.startsWith('-') && !/[\0-\x1f\x7f]/.test(value),
  'Revision must not start with - or contain control characters'
);
export const CacheKeySchema = z.string().min(1).max(512).regex(
  /^mema:[a-z]+:[A-Za-z0-9_:.-]+$/,
  'Key must match mema:<category>:<name>'
);

export const GetSessionContextSchema = z.object({
  limit: z.number().int().min(1).max(50).default(10),
}).strict();

export const AnalyzeGitChangesSchema = z.object({
  commit: SafeRevisionSchema.optional(),
  since: SafeRevisionSchema.default('1'),
  includeUntracked: z.boolean().default(true),
  maxFiles: z.number().int().min(1).max(500).default(100),
}).strict().refine(value => !(value.commit && value.since !== '1'), {
  message: 'commit and since are mutually exclusive',
});

export const InspectUntrustedTextSchema = z.object({
  text: z.string().refine(value => Buffer.byteLength(value, 'utf8') <= 256 * 1024, 'Text exceeds 256 KiB'),
}).strict();

export const ScanProjectSecretsSchema = z.object({
  path: z.string().max(500).default('.'),
  exclude: z.array(z.string().min(1).max(100).regex(/^[^/\\.][^/\\]*$/)).max(50).default([]),
  maxFindings: z.number().int().min(1).max(500).default(100),
}).strict();

export const ScanContainerImageSchema = z.object({
  image: z.string().min(1).max(255).refine(
    value => !value.startsWith('-') && !/[\s\0-\x1f\x7f]/.test(value),
    'Image reference contains unsafe characters'
  ),
  maxFindings: z.number().int().min(1).max(500).default(100),
}).strict();

export const CacheGetSchema = z.object({ key: CacheKeySchema }).strict();
export const CacheSetSchema = z.object({
  key: CacheKeySchema,
  value: z.string().refine(value => Buffer.byteLength(value, 'utf8') <= 512 * 1024, 'Value exceeds 512 KiB'),
  ttlSeconds: z.number().int().min(1).max(604800).optional(),
}).strict();
export const CacheDeleteSchema = z.object({ key: CacheKeySchema }).strict();
export const CacheScanSchema = z.object({
  pattern: z.string().min(1).max(512).regex(/^mema:/).default('mema:*'),
  cursor: z.number().int().min(0).default(0),
  count: z.number().int().min(1).max(200).default(100),
}).strict();

const CacheValueSchema = z.string().refine(
  value => Buffer.byteLength(value, 'utf8') <= 512 * 1024,
  'Value exceeds 512 KiB',
);

export const CacheToolSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('get'), key: CacheKeySchema }).strict(),
  z.object({
    action: z.literal('set'),
    key: CacheKeySchema,
    value: CacheValueSchema,
    ttlSeconds: z.number().int().min(1).max(604800).optional(),
  }).strict(),
  z.object({ action: z.literal('delete'), key: CacheKeySchema }).strict(),
  z.object({
    action: z.literal('scan'),
    pattern: z.string().min(1).max(512).regex(/^mema:/).default('mema:*'),
    cursor: z.number().int().min(0).default(0),
    count: z.number().int().min(1).max(200).default(100),
  }).strict(),
]);

export const SecurityScanSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('secrets'),
    path: z.string().max(500).default('.'),
    exclude: z.array(z.string().min(1).max(100).regex(/^[^/\\.][^/\\]*$/)).max(50).default([]),
    maxFindings: z.number().int().min(1).max(500).default(100),
  }).strict(),
  z.object({
    action: z.literal('container'),
    image: z.string().min(1).max(255).refine(
      value => !value.startsWith('-') && !/[\s\0-\x1f\x7f]/.test(value),
      'Image reference contains unsafe characters'
    ),
    maxFindings: z.number().int().min(1).max(500).default(100),
  }).strict(),
]);

export const UIServerSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start') }).strict(),
  z.object({ action: z.literal('stop') }).strict(),
]);

export const SetProjectRootSchema = z.object({
  path: z.string().min(1).max(4096),
}).strict();

export const SetupPreCommitSchema = z.object({}).strict();

export const SyncCentralMemorySchema = z.object({}).strict();

export type GetSessionContextInput = z.infer<typeof GetSessionContextSchema>;
export type AnalyzeGitChangesInput = z.infer<typeof AnalyzeGitChangesSchema>;
export type InspectUntrustedTextInput = z.infer<typeof InspectUntrustedTextSchema>;
export type ScanProjectSecretsInput = z.infer<typeof ScanProjectSecretsSchema>;
export type ScanContainerImageInput = z.infer<typeof ScanContainerImageSchema>;
export type CacheGetInput = z.infer<typeof CacheGetSchema>;
export type CacheSetInput = z.infer<typeof CacheSetSchema>;
export type CacheDeleteInput = z.infer<typeof CacheDeleteSchema>;
export type CacheScanInput = z.infer<typeof CacheScanSchema>;

// Response types
export interface DatabaseInfo {
  name: string;
  type: DatabaseType;
  path?: string;
  size?: number;
  createdAt: string;
  modifiedAt: string;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  rowCount: number;
  size: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  constraints: string[];
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  type: string;
}

export interface QueryResult {
  columns: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[];
  rowCount: number;
  executionTime: number;
}

export interface DatabaseOperationResult {
  success: boolean;
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  error?: string;
  executionTime?: number;
}

// Memory Management interfaces
export interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CompactEntity {
  name: string;
  entityType: string;
  observationCount: number;
  preview?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Relation {
  from: string;
  to: string;
  relationType: string;
  createdAt: string;
}

export interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}

export interface SearchResult {
  entities: Array<Entity | CompactEntity>;
  relations: Relation[];
  detailLevel?: 'compact' | 'summary' | 'full';
}

export interface FileContextResult {
  filePath: string;
  entityName: string;
  existsInMemory: boolean;
  entity?: Entity;
  recentObservations: string[];
  relations: Relation[];
  linkedTasks: string[];
  linkedBugs: string[];
}

export interface TimelineEntry {
  entityName: string;
  entityType: string;
  observation: string;
  timestamp: string;
}

export interface TimelineResult {
  entries: TimelineEntry[];
  total: number;
}

// Session bridge schemas (read-only harness session ingestion)
export const ListHarnessStoresSchema = z.object({});

const HarnessIdSchema = z.enum([
  'opencode',
  'kilocode',
  'zed',
  'delta',
  'antigravity',
  'cursor',
  'vscode',
  'codex',
]);

export const SyncHarnessSessionsSchema = z.object({
  harnesses: z.array(HarnessIdSchema).optional(),
  project: z.string().optional(),
  since: z.number().optional(),
  limit: z.number().min(1).max(500).optional(),
  dryRun: z.boolean().optional(),
  includeArchived: z.boolean().optional(),
});

export const HarnessSessionsSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list') }).strict(),
  z.object({
    action: z.literal('sync'),
    harnesses: z.array(HarnessIdSchema).optional(),
    project: z.string().optional(),
    since: z.number().optional(),
    limit: z.number().min(1).max(500).optional(),
    dryRun: z.boolean().optional(),
    includeArchived: z.boolean().optional(),
  }).strict(),
]);

export type SyncHarnessSessionsInput = z.infer<typeof SyncHarnessSessionsSchema>;
