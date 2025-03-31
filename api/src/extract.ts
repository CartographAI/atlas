import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import axios from "axios";
import TurndownService from "turndown";
import DOMPurify from "dompurify";
import { marked } from "marked";
import * as cheerio from "cheerio";
import { getUrlPath } from "./url";

export async function fetchURL(url: string): Promise<{ pageData: string; contentType: string }> {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:136.0) Gecko/20100101 Firefox/136.0",
      },
    });

    const pageData = response.data;
    const contentType = response.headers["content-type"];

    return { pageData, contentType };
  } catch (error) {
    throw new Error(`Failed to fetch or parse content: ${error}`);
  }
}

export function extractContent(pageData: string) {
  const dom = new JSDOM(pageData);
  const document = dom.window.document;

  // Use Readability to extract main content
  const reader = new Readability(document);
  const article = reader.parse();

  if (!article || !article.content) {
    throw new Error("Failed to parse content");
  }

  const purifiedDOM = new JSDOM(article.content);
  const purify = DOMPurify(purifiedDOM.window);
  const purifiedHTML = purify.sanitize(purifiedDOM.window.document.body.innerHTML);

  // this is what LLMs models are most comfortable with
  const turndownService = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    emDelimiter: "*",
    codeBlockStyle: "fenced",
  });

  // Convert HTML to Markdown
  const markdown = turndownService.turndown(purifiedHTML);

  return {
    title: article.title,
    content: markdown,
    description: "",
  };
}

export interface Link {
  title: string;
  href: string;
  description: string;
}

export function extractLinksFromLlmsTxt(markdown: string): Link[] {
  const links: Link[] = [];
  const html = marked(markdown) as string;
  const $ = cheerio.load(html);

  $("li a").each((_, node) => {
    const href = $(node).attr("href");
    if (href) {
      let description = "";

      const title = $(node).text().trim();
      const listItemNode = $(node).parent();
      // Clone the list item, remove the link, then get text to isolate description
      const listItemDescription = listItemNode.clone().find("a").remove().end().text().trim();

      // Check if there's a colon at the beginning
      if (listItemDescription.indexOf(":") === 0) {
        // Extract the text after the colon and trim it
        description = listItemDescription.substring(1).trim();
      } else if (listItemDescription) {
        console.warn(`List item text without leading colon: "${listItemDescription}" for link "${title}"`);
      }

      links.push({ title, href, description });
    }
  });

  return links;
}

export function extractDescription(markdown: string): string | null {
  // Match content between > and the next newline
  // only if its near the top
  const firstLines = markdown.split("\n").slice(0, 10).join("\n");
  const blockquoteRegex = /^>\s*(.+?)$/m;
  const match = firstLines.match(blockquoteRegex);

  if (match?.[1]) {
    // Return the captured content (without the > symbol and leading/trailing whitespace)
    return match[1].trim();
  }

  return null;
}

export function relativizeMarkdownLinks(markdown: string, baseUrl: string): string {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  return markdown.replace(linkRegex, (match, text, url) => {
    // The 'url' captured by the regex is the content between parentheses.
    const processedUrl = url.trim(); // Trim whitespace just in case

    try {
      // 1. Skip non-http(s) absolute URLs (mailto:, tel:, etc.) and anchors
      if (
        processedUrl.startsWith("#") ||
        (processedUrl.includes(":") && !processedUrl.startsWith("http://") && !processedUrl.startsWith("https://"))
      ) {
        return match; // Keep original link
      }

      // 2. Handle existing relative URLs (those not starting with http/https or a scheme)
      if (!processedUrl.startsWith("http://") && !processedUrl.startsWith("https://")) {
        // If it's already relative (doesn't start with /), make it root-relative
        if (!processedUrl.startsWith("/")) {
          return `[${text}](/${processedUrl})`;
        }
        // If it already starts with /, keep it as is
        return match;
      }

      // Directly call getUrlPath. It returns null (it does check for checkBaseUrl) if base doesn't match or on error.
      let relativePath = getUrlPath(processedUrl, baseUrl);
      if (relativePath !== null) {
        // Ensure path starts with /
        if (!relativePath.startsWith("/")) {
          relativePath = "/" + relativePath;
        }

        return `[${text}](${relativePath})`;
      } else {
        // Different origin: keep the original absolute URL
        return match;
      }
    } catch (e) {
      // Error parsing URL (might happen with complex or malformed URLs not fully handled by regex)
      // Keep the original link in case of error
      console.warn(`Could not parse URL in markdown link: ${url}`, e);
      return match;
    }
  });
}
