import { PGlite } from "@electric-sql/pglite";
import { extractSitemapURLs } from "./sitemap.ts";
import { fetchAndParse, extractLinks, extractContent } from "./fetch.ts";

async function processPage(url: string, processedPages: Set<string>, baseUrl: string): Promise<void> {
  try {
    // check if page has already been processed
    // handle case where link has fragment identifier
    let cleanUrl = url.split("#")[0];
    if (processedPages.has(cleanUrl)) {
      return; // already processed
    }

    console.log(`Processing: ${cleanUrl}`);
    const $ = await fetchAndParse(cleanUrl);

    const content = await extractContent($);
    console.log(`Content from ${cleanUrl}:\\n${content.substring(0, 200)}...\\n`); // Log a snippet

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

    await Promise.all(absoluteLinks.map((link) => processPage(link, processedPages, baseUrl)));
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

  const processedPages = new Set<string>();

  const sitemapURLs = await extractSitemapURLs(url);

  if (sitemapURLs.length > 0) {
    console.log("Processing sitemap URLs...");
    await Promise.all(sitemapURLs.map((sitemapURL) => processPage(sitemapURL, processedPages, url)));
  } else {
    console.log("No sitemap found, crawling from root URL...");
    await processPage(url, processedPages, url); // Start crawling from the provided URL
  }

  console.log("Finished processing.");
}
