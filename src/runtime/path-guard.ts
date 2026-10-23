import { existsSync, realpathSync } from 'fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'path';

export class PathGuard {
  private readonly root: string;

  constructor(root: string) {
    this.root = realpathSync(root);
  }

  getRoot(): string {
    return this.root;
  }

  resolveExistingPath(input = '.'): string {
    if (input.includes('\0') || isAbsolute(input)) {
      throw new Error('Path must be workspace-relative');
    }
    const lexical = resolve(this.root, input);
    this.assertContained(lexical);
    if (!existsSync(lexical)) throw new Error(`Path does not exist: ${input}`);
    const actual = realpathSync(lexical);
    this.assertContained(actual);
    return actual;
  }

  resolveNewPath(input = '.'): string {
    if (input.includes('\0') || isAbsolute(input)) {
      throw new Error('Path must be workspace-relative');
    }
    const lexical = resolve(this.root, input);
    this.assertContained(lexical);
    if (existsSync(lexical)) return this.resolveExistingPath(input);
    const parent = dirname(lexical);
    if (!existsSync(parent)) throw new Error(`Parent directory does not exist: ${relative(this.root, parent) || '.'}`);
    const realParent = realpathSync(parent);
    this.assertContained(realParent);
    return join(realParent, basename(lexical));
  }

  toRelativePath(path: string): string {
    this.assertContained(path);
    return relative(this.root, path) || '.';
  }

  private assertContained(path: string): void {
    const rel = relative(this.root, path);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Path escapes workspace root');
  }
}
