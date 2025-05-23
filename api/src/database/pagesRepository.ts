import type { NewPage, Page, PageMinimalResponse, PageSearchResultWithScore, UpdatePage } from "../types";
import dbClient from "./kyselyClient";
import { sql } from "kysely";

const pagesTable = "atlas.pages";

export async function getPagesByDocIdMinimal(docId: number): Promise<PageMinimalResponse[]> {
  return dbClient
    .selectFrom(pagesTable)
    .select(["title", "description", "path", "processedContent as content"])
    .where("docId", "=", docId)
    .execute();
}

export async function getPageByPathMinimal(docId: number, pagePath: string): Promise<PageMinimalResponse | undefined> {
  return dbClient
    .selectFrom(pagesTable)
    .select(["title", "description", "path", "processedContent as content"])
    .where("docId", "=", docId)
    .where("path", "=", pagePath)
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
  limit = 20,
): Promise<PageSearchResultWithScore[]> {
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
    .select(["title", "description", "path"])
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
  }));
}
