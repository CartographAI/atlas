import { parseHTML } from "linkedom";

export async function extractLinks(url: string): Promise<string[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    const html = await response.text();
    const { document } = parseHTML(html);
    const links: string[] = [];

    const anchorElements = document.querySelectorAll("a"); // Get all <a> elements
    for (const a of anchorElements) {
      const href = a.getAttribute("href");
      if (href) {
        links.push(href);
      }
    }
    return links;
  } catch (error) {
    console.error("Error:", error);
    return [];
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

  extractLinks(url).then((links) => {
    if (links.length > 0) {
      console.log("Links found:");
      links.forEach((link) => console.log(link));
    } else {
      console.log("No links found on the page.");
    }
  });
}
