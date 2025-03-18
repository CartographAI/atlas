import { PGlite } from "@electric-sql/pglite";
import { extractSitemapURLs } from "./sitemap.ts";
import { fetchAndParse, extractLinks, extractContent } from "./fetch.ts";
import { generateGeminiObject } from "./ai.ts";
import { z } from "zod";

const pageSchema = z.object({
  title: z.string(),
  description: z.string(),
  markdown: z.string(),
});

export async function indexPage(url: string, db: PGlite) {
  const processedPages = new Set<string>();

  const sitemapURLs = await extractSitemapURLs(url);

  if (sitemapURLs.length > 0) {
    await Promise.all(sitemapURLs.map((sitemapURL) => processPage(sitemapURL, processedPages, url, db)));
  } else {
    console.warn("No sitemap found, crawling from root URL...");
    await processPage(url, processedPages, url, db); // Start crawling from the provided URL
  }
  const numberPages = await db.query("select count(*) from pages");
  console.warn(`Finished processing ${numberPages.rows[0].count} pages.`);
}

async function processPage(url: string, processedPages: Set<string>, baseUrl: string, db: PGlite): Promise<void> {
  try {
    // check if page has already been processed
    // handle case where link has fragment identifier
    let cleanUrl = url.split("#")[0];
    if (processedPages.has(cleanUrl)) {
      return; // already processed
    }

    const $ = await fetchAndParse(cleanUrl);

    const content = await extractContent($);

    if (content === null) {
      console.error("content is null");
      return;
    }
    const html = content.html();
    const text = content.text();

    // Check if the page exists and if content has changed
    const existingPage = await db.query("SELECT raw_html, markdown, title, description FROM pages WHERE url = $1", [
      cleanUrl,
    ]);

    const existingContent = existingPage.rows[0]?.raw_html;
    const existingTitle = existingPage.rows[0]?.title;
    const existingDescription = existingPage.rows[0]?.description;
    const existingMarkdown = existingPage.rows[0]?.markdown;

    let title: string | null = existingTitle;
    let description: string | null = existingDescription;
    let markdown: string | null = existingMarkdown;

    // Only generate new markdown if content is new or has changed
    if (!existingContent || existingContent !== html) {
      try {
        const result = await generateGeminiObject(
          [
            {
              role: "user",
              content: `You are to create well-formatted markdown from a HTML page. You are given the HTML (raw html from the page) as well as the TEXT (just the text from the page). Use the HTML to understand the structure and TEXT to understand the content and use both to create a markdown output. Output the title of the page as well a concise one-line description of the page.\n\n<HTML>\n\`\`\`${html}\`\`\`\n</HTML>\n\n<TEXT>\n\`\`\`${text}\`\`\`\n</TEXT>.`,
            },
          ],
          pageSchema,
        );
        markdown = result?.markdown ?? null;
        title = result?.title ?? null;
        description = result?.description ?? null;
      } catch (error) {
        console.error(`Error generating markdown for ${cleanUrl}:`, error);
        markdown = null;
        title = null;
        description = null;
      }
    }

    // Insert or update the page
    await db.query(
      "INSERT INTO pages (url, title, description, raw_html, markdown) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (url) DO UPDATE SET raw_html = $4, markdown = $5, title = $2, description = $3, updated_at = CURRENT_TIMESTAMP",
      [cleanUrl, title, description, html, markdown],
    );

    processedPages.add(cleanUrl);

    const links = await extractLinks($);
    const absoluteLinks = links
      .filter((link) => !link.startsWith("#")) // filter relative subheading links
      .map((link) => {
        try {
          return new URL(link, cleanUrl).href; // Resolve relative URLs
        } catch (e) {
          return null; // Invalid URL
        }
      })
      .filter((absoluteLink): absoluteLink is string => absoluteLink !== null && absoluteLink.startsWith(baseUrl));

    await Promise.all(absoluteLinks.map((link) => processPage(link, processedPages, baseUrl, db)));
  } catch (error) {
    console.error("Error:", error);
  }
}

if (import.meta.main) {
  const url = Bun.argv[2];

  if (!url) {
    console.error("Please provide a URL as a command-line argument.");
    process.exit(1);
  }
  if (!URL.canParse(url)) {
    console.error("Please provide a valid URL as a command-line argument.");
    process.exit(1);
  }

  const db = new PGlite();
  const schemaSql = await Bun.file("src/db/schema.sql").text();
  await db.exec(schemaSql);
  await indexPage(url, db);
  const response = await db.query("select * from pages");
  console.log(response);
}
