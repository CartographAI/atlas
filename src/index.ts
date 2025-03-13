import { extractSitemapURLs } from "./sitemap.ts";
import { fetchAndExtractContent } from "./fetch.ts";
import { extractLinks } from "./map.ts";

async function processPage(url: string, processedPages: Set<string>, baseUrl: string): Promise<void> {
  // check if page has already been processed
  // handle case where link has fragment identifier
  if (processedPages.has(url.split("#")[0])) {
    return; // already processed
  }

  console.log(`Processing: ${url}`);
  processedPages.add(url);

  const content = await fetchAndExtractContent(url);
  console.log(`Content from ${url}:\\n${content.substring(0, 200)}...\\n`); // Log a snippet

  const links = await extractLinks(url);
  const absoluteLinks = links
    .filter((link) => !link.startsWith("#")) // filter relative subheading links
    .map((link) => {
      try {
        return new URL(link, url).href; // Resolve relative URLs
      } catch (e) {
        return null; // Invalid URL
      }
    })
    .filter((absoluteLink): absoluteLink is string => absoluteLink !== null && absoluteLink.startsWith(baseUrl));

  for (const link of absoluteLinks) {
    await processPage(link, processedPages, baseUrl); // Recursive call
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

  const processedPages = new Set<string>();

  const sitemapURLs = await extractSitemapURLs(url);

  if (sitemapURLs.length > 0) {
    console.log("Processing sitemap URLs...");
    for (const sitemapURL of sitemapURLs) {
      await processPage(sitemapURL, processedPages, url);
    }
  } else {
    console.log("No sitemap found, crawling from root URL...");
    await processPage(url, processedPages, url); // Start crawling from the provided URL
  }

  console.log("Finished processing.");
}
