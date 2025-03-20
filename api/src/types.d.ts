import type { Insertable, Selectable, Updateable } from "kysely";
import type { Docs, Pages } from "./database/db.d.ts";

// Export wrapped versions of each database entity, for clarity and separation between db and business logic.
// Use these types throughout the app. Do not use those in the generated db.d.ts file directly.

export type Doc = Selectable<Docs>;
export type NewDoc = Insertable<Docs>;
export type UpdateDoc = Updateable<Docs>;

export type Page = Selectable<Pages>;
export type NewPage = Insertable<Pages>;
export type UpdatePage = Updateable<Pages>;
