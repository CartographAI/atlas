import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import axios from "axios";
import TurndownService from "turndown";
import DOMPurify from "dompurify";
import { marked } from "marked";
import * as cheerio from "cheerio";

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
    description: article.excerpt,
  };
}

interface Link {
  title: string;
  href: string;
}

export function extractLinks(markdown: string): Link[] {
  const links: Link[] = [];
  const html = marked(markdown);
  const $ = cheerio.load(html);

  $("a").each((_, node) => {
    const href = $(node).attr("href");
    if (href) {
      links.push({ title: $(node).text(), href });
    }
  });

  return links;
}

async function processUrl(url: string) {
  const dom = await fetchAndParse(url);
  const result = extractContent(dom);
  const links = extractLinks(result.content);
  console.log(result);
  console.log(links);
}
processUrl("https://hono.dev/docs/guides/validation");
processUrl("https://svelte.dev/docs/svelte/faq");
processUrl("https://resend.com/docs/llms.txt");
