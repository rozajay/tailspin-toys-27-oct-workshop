import { describe, it, expect } from 'vitest';
import { createDatabase, createDatabaseConnection, executeMigrationQueries } from './db';

function tableExists(sqlite: ReturnType<typeof createDatabaseConnection>['sqlite'], name: string): boolean {
    const row = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
    return row !== undefined;
}

describe('executeMigrationQueries', () => {
    it('applies every statement when all succeed', () => {
        const { sqlite } = createDatabaseConnection(':memory:');

        executeMigrationQueries(sqlite, ['CREATE TABLE a (id INTEGER)', 'CREATE TABLE b (id INTEGER)']);

        expect(tableExists(sqlite, 'a')).toBe(true);
        expect(tableExists(sqlite, 'b')).toBe(true);
    });

    it('rolls back earlier statements and rethrows when a later one fails', () => {
        const { sqlite } = createDatabaseConnection(':memory:');

        expect(() => executeMigrationQueries(sqlite, ['CREATE TABLE a (id INTEGER)', 'NOT VALID SQL'])).toThrow();

        expect(tableExists(sqlite, 'a')).toBe(false);
    });
});

describe('createDatabase', () => {
    it('accepts an in-memory database', () => {
        expect(() => createDatabase(':memory:')).not.toThrow();
    });

    it('rejects non-file URLs', () => {
        expect(() => createDatabase('http://example.com/db')).toThrow(/local file/);
    });

    it('rejects a file URL without a path', () => {
        expect(() => createDatabase('file:')).toThrow(/file path/);
    });
});
