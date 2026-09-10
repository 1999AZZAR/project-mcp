import { execFileSync } from 'child_process';

export interface CompanionCatalogEntry {
  id: string;
  description: string;
  tools: string[];
  prerequisites: string[];
  availability: 'available' | 'optional' | 'unavailable';
}

function commandAvailable(command: string): boolean {
  try {
    execFileSync(command, ['--version'], { timeout: 2000, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function getCompanionCatalog(): CompanionCatalogEntry[] {
  return [
    { id: 'guardian-memory', description: 'Persistent project knowledge graph', tools: ['initialize_memory', 'create_entity', 'create_relation', 'add_observation', 'delete_entity', 'delete_observation', 'delete_relation', 'read_graph', 'search_nodes', 'open_node'], prerequisites: [], availability: 'available' },
    { id: 'guardian-session', description: 'Project session context restoration (incl. cross-harness session sync)', tools: ['get_session_context', 'list_harness_stores', 'sync_harness_sessions'], prerequisites: [], availability: 'available' },
    { id: 'guardian-tracker', description: 'Bounded Git change analysis', tools: ['analyze_git_changes'], prerequisites: ['git'], availability: commandAvailable('git') ? 'available' : 'unavailable' },
    { id: 'guardian-wall', description: 'Prompt-injection indicator detection', tools: ['inspect_untrusted_text'], prerequisites: [], availability: 'available' },
    { id: 'guardian-security', description: 'Secret and container vulnerability scanning', tools: ['scan_project_secrets', 'scan_container_image'], prerequisites: ['trivy for container scans'], availability: commandAvailable('trivy') ? 'available' : 'optional' },
    { id: 'guardian-cache', description: 'Optional Redis-backed temporary storage', tools: ['cache_get', 'cache_set', 'cache_delete', 'cache_scan'], prerequisites: ['REDIS_URL', 'Redis'], availability: process.env.REDIS_URL ? 'available' : 'optional' },
  ];
}
