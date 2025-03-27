import type { NewPage, Page, UpdatePage } from "../types";
import dbClient from "./kyselyClient";
import { sql } from "kysely";

const pagesTable = "atlas.pages";

type PageWithScore = Page & {
  relevanceScore: number;
};

export async function getPagesByDocId(docId: number): Promise<Page[]> {
  return dbClient.selectFrom(pagesTable).selectAll().where("docId", "=", docId).execute();
}

export async function getPageById(docId: number, pageId: number): Promise<Page | undefined> {
  return dbClient
    .selectFrom(pagesTable)
    .selectAll()
    .where("docId", "=", docId)
    .where("id", "=", pageId)
    .executeTakeFirst();
}

export async function getPageByName(docId: number, pageName: string): Promise<Page | undefined> {
  return dbClient
    .selectFrom(pagesTable)
    .selectAll()
    .where("docId", "=", docId)
    .where("slug", "=", pageName)
    .executeTakeFirst();
}

export async function createPage(page: NewPage): Promise<Page> {
  const insertedPage = await dbClient.insertInto(pagesTable).values(page).returningAll().executeTakeFirst();
  if (!insertedPage) throw new Error("Failed to create page");
  return insertedPage;
}

export async function updatePage(docId: number, pageId: number, page: UpdatePage): Promise<Page> {
  const updatedPage = await dbClient
    .updateTable(pagesTable)
    .set(page)
    .where("docId", "=", docId)
    .where("id", "=", pageId)
    .returningAll()
    .executeTakeFirst();

  if (!updatedPage) throw new Error("Failed to update page");
  return updatedPage;
}

export async function deletePage(docId: number, pageId: number): Promise<void> {
  await dbClient.deleteFrom(pagesTable).where("docId", "=", docId).where("id", "=", pageId).execute();
}

export async function searchPagesWeighted(
  docId: number,
  searchTerms: string,
  limit: number = 20, // Default limit
): Promise<PageWithScore[]> {
  // Define the weighted tsvector expression using sql fragments.
  // This MUST exactly match the expression used in the CREATE INDEX statement.
  const weightedTsVector = sql`(
        setweight(to_tsvector('english', coalesce(${sql.ref(`${pagesTable}.title`)}, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${sql.ref(`${pagesTable}.description`)}, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${sql.ref(`${pagesTable}.processed_content`)}, '')), 'D')
    )`;

  // Define the tsquery expression using plainto_tsquery for simple keyword matching.
  // Use to_tsquery if you need more advanced syntax (&, |, !) in searchTerms.
  const tsQuery = sql`plainto_tsquery('english', ${searchTerms})`;

  const results = await dbClient
    .selectFrom(pagesTable)
    .select(["id", "docId", "title", "description", "slug", "createdAt", "updatedAt"])
    .select(
      // Calculate and select the relevance score using ts_rank_cd
      sql<number>`ts_rank_cd(${weightedTsVector}, ${tsQuery})`.as("relevanceScore"),
    )
    .where("docId", "=", docId) // Filter by the specific document ID
    .where(weightedTsVector, "@@", tsQuery) // Perform the FTS match using the @@ operator and the index
    .orderBy("relevanceScore", "desc") // Order results by the calculated score, highest first
    .limit(limit) // Limit the number of results returned
    .execute();

  // Kysely might return numeric types from raw SQL as strings in some drivers/versions.
  // Cast the relevanceScore explicitly if necessary, although often it works correctly.
  // The overall return type of execute() is Promise<any[]>, so casting the array is good practice.
  return results.map((row) => ({
    ...row,
    relevanceScore: Number(row.relevanceScore), // Ensure score is a number
  })) as PageWithScore[];
}
