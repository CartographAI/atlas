import * as cheerio from "cheerio";

export async function extractSitemapURLs(url: string): Promise<string[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 1. Check for <link rel="sitemap" ...> in the <head>
    const sitemapLink = $('head > link[rel="sitemap"]');
    let sitemapURL: string | null = null;

    if (sitemapLink.length > 0) {
      const href = sitemapLink.attr("href");
      if (href) {
        sitemapURL = new URL(href, url).href; // Resolve to absolute URL
      }
    }

    // 2. If not found in <head>, check for robots.txt and parse it
    if (!sitemapURL) {
      const robotsURL = new URL("/robots.txt", url).href;
      const robotsResponse = await fetch(robotsURL);

      if (robotsResponse.ok) {
        const robotsTxt = await robotsResponse.text();
        const sitemapRegex = /Sitemap:\s*(.+)/gi;
        let match;

        while ((match = sitemapRegex.exec(robotsTxt)) !== null) {
          try {
            sitemapURL = new URL(match[1].trim(), url).href; // Resolve and add
            break; // Usually only the first sitemap is used.
          } catch (e) {
            //ignore
          }
        }
      }
    }

    // 3. If sitemap URL found, fetch and parse it
    if (sitemapURL) {
      return await parseSitemap(sitemapURL);
    } else {
      console.warn(`No sitemap found for ${url}`);
      return [];
    }
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
}

async function parseSitemap(sitemapURL: string): Promise<string[]> {
  const response = await fetch(sitemapURL);
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap ${sitemapURL}: ${response.status} ${response.statusText}`);
  }

  const sitemapContent = await response.text();
  const $ = cheerio.load(sitemapContent, {
    xmlMode: response.headers.get("content-type")?.includes("xml") ?? true, //  Handle XML vs. plain text
  });

  const urls: string[] = [];

  // For XML sitemaps
  $("urlset > url > loc").each((_, element) => {
    const urlText = $(element).text();
    if (urlText) {
      urls.push(urlText);
    }
  });

  //For sitemap indexes
  $("sitemapindex > sitemap > loc").each((_, element) => {
    const urlText = $(element).text();
    if (urlText) {
      // Use Promise.resolve to handle the recursive call correctly.
      Promise.resolve(parseSitemap(urlText)).then((nestedUrls) => {
        urls.push(...nestedUrls);
      });
    }
  });

  //Plain text sitemap
  if (urls.length === 0) {
    const lines = sitemapContent.split("\n");
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        try {
          new URL(trimmedLine); // Check for valid url
          urls.push(trimmedLine);
        } catch {} //ignore
      }
    }
  }
  // Ensure all nested sitemaps are processed before returning.
  await Promise.all(urls);
  return urls;
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

  extractSitemapURLs(url).then((urls) => {
    if (urls.length > 0) {
      console.log("Sitemap URLs found:");
      urls.forEach((url) => console.log(url));
    } else {
      console.log("No sitemap URLs found.");
    }
  });
}
