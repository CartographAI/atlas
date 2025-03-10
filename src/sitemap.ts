import { parseHTML } from "linkedom";

async function extractSitemapURLs(url: string): Promise<string[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const { document } = parseHTML(html);

    // 1. Check for <link rel="sitemap" ...> in the <head>
    const sitemapLink = document.querySelector('head > link[rel="sitemap"]');
    let sitemapURL: string | null = null;

    if (sitemapLink) {
      const href = sitemapLink.getAttribute("href");
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
  const { document } = parseHTML(sitemapContent, {
    contentType: response.headers.get("content-type") ?? "application/xml", //Handle different sitemap content types
  });

  const urls: string[] = [];

  // For XML sitemaps
  const urlElements = document.querySelectorAll("urlset > url > loc");
  for (const loc of urlElements) {
    const urlText = loc.textContent;
    if (urlText) {
      urls.push(urlText);
    }
  }
  //For sitemap indexes
  const sitemapElements = document.querySelectorAll("sitemapindex > sitemap > loc");
  for (const loc of sitemapElements) {
    const urlText = loc.textContent;
    if (urlText) {
      const nestedUrls = await parseSitemap(urlText); //recursive call
      urls.push(...nestedUrls);
    }
  }
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
