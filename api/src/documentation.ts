import { createDoc, deleteDocById, getDocsByName } from "./database/docsRepository";
import { createPage } from "./database/pagesRepository";
import type { NewDoc, NewPage } from "./types";
import {
  fetchURL,
  extractLinksFromLlmsTxt,
  extractContent,
  extractDescription,
  type Link,
  relativizeMarkdownLinks,
} from "./extract";
import { checkBaseUrl, getUrlPath } from "./url";

interface LibraryUrls {
  [key: string]: string;
}

const libraryUrls: LibraryUrls = {
  Hono: "https://hono.dev/llms.txt",
  Drizzle: "https://orm.drizzle.team/llms.txt",
  Mastra: "https://mastra.ai/llms.txt",
  Resend: "https://resend.com/docs/llms.txt",
  "Langgraph-py": "https://langchain-ai.github.io/langgraph/llms.txt",
  "Langgraph-js": "https://langchain-ai.github.io/langgraphjs/llms.txt",
  Fireworks: "https://docs.fireworks.ai/llms.txt",
  CrewAI: "https://docs.crewai.com/llms.txt",
  Stripe: "https://docs.stripe.com/llms.txt",
  Zapier: "https://docs.zapier.com/llms.txt",
  X: "https://docs.x.com/llms.txt",
  Bun: "https://bun.sh/llms.txt",
  ElevenLabs: "https://elevenlabs.io/docs/llms.txt",
  Prisma: "https://www.prisma.io/docs/llms.txt",
  ChakraUI: "https://chakra-ui.com/llms.txt",
  ModelContextProtocol: "https://modelcontextprotocol.io/llms.txt",
  "Trigger.dev": "https://trigger.dev/docs/llms.txt",
  "ast-grep": "https://ast-grep.github.io/llms.txt",
};

async function processPage(
  url: string,
  docId: number,
  baseUrl: string,
  defaultTitle: string | null = null,
  defaultDescription: string | null = null,
) {
  try {
    let title, content, description;

    const { pageData, contentType } = await fetchURL(url);

    // check if pageData is HTML or already text/markdown
    // if HTML, extract the content from it
    if (contentType.includes("text/html")) {
      const extracted = extractContent(pageData);
      title = extracted.title;
      content = extracted.content;
      description = extracted.description;
    } else {
      title = "";
      content = pageData;
      description = extractDescription(pageData);
    }

    const path = getUrlPath(url, baseUrl);

    const updatedContent = relativizeMarkdownLinks(content, baseUrl);

    const newPage: NewPage = {
      docId,
      // needs to be improved in the future
      title: (defaultTitle || title || "").trim(),
      description: (defaultDescription || description)?.trim(),
      sourceContent: pageData,
      processedContent: updatedContent.trim(),
      path,
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
    // Delete doc if it already exists
    let doc = await getDocsByName(libraryName);
    if (doc) {
      await deleteDocById(doc.id);
    }

    // Create new doc entry
    const newDoc: NewDoc = {
      name: libraryName,
      description: null,
      sourceUrl: url,
    };
    doc = await createDoc(newDoc);

    const baseUrl = url.split("/").filter(Boolean).slice(0, -1).join("/");

    // Process the initial page and get its content
    const initialContent = await processPage(url, doc.id, baseUrl, "llms.txt");
    if (!initialContent) {
      throw new Error("Failed to process initial page");
    }

    // Extract all links from the initial page
    const links = extractLinksFromLlmsTxt(initialContent);

    const processedUrls = new Set<string>();

    // Handle relative URLs
    const absoluteLinks: Link[] = links
      .filter((link) => !link.href.startsWith("#")) // filter relative subheading links
      .map((link) => {
        try {
          return { title: link.title, description: link.description, href: new URL(link.href, url).href }; // Resolve relative URLs
        } catch (e) {
          return null; // Invalid URL
        }
      })
      .filter((link): link is Link => link !== null);

    // Filter unique URLs
    const uniqueLinks = absoluteLinks.filter((link) => {
      const cleanUrl = link.href.split("#")[0];
      if (!processedUrls.has(cleanUrl) && checkBaseUrl(cleanUrl, baseUrl)) {
        processedUrls.add(cleanUrl);
        return true;
      }
      return false;
    });

    // Process all links in parallel
    const pageProcessingPromises = uniqueLinks.map((link) =>
      processPage(link.href, doc.id, baseUrl, link.title, link.description),
    );

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
