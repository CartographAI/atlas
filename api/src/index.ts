import { Hono } from "hono";
import { getDocs, getDocsById } from "./database/docsRepository";
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

export default app;
