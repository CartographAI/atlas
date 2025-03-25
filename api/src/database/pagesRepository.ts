import type { NewPage, Page, UpdatePage } from "../types";
import dbClient from "./kyselyClient";

const pagesTable = "atlas.pages";

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
