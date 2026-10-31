import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllCategories,
    getAllGames,
    getAllGameIds,
    getAllPublishers,
    getFilteredGames,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [categoryOne] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [categoryTwo] = await db
        .insert(categories)
        .values({ name: 'Racing', description: 'cat' })
        .returning({ id: categories.id });
    const [publisherOne] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });
    const [publisherTwo] = await db
        .insert(publishers)
        .values({ name: 'Pub Two', description: 'pub' })
        .returning({ id: publishers.id });

    const categoryAssignments = [categoryOne.id, categoryTwo.id];
    const publisherAssignments = [publisherOne.id, publisherTwo.id];

    for (let i = count; i >= 1; i--) {
        const categoryId = categoryAssignments[(count - i) % categoryAssignments.length];
        const publisherId = publisherAssignments[(count - i) % publisherAssignments.length];

        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId,
            publisherId,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('returns all categories and publishers in name order', async () => {
        await seedGames(db, 2);
        const categoriesList = await getAllCategories(db);
        const publishersList = await getAllPublishers(db);

        expect(categoriesList.map((category) => category.name)).toEqual(['Racing', 'Strategy']);
        expect(publishersList.map((publisher) => publisher.name)).toEqual(['Pub One', 'Pub Two']);
    });

    it('filters games by category and publisher together', async () => {
        await seedGames(db, 4);

        const categoriesList = await getAllCategories(db);
        const publishersList = await getAllPublishers(db);
        const strategyCategory = categoriesList.find((category) => category.name === 'Strategy');
        const pubOne = publishersList.find((publisher) => publisher.name === 'Pub One');

        const filtered = await getFilteredGames(db, {
            categoryIds: strategyCategory ? [strategyCategory.id] : [],
            publisherIds: pubOne ? [pubOne.id] : [],
        });

        expect(filtered.map((game) => game.title)).toEqual(['Game 02', 'Game 04']);
    });

    it('returns an empty list when no games match the selected filters', async () => {
        await seedGames(db, 2);

        const filtered = await getFilteredGames(db, {
            categoryIds: [-1],
            publisherIds: [-2],
        });

        expect(filtered).toEqual([]);
    });
});
