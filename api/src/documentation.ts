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
  extractLinksFromHtml,
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
  Svelte: "https://svelte.dev/docs/svelte/overview",
  SvelteKit: "https://svelte.dev/docs/kit/introduction",
  Pglite: "https://pglite.dev/docs/about",
  Astro: "https://docs.astro.build/en/getting-started",
  "AI-SDK": "https://sdk.vercel.ai/docs/introduction",
  "shadcn/ui": "https://ui.shadcn.com/docs",
  "TanStack-Router": "https://tanstack.com/router/latest/docs/framework/react/overview",
  tailwindcss: "https://tailwindcss.com/docs/installation",
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

    if (path === null) {
      // this is unexpected, since we already did a checkBaseUrl in processDocumentation to filter
      throw new Error(`path for ${url} and ${baseUrl} was null`);
    }

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
  console.log(`Start processing ${libraryName} documentation`);
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

    const parts = url.split("/").filter(Boolean);
    const withoutLastSegmentPath = parts.slice(0, -1).join("/");
    const lastSegmentPath = parts[parts.length - 1];

    let llmsTxtContent: string | null = null;

    if (lastSegmentPath !== "llms.txt") {
      const { pageData, contentType } = await fetchURL(url);

      const links = extractLinksFromHtml(pageData);
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

      const processedUrls = new Set<string>();

      // Filter unique URLs
      const uniqueLinks = absoluteLinks.filter((link) => {
        const cleanUrl = link.href.split("#")[0];
        if (!processedUrls.has(cleanUrl) && checkBaseUrl(cleanUrl, withoutLastSegmentPath)) {
          processedUrls.add(cleanUrl);
          return true;
        }
        return false;
      });

      const llmsTxtContentFullLinks = `
# ${libraryName}

## Docs

${uniqueLinks.map((link) => `- [${link.title.replaceAll("<", "\\<").replaceAll(">", "\\>")}](${link.href})`).join("\n")}
`;

      llmsTxtContent = relativizeMarkdownLinks(llmsTxtContentFullLinks, withoutLastSegmentPath);

      const newPage: NewPage = {
        docId: doc.id,
        title: "llms.txt",
        description: "",
        sourceContent: pageData,
        processedContent: llmsTxtContent.trim(),
        path: "/llms.txt",
      };
      await createPage(newPage);
    } else {
      // Process the initial page and get its content
      llmsTxtContent = await processPage(url, doc.id, withoutLastSegmentPath, "llms.txt");
    }

    if (!llmsTxtContent) {
      throw new Error("No llmsTxtContent created");
    }

    // Extract all links from the initial page
    const links = extractLinksFromLlmsTxt(llmsTxtContent);

    const processedUrls = new Set<string>();

    // Handle relative URLs
    const absoluteLinks: Link[] = links
      .filter((link) => !link.href.startsWith("#")) // filter relative subheading links
      .map((link) => {
        try {
          const slug = link.href;
          const relativePath = slug.startsWith("/") ? slug.substring(1) : slug;
          return { ...link, href: new URL(relativePath, url).href }; // Resolve relative URLs
        } catch (e) {
          return null; // Invalid URL
        }
      })
      .filter((link): link is Link => link !== null);

    // Filter unique URLs
    const uniqueLinks = absoluteLinks.filter((link) => {
      const cleanUrl = link.href.split("#")[0];
      if (!processedUrls.has(cleanUrl) && checkBaseUrl(cleanUrl, withoutLastSegmentPath)) {
        processedUrls.add(cleanUrl);
        return true;
      }
      return false;
    });

    // Process all links in parallel
    const pageProcessingPromises = uniqueLinks.map((link) =>
      processPage(link.href, doc.id, withoutLastSegmentPath, link.title, link.description),
    );

    // Wait for all pages to be processed
    await Promise.all(pageProcessingPromises);

    console.log(`Finished processing ${libraryName} documentation (${uniqueLinks.length} pages).`);
  } catch (error) {
    console.error(`Error processing documentation for ${libraryName}:`, error);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: bun run src/documentation.ts --all | <library names...>");
    process.exit(0);
  }

  if (args[0] === "--all") {
    // Process all libraries sequentially
    for (const [name, url] of Object.entries(libraryUrls)) {
      await processDocumentation(name, url);
    }
  } else {
    // Process only specified libraries
    for (const libraryName of args) {
      const url = libraryUrls[libraryName];
      if (!url) {
        console.error(`Library "${libraryName}" not found in libraryUrls`);
        continue;
      }
      await processDocumentation(libraryName, url);
    }
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
