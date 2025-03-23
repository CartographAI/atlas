import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import axios from "axios";
import TurndownService from "turndown";
import DOMPurify from "dompurify";

async function fetchAndParse(url: string): Promise<JSDOM> {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:136.0) Gecko/20100101 Firefox/136.0",
      },
    });

    // Create a DOM from the HTML
    const dom = new JSDOM(response.data, { url });
    return dom;
  } catch (error) {
    throw new Error(`Failed to fetch or parse content: ${error}`);
  }
}

function extractContent(dom: JSDOM) {
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
    excerpt: article.excerpt,
  };
}

function extractLinks(dom: JSDOM): string[] {
  const links: string[] = [];
  const document = dom.window.document;

  document.querySelectorAll("a").forEach((link) => {
    const href = link.getAttribute("href");
    if (href) {
      try {
        // Convert relative URLs to absolute
        const absoluteUrl = new URL(href, dom.window.location.href).href;
        links.push(absoluteUrl);
      } catch (e) {
        // Skip invalid URLs
      }
    }
  });

  return links;
}

async function processUrl(url: string) {
  const dom = await fetchAndParse(url);
  const result = extractContent(dom);
  const links = extractLinks(dom);
  console.log(result);
  console.log(links);
}
processUrl("https://hono.dev/docs/guides/validation");
processUrl("https://svelte.dev/docs/svelte/faq");
