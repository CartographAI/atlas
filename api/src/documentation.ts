import { createDoc, getDocsByName } from "./database/docsRepository";
import { createPage } from "./database/pagesRepository";
import { NewDoc, NewPage } from "./types";
import { fetchAndParse, extractLinks, extractContent } from "./extract";

interface LibraryUrls {
  [key: string]: string;
}

const libraryUrls: LibraryUrls = {
  hono: "https://hono.dev/llms.txt",
  // drizzle: "https://orm.drizzle.team/llms.txt",
  // mastra: "https://mastra.ai/llms.txt",
  resend: "https://resend.com/docs/llms.txt",
};

function checkBaseUrl(url: string, baseUrl: string): Boolean {
  try {
    const urlObj = new URL(url);
    const baseUrlObj = new URL(baseUrl);

    // Check hostname matches
    if (urlObj.hostname !== baseUrlObj.hostname) return false;

    // Get path segments (removing empty strings from split)
    const urlPath = urlObj.pathname.split("/").filter(Boolean);
    const basePath = baseUrlObj.pathname.split("/").filter(Boolean);

    // Check if url path starts with base path front
    const urlPathFront = urlPath.slice(0, basePath.length);
    if (!basePath.every((segment, i) => segment === urlPathFront[i])) return false;

    return true;
  } catch (error) {
    return false;
  }
}

function getUrlSlug(url: string, baseUrl: string): string {
  try {
    const urlObj = new URL(url);
    const baseUrlObj = new URL(baseUrl);

    // Get path segments for both URLs
    const urlPath = urlObj.pathname.split("/").filter(Boolean);
    const basePath = baseUrlObj.pathname.split("/").filter(Boolean);

    // Remove base path segments from URL path to get relative path
    const relativePath = urlPath.slice(basePath.length);

    // If there's no relative path, return empty string
    if (relativePath.length === 0) {
      return "";
    }

    // Join remaining path segments with /
    let slug = relativePath.join("/");

    return slug;
  } catch (error) {
    // Return a default slug if URL parsing fails
    return "invalid-url";
  }
}

async function processPage(url: string, docId: number, baseUrl: string, defaultTitle: string | null = null) {
  try {
    if (!checkBaseUrl(url, baseUrl)) {
      console.log(`${url} not part of base of ${baseUrl}`);
      return;
    }

    let title, content, description;

    const { dom, isHTML } = await fetchAndParse(url);
    if (isHTML) {
      const extracted = extractContent(dom);
      title = extracted.title;
      content = extracted.content;
      description = extracted.description;
    } else {
      title = "";
      content = dom.window.document.body.innerHTML;
      description = "";
    }

    const slug = getUrlSlug(url, baseUrl);

    const newPage: NewPage = {
      docId,
      title: defaultTitle || title || "",
      description,
      sourceContent: dom.window.document.body.innerHTML,
      processedContent: content,
      slug,
    };
    await createPage(newPage);

    return content;
  } catch (error) {
    console.error(`Error processing ${url}:`, error);
    return null;
  }
}

async function processDocumentation(libraryName: string, url: string) {
  try {
    // Check if doc already exists
    const existingDoc = await getDocsByName(libraryName);
    if (!existingDoc) {
      // Create new doc entry
      const newDoc: NewDoc = {
        name: libraryName,
        description: null,
        sourceUrl: url,
      };
      await createDoc(newDoc);
    }

    const baseUrl = url.split("/").filter(Boolean).slice(0, -1).join("/");

    const doc = existingDoc || (await getDocsByName(libraryName));
    if (!doc) throw new Error("Failed to create or retrieve doc");

    // Process the initial page and get its content
    const initialContent = await processPage(url, doc.id, baseUrl, "llms.txt");
    if (!initialContent) {
      throw new Error("Failed to process initial page");
    }

    // Extract all links from the initial page
    const links = extractLinks(initialContent);

    // Filter unique URLs
    const processedUrls = new Set<string>();
    const uniqueLinks = links.filter((link) => {
      const cleanUrl = link.href.split("#")[0];
      if (!processedUrls.has(cleanUrl) && checkBaseUrl(cleanUrl, baseUrl)) {
        processedUrls.add(cleanUrl);
        return true;
      }
      return false;
    });

    // Process all links in parallel
    const pageProcessingPromises = uniqueLinks.map((link) => processPage(link.href, doc.id, baseUrl, link.title));

    // Wait for all pages to be processed
    await Promise.all(pageProcessingPromises);

    console.log(`Finished processing ${libraryName} documentation`);
  } catch (error) {
    console.error(`Error processing documentation for ${libraryName}:`, error);
    throw error;
  }
}

for (const [name, url] of Object.entries(libraryUrls)) {
  processDocumentation(name, url);
}
