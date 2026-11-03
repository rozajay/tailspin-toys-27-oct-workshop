import { describe, it, expect } from 'vitest';
import {
    parseGamesCsv,
    parseCsv,
    categoryDescription,
    publisherDescription,
    gameDescription,
    uniqueCategories,
    uniquePublishers,
    ratingFromTitle,
    type GameCsvRow,
} from './transforms';

describe('parseCsv', () => {
    it('parses quoted fields containing commas', () => {
        const rows = parseCsv('A,B\n"hello, world","x"');
        expect(rows).toEqual([{ A: 'hello, world', B: 'x' }]);
    });

    it('handles escaped double quotes', () => {
        const rows = parseCsv('A\n"she said ""hi"""');
        expect(rows[0].A).toBe('she said "hi"');
    });

    it('handles newlines inside quoted fields', () => {
        const rows = parseCsv('A,B\n"line1\nline2","y"');
        expect(rows[0].A).toBe('line1\nline2');
        expect(rows[0].B).toBe('y');
    });

    it('returns an empty array for empty input', () => {
        expect(parseCsv('')).toEqual([]);
    });

    it('handles CRLF line endings', () => {
        expect(parseCsv('A,B\r\n1,2\r\n3,4\r\n')).toEqual([
            { A: '1', B: '2' },
            { A: '3', B: '4' },
        ]);
    });

    it('keeps the last row when there is no trailing newline', () => {
        expect(parseCsv('A,B\n1,2')).toEqual([{ A: '1', B: '2' }]);
    });

    it('fills missing trailing fields with empty strings', () => {
        expect(parseCsv('A,B,C\n1,2')).toEqual([{ A: '1', B: '2', C: '' }]);
    });
});

describe('parseGamesCsv', () => {
    const csv = [
        'Title,Category,Publisher,Description',
        '"Game A","Strategy","Pub One","Desc A"',
        '"Game B","Strategy","Pub Two","Desc B"',
        '', // trailing blank line should be ignored
    ].join('\n');

    it('maps rows to typed game records', () => {
        const rows = parseGamesCsv(csv);
        expect(rows).toHaveLength(2);
        expect(rows[0]).toEqual({
            title: 'Game A',
            category: 'Strategy',
            publisher: 'Pub One',
            description: 'Desc A',
        });
    });

    it('skips rows without a title', () => {
        const rows = parseGamesCsv('Title,Category,Publisher,Description\n,,,');
        expect(rows).toHaveLength(0);
    });
});

describe('description helpers', () => {
    it('builds a category description', () => {
        expect(categoryDescription('Strategy')).toBe(
            'Collection of Strategy games available for crowdfunding',
        );
    });

    it('builds a publisher description', () => {
        expect(publisherDescription('CodeForge')).toBe(
            'CodeForge is a game publisher seeking funding for exciting new titles',
        );
    });

    it('appends the crowdfunding blurb to a game description', () => {
        expect(gameDescription('A great game.')).toBe(
            'A great game. Support this game through our crowdfunding platform!',
        );
    });
});

describe('dedupe helpers', () => {
    const rows: GameCsvRow[] = [
        { title: 'A', category: 'Strategy', publisher: 'P1', description: '' },
        { title: 'B', category: 'Puzzle', publisher: 'P1', description: '' },
        { title: 'C', category: 'Strategy', publisher: 'P2', description: '' },
    ];

    it('returns distinct categories in first-seen order', () => {
        expect(uniqueCategories(rows)).toEqual(['Strategy', 'Puzzle']);
    });

    it('returns distinct publishers in first-seen order', () => {
        expect(uniquePublishers(rows)).toEqual(['P1', 'P2']);
    });
});

describe('ratingFromTitle', () => {
    it.each([
        ['DevOps Dominion', 3.6],
        ['Code Quest', 3.9],
    ])('keeps the published rating for %s stable', (title, expected) => {
        // Changing the hash changes every seeded rating; update deliberately.
        expect(ratingFromTitle(title)).toBe(expected);
    });

    it('is deterministic for the same title', () => {
        expect(ratingFromTitle('DevOps Dominion')).toBe(ratingFromTitle('DevOps Dominion'));
    });

    it('stays within the inclusive range [3.0, 5.0]', () => {
        for (const title of ['A', 'Pipeline Conquest', 'zzz', 'Server Siege', '']) {
            const rating = ratingFromTitle(title);
            expect(rating).toBeGreaterThanOrEqual(3.0);
            expect(rating).toBeLessThanOrEqual(5.0);
        }
    });

    it('produces at most one decimal place', () => {
        const rating = ratingFromTitle('Some Title');
        expect(Math.round(rating * 10)).toBeCloseTo(rating * 10, 5);
    });
});
