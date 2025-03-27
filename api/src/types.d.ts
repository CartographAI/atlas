import type { Insertable, Selectable, Updateable } from "kysely";
import type { AtlasDocs, AtlasPages } from "./database/db.d.ts";

// Export wrapped versions of each database entity, for clarity and separation between db and business logic.
// Use these types throughout the app. Do not use those in the generated db.d.ts file directly.

export type Doc = Selectable<AtlasDocs>;
export type NewDoc = Insertable<AtlasDocs>;
export type UpdateDoc = Updateable<AtlasDocs>;

export type Page = Selectable<AtlasPages>;
export type NewPage = Insertable<AtlasPages>;
export type UpdatePage = Updateable<AtlasPages>;

export type DocMinimalResponse = Pick<Doc, "name" | "description" | "sourceUrl">;
export type PageMinimalResponse = {
  title: string;
  description: string | null;
  content: string;
};

export type PageSearchResultWithScore = {
  title: string;
  description: string | null;
  relevanceScore: number;
};
