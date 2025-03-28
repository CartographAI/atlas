import type { Doc, DocMinimalResponse, NewDoc, UpdateDoc } from "../types";
import dbClient from "./kyselyClient";

const docsTable = "atlas.docs";

export async function getDocs(): Promise<Doc[]> {
  return dbClient.selectFrom(docsTable).selectAll().execute();
}

export async function getDocsMinimal(): Promise<DocMinimalResponse[]> {
  return dbClient.selectFrom(docsTable).select(["name", "description", "sourceUrl"]).execute();
}

export async function getDocsById(id: number): Promise<Doc | undefined> {
  return dbClient.selectFrom(docsTable).selectAll().where("id", "=", id).executeTakeFirst();
}

export async function getDocsByName(name: string): Promise<Doc | undefined> {
  return dbClient.selectFrom(docsTable).selectAll().where("name", "ilike", name).executeTakeFirst();
}

export async function getDocsByNameMinimal(name: string): Promise<DocMinimalResponse | undefined> {
  return dbClient
    .selectFrom(docsTable)
    .select(["name", "description", "sourceUrl"])
    .where("name", "ilike", name)
    .executeTakeFirst();
}

export async function createDoc(doc: NewDoc): Promise<Doc> {
  const insertedDoc = await dbClient.insertInto(docsTable).values(doc).returningAll().executeTakeFirst();
  if (!insertedDoc) throw new Error("Failed to create doc");
  return insertedDoc;
}

export async function updateDoc(id: number, doc: UpdateDoc): Promise<Doc> {
  const updatedDoc = await dbClient
    .updateTable(docsTable)
    .set(doc)
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
  if (!updatedDoc) throw new Error("Failed to update doc");
  return updatedDoc;
}

export async function deleteDocById(id: number): Promise<void> {
  await dbClient.deleteFrom(docsTable).where("id", "=", id).execute();
}
