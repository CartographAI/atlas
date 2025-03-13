import * as cheerio from "cheerio";

export async function fetchAndParse(url: string): Promise<cheerio.Root> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  return cheerio.load(html);
}

export async function extractContent($: cheerio.Root): Promise<string> {
  try {
    // Try to find a main content container
    let mainContent = $("main") || $("article") || $("#content") || $(".content"); // Common selectors

    // If no specific container, use the <body>
    if (!mainContent) {
      console.log("no main content found, using body");
      mainContent = $("body");
    }

    // Remove common unwanted elements (navigation, footers, sidebars, etc.)
    if (mainContent) {
      const unwantedSelectors = [
        "nav",
        "footer",
        "aside",
        ".sidebar",
        "#sidebar",
        ".navigation",
        "#navigation",
        ".menu",
        "#menu",
        ".ads", // Example: Remove elements with class "ads"
        "#ads",
        "script", //remove script tags
        "style", //remove style tags
        "noscript", //remove noscript tags
      ];

      for (const selector of unwantedSelectors) {
        $(selector).remove(); // Remove the element from the DOM
      }

      return mainContent.text(); // Extract the text content, return empty string if null
    }

    return ""; // Return empty string if no content found
  } catch (error) {
    console.error("Error:", error);
    return ""; // Return an empty string on error
  }
}

export async function extractLinks($: cheerio.Root): Promise<string[]> {
  try {
    const links: string[] = [];

    $("a").each((_, element) => {
      const href = $(element).attr("href");
      if (href) {
        links.push(href);
      }
    });
    return links;
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
}

// --- Main Execution ---
if (import.meta.main) {
  const url = Bun.argv[2];

  if (!url) {
    console.error("Please provide a URL as a command-line argument.");
    process.exit(1);
  }
  if (!URL.canParse(url)) {
    console.error("Please provide a valid URL as a command-line argument.");
    process.exit(1); // Exit with an error code
  }

  fetchAndExtractContent(url).then((content) => {
    console.log(content);
  });
}
