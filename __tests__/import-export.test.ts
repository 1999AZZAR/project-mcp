import { ImportExportManager } from '../src/import-export';
import { SQLiteManager } from '../src/sqlite-manager';
import { PathGuard } from '../src/runtime/path-guard';
import { writeFileSync, readFileSync, existsSync, unlinkSync, rmdirSync, readdirSync } from 'fs';
import { join } from 'path';

describe('ImportExportManager', () => {
  let sqliteManager: SQLiteManager;
  let importExportManager: ImportExportManager;
  let testDbPath: string;

  beforeEach(async () => {
    // Use unique test directory for each test to avoid conflicts
    testDbPath = `./test-databases-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sqliteManager = new SQLiteManager(testDbPath);
    importExportManager = new ImportExportManager(sqliteManager);

    await sqliteManager.createDatabase('test_db');
    const schema = {
      columns: [
        { name: 'id', type: 'INTEGER', constraints: ['PRIMARY KEY'] },
        { name: 'name', type: 'TEXT' },
        { name: 'email', type: 'TEXT' },
        { name: 'age', type: 'INTEGER' }
      ]
    };
    await sqliteManager.createTable('test_db', 'users', schema);
  });

  afterEach(async () => {
    await sqliteManager.closeAllConnections();
    // Clean up test files
    const testFiles = ['./test.csv', './test.json', './test.sql', './export.csv', './export.json', './export.sql'];
    for (const file of testFiles) {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    }
    // Clean up test database directory
    try {
      if (existsSync(testDbPath)) {
        const files = readdirSync(testDbPath);
        for (const file of files) {
          if (file.endsWith('.db')) {
            unlinkSync(join(testDbPath, file));
          }
        }
        rmdirSync(testDbPath);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('CSV Import', () => {
    test('should import CSV with header', async () => {
      const csvContent = `id,name,email,age
1,John Doe,john@example.com,30
2,Jane Smith,jane@example.com,25`;

      writeFileSync('./test.csv', csvContent);

      const result = await importExportManager.importFromFile(
        'test_db',
        'users',
        './test.csv',
        'csv',
        { hasHeader: true }
      );

      expect(result.success).toBe(true);
      expect(result.data.importedCount).toBe(2);

      // Verify data was inserted
      const queryResult = await sqliteManager.queryData('test_db', 'users');
      expect(queryResult.data.rows).toHaveLength(2);
      expect(queryResult.data.rows[0].name).toBe('John Doe');
    });

    test('should import CSV without header', async () => {
      // Create table with generated column names
      const schema = {
        columns: [
          { name: 'column_1', type: 'TEXT' },
          { name: 'column_2', type: 'TEXT' },
          { name: 'column_3', type: 'TEXT' },
          { name: 'column_4', type: 'TEXT' }
        ]
      };
      await sqliteManager.createTable('test_db', 'csv_test', schema);

      const csvContent = `1,John Doe,john@example.com,30
2,Jane Smith,jane@example.com,25`;

      writeFileSync('./test.csv', csvContent);

      const result = await importExportManager.importFromFile(
        'test_db',
        'csv_test',
        './test.csv',
        'csv',
        { hasHeader: false }
      );

      expect(result.success).toBe(true);
      expect(result.data.importedCount).toBe(2);

      // Verify data was inserted
      const queryResult = await sqliteManager.queryData('test_db', 'csv_test');
      expect(queryResult.data.rows).toHaveLength(2);
      expect(queryResult.data.rows[0].column_2).toBe('John Doe');
    });

    test('should import CSV with custom delimiter', async () => {
      const csvContent = `id;name;email;age
1;John Doe;john@example.com;30
2;Jane Smith;jane@example.com;25`;

      writeFileSync('./test.csv', csvContent);

      const result = await importExportManager.importFromFile(
        'test_db',
        'users',
        './test.csv',
        'csv',
        { delimiter: ';', hasHeader: true }
      );

      expect(result.success).toBe(true);
      expect(result.data.importedCount).toBe(2);
    });
  });

  describe('JSON Import', () => {
    test('should import JSON array', async () => {
      const jsonContent = JSON.stringify([
        { id: 1, name: 'John Doe', email: 'john@example.com', age: 30 },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25 }
      ]);

      writeFileSync('./test.json', jsonContent);

      const result = await importExportManager.importFromFile(
        'test_db',
        'users',
        './test.json',
        'json'
      );

      expect(result.success).toBe(true);
      expect(result.data.importedCount).toBe(2);
    });

    test('should import JSON object', async () => {
      const jsonContent = JSON.stringify({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        age: 30
      });

      writeFileSync('./test.json', jsonContent);

      const result = await importExportManager.importFromFile(
        'test_db',
        'users',
        './test.json',
        'json'
      );

      expect(result.success).toBe(true);
      expect(result.data.importedCount).toBe(1);
    });
  });

  describe('SQL Import', () => {
    test('should execute SQL file', async () => {
      const sqlContent = `INSERT INTO users (id, name, email, age) VALUES (1, 'John Doe', 'john@example.com', 30);
INSERT INTO users (id, name, email, age) VALUES (2, 'Jane Smith', 'jane@example.com', 25);`;

      writeFileSync('./test.sql', sqlContent);

      const result = await importExportManager.importFromFile(
        'test_db',
        'users',
        './test.sql',
        'sql'
      );

      expect(result.success).toBe(true);
      expect(result.data.executedCount).toBe(2);

      // Verify data was inserted
      const queryResult = await sqliteManager.queryData('test_db', 'users');
      expect(queryResult.data.rows).toHaveLength(2);
    });
  });

  describe('CSV Export', () => {
    beforeEach(async () => {
      const records = [
        { id: 1, name: 'John Doe', email: 'john@example.com', age: 30 },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25 }
      ];
      await sqliteManager.insertData('test_db', 'users', records);
    });

    test('should export CSV with header', async () => {
      const result = await importExportManager.exportToFile(
        'test_db',
        'users',
        './export.csv',
        'csv',
        undefined,
        { includeHeader: true }
      );

      expect(result.success).toBe(true);
      expect(result.data.exportedCount).toBe(2);
      expect(existsSync('./export.csv')).toBe(true);

      const content = readFileSync('./export.csv', 'utf8');
      expect(content).toContain('id,name,email,age');
      expect(content).toContain('John Doe');
    });

    test('should export CSV without header', async () => {
      const result = await importExportManager.exportToFile(
        'test_db',
        'users',
        './export.csv',
        'csv',
        undefined,
        { includeHeader: false }
      );

      expect(result.success).toBe(true);
      expect(result.data.exportedCount).toBe(2);

      const content = readFileSync('./export.csv', 'utf8');
      expect(content).not.toContain('id,name,email,age');
      expect(content).toContain('John Doe');
    });

    test('should export CSV with custom delimiter', async () => {
      const result = await importExportManager.exportToFile(
        'test_db',
        'users',
        './export.csv',
        'csv',
        undefined,
        { delimiter: ';' }
      );

      expect(result.success).toBe(true);
      expect(result.data.exportedCount).toBe(2);

      const content = readFileSync('./export.csv', 'utf8');
      expect(content).toContain('id;name;email;age');
    });
  });

  describe('JSON Export', () => {
    beforeEach(async () => {
      const records = [
        { id: 1, name: 'John Doe', email: 'john@example.com', age: 30 },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25 }
      ];
      await sqliteManager.insertData('test_db', 'users', records);
    });

    test('should export JSON', async () => {
      const result = await importExportManager.exportToFile(
        'test_db',
        'users',
        './export.json',
        'json'
      );

      expect(result.success).toBe(true);
      expect(result.data.exportedCount).toBe(2);
      expect(existsSync('./export.json')).toBe(true);

      const content = readFileSync('./export.json', 'utf8');
      const data = JSON.parse(content);
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe('John Doe');
    });
  });

  describe('SQL Export', () => {
    beforeEach(async () => {
      const records = [
        { id: 1, name: 'John Doe', email: 'john@example.com', age: 30 },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25 }
      ];
      await sqliteManager.insertData('test_db', 'users', records);
    });

    test('should export SQL', async () => {
      const result = await importExportManager.exportToFile(
        'test_db',
        'users',
        './export.sql',
        'sql'
      );

      expect(result.success).toBe(true);
      expect(result.data.exportedCount).toBe(2);
      expect(existsSync('./export.sql')).toBe(true);

      const content = readFileSync('./export.sql', 'utf8');
      expect(content).toContain('INSERT INTO users');
      expect(content).toContain('John Doe');
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent file', async () => {
      const result = await importExportManager.importFromFile(
        'test_db',
        'users',
        './non-existent.csv',
        'csv'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('does not exist');
    });

    test('should handle invalid JSON', async () => {
      writeFileSync('./test.json', 'invalid json');

      const result = await importExportManager.importFromFile(
        'test_db',
        'users',
        './test.json',
        'json'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to import');
    });

    test('should handle empty CSV', async () => {
      writeFileSync('./test.csv', '');

      const result = await importExportManager.importFromFile(
        'test_db',
        'users',
        './test.csv',
        'csv'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('No data found');
    });
  });

  describe('Workspace Path Guard', () => {
    test('rejects absolute and traversal paths', async () => {
      const guarded = new ImportExportManager(sqliteManager, new PathGuard(process.cwd()));

      const outsideExport = await guarded.exportToFile('test_db', 'users', '/tmp/guardian-outside.json', 'json');
      expect(outsideExport.success).toBe(false);
      expect(outsideExport.error).toContain('workspace-relative');

      const traversalExport = await guarded.exportToFile('test_db', 'users', '../guardian-outside.json', 'json');
      expect(traversalExport.success).toBe(false);
      expect(traversalExport.error).toContain('escapes workspace root');

      const outsideImport = await guarded.importFromFile('test_db', 'users', '/etc/hosts', 'csv');
      expect(outsideImport.success).toBe(false);
      expect(outsideImport.error).toContain('workspace-relative');
    });
  });
});
