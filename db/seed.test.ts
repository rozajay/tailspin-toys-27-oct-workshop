import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTestDatabase } from './test-helpers';
import { categories, games, publishers } from './schema';
import { seedDatabase } from './seed';
import { gameDescription, ratingFromTitle } from './transforms';
import type { Database } from '../src/lib/db';

const CSV = [
    'Title,Category,Publisher,Description',
    '"Game A","Strategy","Pub One","Desc A"',
    '"Game B","Strategy","Pub One","Desc B"',
    '"Game C","Puzzle","Pub Two","Desc C"',
].join('\n');

describe('seedDatabase', () => {
    let db: Database;
    let dir: string;
    let csvPath: string;

    beforeEach(async () => {
        db = await createTestDatabase();
        dir = mkdtempSync(join(tmpdir(), 'tailspin-seed-'));
        csvPath = join(dir, 'games.csv');
        writeFileSync(csvPath, CSV, 'utf-8');
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it('inserts games, categories and publishers from the CSV', async () => {
        await seedDatabase(db, csvPath);

        expect(await db.select().from(games)).toHaveLength(3);
        expect(await db.select().from(categories)).toHaveLength(2);
        expect(await db.select().from(publishers)).toHaveLength(2);
    });

    it('derives the description and rating from the CSV row', async () => {
        await seedDatabase(db, csvPath);

        const rows = await db.select().from(games);
        const gameA = rows.find((game) => game.title === 'Game A');
        expect(gameA?.description).toBe(gameDescription('Desc A'));
        expect(gameA?.starRating).toBe(ratingFromTitle('Game A'));
    });

    it('is idempotent when run twice', async () => {
        await seedDatabase(db, csvPath);
        await seedDatabase(db, csvPath);

        expect(await db.select().from(games)).toHaveLength(3);
        expect(await db.select().from(categories)).toHaveLength(2);
        expect(await db.select().from(publishers)).toHaveLength(2);
    });

    it('links games that share a publisher to the same publisher row', async () => {
        await seedDatabase(db, csvPath);

        const rows = await db.select().from(games);
        const byTitle = new Map(rows.map((game) => [game.title, game]));
        expect(byTitle.get('Game A')?.publisherId).toBe(byTitle.get('Game B')?.publisherId);
        expect(byTitle.get('Game A')?.categoryId).not.toBe(byTitle.get('Game C')?.categoryId);
    });

    it('seeds the bundled games.csv with unique titles', async () => {
        await seedDatabase(db);

        const titles = (await db.select().from(games)).map((game) => game.title);
        expect(titles.length).toBeGreaterThan(0);
        expect(new Set(titles).size).toBe(titles.length);
    });
});
