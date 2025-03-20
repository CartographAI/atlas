import { Hono } from "hono";
import { getDocs, getDocsByName } from "./database/docsRepository";
import { getPageByName, getPagesByDocId } from "./database/pagesRepository";
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

// GET doc by docName
app.get("/docs/:docName", zValidator("param", z.object({ docName: z.coerce.string() })), async (c) => {
  try {
    const { docName } = c.req.valid("param");

    const doc = await getDocsByName(docName);

    if (!doc) {
      return c.json({ error: "Doc not found" }, 404);
    }

    return c.json(doc);
  } catch (error) {
    return c.json({ error: "Failed to fetch doc" }, 500);
  }
});

// GET all pages for docs by docName
app.get("/docs/:docName/pages/", zValidator("param", z.object({ docName: z.coerce.string() })), async (c) => {
  try {
    const { docName } = c.req.valid("param");

    const docExists = await getDocsByName(docName);
    if (!docExists) {
      return c.json({ error: "Doc not found" }, 404);
    }

    const page = await getPagesByDocId(docExists.id);

    if (!page) {
      return c.json({ error: "Page not found" }, 404);
    }

    return c.json(page);
  } catch (error) {
    return c.json({ error: "Failed to fetch page" }, 500);
  }
});

// GET page by docName and pageName
app.get(
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

      const page = await getPageByName(docExists.id, pageName);

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
