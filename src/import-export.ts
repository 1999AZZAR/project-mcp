import { readFileSync, writeFileSync, existsSync, createReadStream } from 'fs';
import { createInterface } from 'readline';
import { SQLiteManager } from './sqlite-manager.js';
import { PathGuard } from './runtime/path-guard.js';
import { DatabaseOperationResult } from './types.js';

export class ImportExportManager {
  private pathGuard?: PathGuard;
  private readonly allowExternalPaths: boolean;

  constructor(private sqliteManager: SQLiteManager, pathGuard?: PathGuard) {
    this.pathGuard = pathGuard;
    this.allowExternalPaths = process.env['HELA_GENOME_ALLOW_EXTERNAL_PATHS'] === 'true';
  }

  setWorkspaceRoot(root: string): void {
    this.pathGuard = new PathGuard(root);
  }

  private resolveReadPath(filePath: string): string {
    return this.pathGuard && !this.allowExternalPaths
      ? this.pathGuard.resolveExistingPath(filePath)
      : filePath;
  }

  private resolveWritePath(filePath: string): string {
    return this.pathGuard && !this.allowExternalPaths
      ? this.pathGuard.resolveNewPath(filePath)
      : filePath;
  }

  async importFromFile(
    database: string,
    table: string,
    filePath: string,
    format: 'csv' | 'json' | 'sql' = 'csv',
    options?: any
  ): Promise<DatabaseOperationResult> {
    try {
      const startTime = Date.now();
      const resolvedPath = this.resolveReadPath(filePath);

      if (!existsSync(resolvedPath)) {
        return {
          success: false,
          message: `File '${filePath}' does not exist`,
          error: 'File not found'
        };
      }

      let records: any[] = [];
      const BATCH_SIZE = 1000;
      let importedCount = 0;

      switch (format) {
        case 'csv': {
          const rl = createInterface({ input: createReadStream(resolvedPath) });
          const delimiter = options?.delimiter || ',';
          const hasHeader = options?.hasHeader !== false;
          let header: string[] = [];
          let isFirst = true;
          let batch: any[] = [];

          try {
            for await (const line of rl) {
              if (!line.trim()) continue;
              const values = this.parseCSVLine(line, delimiter);
              if (isFirst && hasHeader) {
                header = values;
                isFirst = false;
                continue;
              }
              if (isFirst && !hasHeader) {
                header = values.map((_, i) => `column_${i + 1}`);
                isFirst = false;
              }

              const record: any = {};
              for (let i = 0; i < header.length; i++) {
                record[header[i]] = values[i] ?? '';
              }
              batch.push(record);

              if (batch.length >= BATCH_SIZE) {
                const r = await this.sqliteManager.insertData(database, table, batch);
                if (!r.success) throw new Error(r.error || 'Insert failed');
                importedCount += batch.length;
                batch = [];
              }
            }

            if (batch.length > 0) {
              const r = await this.sqliteManager.insertData(database, table, batch);
              if (!r.success) throw new Error(r.error || 'Insert failed');
              importedCount += batch.length;
            }
          } finally {
            rl.close();
          }

          if (importedCount === 0) {
            return { success: false, message: 'No data found in file', error: 'Empty file' };
          }

          const csvExecTime = Date.now() - startTime;
          return {
            success: true,
            message: `Imported ${importedCount} records from CSV file`,
            data: { importedCount, format: 'csv', filePath: resolvedPath },
            executionTime: csvExecTime
          };
        }
        case 'json':
          records = await this.parseJSON(resolvedPath);
          break;
        case 'sql':
          return await this.executeSQLFile(database, resolvedPath);
        default:
          return {
            success: false,
            message: `Unsupported format: ${format}`,
            error: 'Unsupported format'
          };
      }

      if (records.length === 0) {
        return {
          success: false,
          message: 'No data found in file',
          error: 'Empty file'
        };
      }

      const result = await this.sqliteManager.insertData(database, table, records);
      
      if (result.success) {
        const executionTime = Date.now() - startTime;
        return {
          success: true,
          message: `Imported ${records.length} records from ${format.toUpperCase()} file`,
          data: { 
            importedCount: records.length,
            format,
            filePath: resolvedPath
          },
          executionTime
        };
      } else {
        return result;
      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to import from file',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async exportToFile(
    database: string,
    table: string,
    filePath: string,
    format: 'csv' | 'json' | 'sql' = 'csv',
    conditions?: any,
    options?: any
  ): Promise<DatabaseOperationResult> {
    try {
      const startTime = Date.now();
      const resolvedPath = this.resolveWritePath(filePath);

      // Query data from database
      const queryResult = await this.sqliteManager.queryData(database, table, conditions);
      
      if (!queryResult.success) {
        return queryResult;
      }

      const { columns, rows } = queryResult.data;

      let content: string;

      switch (format) {
        case 'csv':
          content = this.generateCSV(columns, rows, options);
          break;
        case 'json':
          content = this.generateJSON(rows, options);
          break;
        case 'sql':
          content = this.generateSQL(table, columns, rows, options);
          break;
        default:
          return {
            success: false,
            message: `Unsupported format: ${format}`,
            error: 'Unsupported format'
          };
      }

      // Write to file
      const encoding = options?.encoding || 'utf8';
      writeFileSync(resolvedPath, content, { encoding });

      const executionTime = Date.now() - startTime;
      return {
        success: true,
        message: `Exported ${rows.length} records to ${format.toUpperCase()} file`,
        data: { 
          exportedCount: rows.length,
          format,
          filePath: resolvedPath,
          columns: columns.length
        },
        executionTime
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to export to file',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async parseCSV(filePath: string, options?: any): Promise<any[]> {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return [];
    }

    const delimiter = options?.delimiter || ',';
    const hasHeader = options?.hasHeader !== false; // Default to true
    
    let header: string[] = [];
    let dataLines = lines;

    if (hasHeader) {
      header = this.parseCSVLine(lines[0], delimiter);
      dataLines = lines.slice(1);
    } else {
      // Generate column names if no header
      const firstLine = this.parseCSVLine(lines[0], delimiter);
      header = firstLine.map((_, index) => `column_${index + 1}`);
    }

    const records: any[] = [];
    
    for (const line of dataLines) {
      if (line.trim()) {
        const values = this.parseCSVLine(line, delimiter);
        const record: any = {};
        
        for (let i = 0; i < header.length; i++) {
          record[header[i]] = values[i] || '';
        }
        
        records.push(record);
      }
    }

    return records;
  }

  private parseCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  private async parseJSON(filePath: string): Promise<any[]> {
    const content = readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    if (Array.isArray(data)) {
      return data;
    } else if (typeof data === 'object' && data !== null) {
      return [data];
    } else {
      throw new Error('JSON file must contain an array or object');
    }
  }

  private async executeSQLFile(database: string, filePath: string): Promise<DatabaseOperationResult> {
    const rl = createInterface({ input: createReadStream(filePath) });
    let buffer = '';
    let executedCount = 0;

    for await (const line of rl) {
      buffer += line + '\n';
      const idx = buffer.indexOf(';');
      while (idx !== -1) {
        const stmt = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (stmt) {
          const result = await this.sqliteManager.executeSql(database, stmt);
          if (!result.success) {
            rl.close();
            return {
              success: false,
              message: `Failed to execute SQL statement: ${stmt.substring(0, 50)}...`,
              error: result.error
            };
          }
          executedCount++;
        }
        const nextIdx = buffer.indexOf(';');
        if (nextIdx === -1) break;
      }
    }

    const remaining = buffer.trim();
    if (remaining) {
      const result = await this.sqliteManager.executeSql(database, remaining);
      if (result.success) executedCount++;
    }

    return {
      success: true,
      message: `Executed ${executedCount} SQL statements successfully`,
      data: { executedCount }
    };
  }

  private generateCSV(columns: string[], rows: any[], options?: any): string {
    const delimiter = options?.delimiter || ',';
    const includeHeader = options?.includeHeader !== false;
    
    const lines: string[] = [];
    
    if (includeHeader) {
      lines.push(columns.join(delimiter));
    }
    
    for (const row of rows) {
      const values = columns.map(col => {
        const value = row[col];
        if (typeof value === 'string' && (value.includes(delimiter) || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      });
      lines.push(values.join(delimiter));
    }
    
    return lines.join('\n');
  }

  private generateJSON(rows: any[], options?: any): string {
    const pretty = options?.pretty !== false; // Default to true
    return pretty ? JSON.stringify(rows, null, 2) : JSON.stringify(rows);
  }

  private generateSQL(table: string, columns: string[], rows: any[], options?: any): string {
    let sql = '';
    
    for (const row of rows) {
      const values = columns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) {
          return 'NULL';
        } else if (typeof value === 'string') {
          return `'${value.replace(/'/g, "''")}'`;
        } else {
          return value;
        }
      });
      
      sql += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
    }
    
    return sql;
  }
}