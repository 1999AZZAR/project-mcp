import { MemoryManager } from '../memory-manager.js';
import { SQLiteManager } from '../sqlite-manager.js';
import { getCompanionCatalog } from './companion-catalog.js';

export class ResourceHandlers {
  constructor(
    private memoryManager: MemoryManager,
    private sqliteManager: SQLiteManager
  ) {}

  async handleReadResource(uri: string): Promise<string> {
    try {
      if (uri === 'project-guardian://companions/catalog') {
        return JSON.stringify({ companions: getCompanionCatalog() });
      }

      // Template resources
      if (uri.startsWith('project-guardian://templates/')) {
        return await this.handleTemplateResource(uri);
      }

      // Status resources
      if (uri.startsWith('project-guardian://status/')) {
        return await this.handleStatusResource(uri);
      }

      // Cache resources
      if (uri.startsWith('project-guardian://cache/')) {
        return await this.handleCacheResource(uri);
      }

      // Metrics resources
      if (uri.startsWith('project-guardian://metrics/')) {
        return await this.handleMetricsResource(uri);
      }

      throw new Error(`Unknown resource: ${uri}`);
    } catch (error) {
      throw new Error(`Resource read failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleTemplateResource(uri: string): Promise<string> {
    switch (uri) {
      case 'project-guardian://templates/entity-types':
        return this.generateEntityTypesTemplate();

      case 'project-guardian://templates/relationship-types':
        return this.generateRelationshipTypesTemplate();

      case 'project-guardian://templates/project-workflows':
        return this.generateProjectWorkflowsTemplate();

      case 'project-guardian://templates/best-practices':
        return this.generateBestPracticesTemplate();

      default:
        throw new Error(`Unknown template resource: ${uri}`);
    }
  }

  private async handleStatusResource(uri: string): Promise<string> {
    switch (uri) {
      case 'project-guardian://status/current-graph':
        return await this.generateCurrentGraphStatus();

      case 'project-guardian://status/recent-changes':
        return await this.generateRecentChangesStatus();

      default:
        throw new Error(`Unknown status resource: ${uri}`);
    }
  }

  private async handleCacheResource(uri: string): Promise<string> {
    switch (uri) {
      case 'project-guardian://cache/recent-activities':
        return this.generateRecentActivitiesCache();

      case 'project-guardian://cache/workflow-templates':
        return this.generateWorkflowTemplatesCache();

      case 'project-guardian://cache/team-members':
        return this.generateTeamMembersCache();

      default:
        throw new Error(`Unknown cache resource: ${uri}`);
    }
  }

  private async handleMetricsResource(uri: string): Promise<string> {
    switch (uri) {
      case 'project-guardian://metrics/project-stats':
        return await this.generateProjectStats();

      default:
        throw new Error(`Unknown metrics resource: ${uri}`);
    }
  }

  private generateEntityTypesTemplate(): string {
    return JSON.stringify({
      entityTypes: {
        project: 'Top-level project container',
        task: 'Individual work items or deliverables',
        feature: 'Functional capabilities or user stories',
        bug: 'Issues or defects requiring resolution',
        person: 'Team members and stakeholders',
        resource: 'Tools, infrastructure, or external dependencies',
        milestone: 'Key project checkpoints or deadlines',
        risk: 'Potential issues that could impact the project',
        decision: 'Important choices made during project execution'
      },
      usage: 'Use these types when creating entities to maintain consistency'
    });
  }

  private generateRelationshipTypesTemplate(): string {
    return JSON.stringify({
      relationshipTypes: {
        depends_on: 'Task/feature requires another to be completed first',
        blocks: 'Entity prevents another from progressing',
        owns: 'Person/team is responsible for this entity',
        implements: 'Code/feature implements a requirement',
        relates_to: 'General relationship between entities',
        part_of: 'Entity is a component of a larger entity',
        precedes: 'Entity must come before another in sequence',
        supports: 'Entity provides support or enables another'
      },
      bidirectional: 'Most relationships are directional (A -> B)',
      examples: [
        { from: 'user_auth', to: 'web_app', type: 'part_of' },
        { from: 'api_development', to: 'user_auth', type: 'depends_on' }
      ]
    });
  }

  private generateProjectWorkflowsTemplate(): string {
    return JSON.stringify({
      workflows: {
        project_setup: ['create_entity (project)', 'create_entity (initial tasks)', 'create_relation (ownership)'],
        sprint_planning: ['read_graph', 'create_entity (sprint tasks)', 'create_relation (dependencies)'],
        progress_tracking: ['add_observation', 'search_nodes', 'open_node'],
        retrospective: ['read_graph', 'query_data (observations)', 'create_entity (improvements)']
      },
      best_practices: [
        'Always create entities before relationships',
        'Use consistent naming conventions',
        'Add observations for progress tracking',
        'Regularly review and update relationships'
      ]
    });
  }

  private generateBestPracticesTemplate(): string {
    return `# Project Guardian Best Practices

## Entity Management
- Use descriptive, unique names for entities
- Choose appropriate entity types from the standard list
- Add detailed observations when creating entities
- Keep entity names consistent and searchable

## Relationship Management
- Create relationships after entities are established
- Use directional relationships (A -> B) appropriately
- Avoid circular dependencies when possible
- Document complex relationship logic in observations

## Data Organization
- Group related entities with consistent naming patterns
- Use observations for progress updates and notes
- Regularly archive completed entities
- Maintain relationship accuracy over time

## Search and Navigation
- Use descriptive search terms for finding entities
- Leverage relationship navigation for impact analysis
- Keep observations current and relevant
- Use entity types for filtering and organization

## Performance Considerations
- Batch operations when possible
- Use specific queries rather than broad searches
- Regularly clean up unused entities
- Monitor relationship complexity`;
  }

  private async generateCurrentGraphStatus(): Promise<string> {
    try {
      const graph = await this.memoryManager.readGraph();
      return JSON.stringify({
        entities: graph.entities,
        relations: graph.relations,
        summary: {
          totalEntities: graph.entities.length,
          totalRelations: graph.relations.length,
          entityTypes: [...new Set(graph.entities.map(e => e.entityType))],
          relationTypes: [...new Set(graph.relations.map(r => r.relationType))]
        },
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      return JSON.stringify({
        error: 'Failed to read knowledge graph',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private generateRecentActivitiesCache(): string {
    return JSON.stringify({
      recentActivities: [
        { type: 'entity_created', entity: 'example', timestamp: new Date().toISOString() }
      ],
      note: 'Activity tracking implementation pending'
    });
  }

  private generateWorkflowTemplatesCache(): string {
    return JSON.stringify({
      templates: {
        agile_sprint: {
          steps: ['plan', 'develop', 'test', 'review', 'deploy'],
          entities: ['sprint', 'tasks', 'reviews'],
          relations: ['part_of', 'depends_on']
        },
        feature_development: {
          steps: ['design', 'implement', 'test', 'deploy'],
          entities: ['feature', 'components', 'tests'],
          relations: ['implements', 'depends_on']
        }
      }
    });
  }

  private async generateRecentChangesStatus(): Promise<string> {
    try {
      // Get recent entities and relations
      const recentEntities = await this.sqliteManager.queryData('memory', 'entities', {},
        10, 0, 'updated_at', 'DESC'
      );
      const recentRelations = await this.sqliteManager.queryData('memory', 'relations', {},
        10, 0, 'created_at', 'DESC'
      );

      return JSON.stringify({
        recentEntities: recentEntities.success ? recentEntities.data.rows : [],
        recentRelations: recentRelations.success ? recentRelations.data.rows : [],
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      return JSON.stringify({
        error: 'Failed to fetch recent changes',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private generateTeamMembersCache(): string {
    return JSON.stringify({
      teamMembers: [
        { name: 'example', role: 'developer', status: 'active' }
      ],
      note: 'Team management integration pending'
    });
  }

  private async generateProjectStats(): Promise<string> {
    try {
      // Get basic statistics
      const totalEntities = await this.sqliteManager.executeSql('memory',
        'SELECT COUNT(*) as count FROM entities'
      );
      const totalRelations = await this.sqliteManager.executeSql('memory',
        'SELECT COUNT(*) as count FROM relations'
      );

      // Get entity type distribution
      const entitiesByType = await this.sqliteManager.executeSql('memory',
        'SELECT entity_type, COUNT(*) as count FROM entities GROUP BY entity_type'
      );

      // Get relation type distribution
      const relationsByType = await this.sqliteManager.executeSql('memory',
        'SELECT relation_type, COUNT(*) as count FROM relations GROUP BY relation_type'
      );

      // Process results
      const entityTypeMap: Record<string, number> = {};
      if (entitiesByType.success && entitiesByType.data) {
        entitiesByType.data.rows.forEach((row: any) => {
          entityTypeMap[row.entity_type] = row.count;
        });
      }

      const relationTypeMap: Record<string, number> = {};
      if (relationsByType.success && relationsByType.data) {
        relationsByType.data.rows.forEach((row: any) => {
          relationTypeMap[row.relation_type] = row.count;
        });
      }

      // Calculate connectivity metrics
      const avgRelationsPerEntity = totalEntities.success && totalEntities.data &&
        totalEntities.data.rows[0]?.count > 0 && totalRelations.success && totalRelations.data
        ? (totalRelations.data.rows[0]?.count / totalEntities.data.rows[0]?.count).toFixed(2)
        : '0.00';

      return JSON.stringify({
        overview: {
          totalEntities: totalEntities.success ? totalEntities.data.rows[0]?.count || 0 : 0,
          totalRelations: totalRelations.success ? totalRelations.data.rows[0]?.count || 0 : 0,
          totalEntityTypes: Object.keys(entityTypeMap).length,
          totalRelationTypes: Object.keys(relationTypeMap).length,
          avgRelationsPerEntity: parseFloat(avgRelationsPerEntity),
        },
        entitiesByType: entityTypeMap,
        relationsByType: relationTypeMap,
        topEntityTypes: Object.entries(entityTypeMap)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5),
        topRelationTypes: Object.entries(relationTypeMap)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5),
        healthMetrics: {
          connectivityRatio: parseFloat(avgRelationsPerEntity),
          entityTypeDiversity: Object.keys(entityTypeMap).length,
          relationTypeDiversity: Object.keys(relationTypeMap).length,
          dataCompleteness: totalEntities.success && totalEntities.data.rows[0]?.count > 0 ? 'good' : 'empty',
        },
        lastUpdated: new Date().toISOString(),
        cacheNote: 'Real-time statistics calculated from the current knowledge graph state.'
      });
    } catch (error) {
      return JSON.stringify({
        error: `Failed to calculate project statistics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        overview: {
          totalEntities: 0,
          totalRelations: 0,
          totalEntityTypes: 0,
          totalRelationTypes: 0,
          avgRelationsPerEntity: 0,
        },
        entitiesByType: {},
        relationsByType: {},
        lastUpdated: new Date().toISOString(),
      });
    }
  }
}
