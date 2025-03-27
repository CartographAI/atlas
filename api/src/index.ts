import { Hono } from "hono";
import { getDocsMinimal, getDocsByName, getDocsByNameMinimal } from "./database/docsRepository";
import { getPageByNameMinimal, getPagesByDocIdMinimal, searchPagesWeighted } from "./database/pagesRepository";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

const api = new Hono();

api.get("/health", (c) => {
  return c.json({ ok: true });
});

// GET all docs
api.get("/docs", async (c) => {
  try {
    const docs = await getDocsMinimal();
    return c.json(docs);
  } catch (error) {
    return c.json({ error: "Failed to fetch docs" }, 500);
  }
});

// GET doc by docName
api.get("/docs/:docName", zValidator("param", z.object({ docName: z.coerce.string() })), async (c) => {
  try {
    const { docName } = c.req.valid("param");

    const doc = await getDocsByNameMinimal(docName);

    if (!doc) {
      return c.json({ error: "Doc not found" }, 404);
    }

    return c.json(doc);
  } catch (error) {
    return c.json({ error: "Failed to fetch doc" }, 500);
  }
});

// GET all pages for docs by docName
api.get("/docs/:docName/pages/", zValidator("param", z.object({ docName: z.coerce.string() })), async (c) => {
  try {
    const { docName } = c.req.valid("param");

    const docExists = await getDocsByName(docName);
    if (!docExists) {
      return c.json({ error: "Doc not found" }, 404);
    }

    const pages = await getPagesByDocIdMinimal(docExists.id);
    return c.json(pages);
  } catch (error) {
    return c.json({ error: "Failed to fetch pages" }, 500);
  }
});

// GET page by docName and pageName
api.get(
  "/docs/:docName/pages/:pageName",
  zValidator("param", z.object({ docName: z.coerce.string(), pageName: z.coerce.string() })),
  async (c) => {
    try {
      const { docName, pageName } = c.req.valid("param");

      // This can be optimized into a single call
      const docExists = await getDocsByName(docName);
      if (!docExists) {
        return c.json({ error: "Doc not found" }, 404);
      }

      const page = await getPageByNameMinimal(docExists.id, pageName);

      if (!page) {
        return c.json({ error: "Page not found" }, 404);
      }

      return c.json(page);
    } catch (error) {
      return c.json({ error: "Failed to fetch page" }, 500);
    }
  },
);

// GET search pages in a doc
api.get(
  "/docs/:docName/search",
  zValidator("param", z.object({ docName: z.coerce.string() })),
  zValidator("query", z.object({ q: z.string() })),
  async (c) => {
    try {
      const { docName } = c.req.valid("param");
      const { q: searchQuery } = c.req.valid("query");

      // Check if doc exists
      const docExists = await getDocsByName(docName);
      if (!docExists) {
        return c.json({ error: "Doc not found" }, 404);
      }

      const searchResults = await searchPagesWeighted(docExists.id, searchQuery);

      return c.json(searchResults);
    } catch (error) {
      return c.json({ error: "Failed to search pages" }, 500);
    }
  },
);

const app = new Hono();
app.route("/api", api);

export default app;
