/**
 * Strips <private>...</private> or <!-- private -->...<!-- /private --> sections.
 * Prevents sensitive tokens, keys, or personal notes from entering the knowledge graph or vector embeddings.
 */
export function sanitizePrivateContent(text: string): string {
  if (!text) return text;
  return text
    .replace(/<private>[\s\S]*?<\/private>/gi, '[PRIVATE]')
    .replace(/<!--\s*private\s*-->[\s\S]*?<!--\s*\/private\s*-->/gi, '[PRIVATE]');
}
