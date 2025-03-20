import { Hono } from "hono";
import { getDocs, getDocsById } from "./database/docsRepository";
import { getPageById, getPagesByDocId } from "./database/pagesRepository";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

// GET all docs
app.get("/docs", async (c) => {
  try {
    const docs = await getDocs();
    return c.json(docs);
  } catch (error) {
    return c.json({ error: "Failed to fetch docs" }, 500);
  }
});

// GET doc by docId
app.get("/docs/:docId", zValidator("param", z.object({ docId: z.coerce.number() })), async (c) => {
  try {
    const { docId } = c.req.valid("param");

    const doc = await getDocsById(docId);

    if (!doc) {
      return c.json({ error: "Doc not found" }, 404);
    }

    return c.json(doc);
  } catch (error) {
    return c.json({ error: "Failed to fetch doc" }, 500);
  }
});

// GET all pages for docs by docId
app.get("/docs/:docId/pages/", zValidator("param", z.object({ docId: z.coerce.number() })), async (c) => {
  try {
    const { docId } = c.req.valid("param");

    // Rest of the logic remains the same
    const docExists = await getDocsById(docId);
    if (!docExists) {
      return c.json({ error: "Doc not found" }, 404);
    }

    const page = await getPagesByDocId(docId);

    if (!page) {
      return c.json({ error: "Page not found" }, 404);
    }

    return c.json(page);
  } catch (error) {
    return c.json({ error: "Failed to fetch page" }, 500);
  }
});

// GET page by docId and pageId
app.get(
  "/docs/:docId/pages/:pageId",
  zValidator("param", z.object({ docId: z.coerce.number(), pageId: z.coerce.number() })),
  async (c) => {
    try {
      const { docId, pageId } = c.req.valid("param");

      // Rest of the logic remains the same
      const docExists = await getDocsById(docId);
      if (!docExists) {
        return c.json({ error: "Doc not found" }, 404);
      }

      const page = await getPageById(docId, pageId);

      if (!page) {
        return c.json({ error: "Page not found" }, 404);
      }

      return c.json(page);
    } catch (error) {
      return c.json({ error: "Failed to fetch page" }, 500);
    }
  },
);

export default app;
