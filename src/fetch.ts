import { parseHTML } from "linkedom";

export async function fetchAndExtractContent(url: string): Promise<string> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const { document } = parseHTML(html);

    // Try to find a main content container
    let mainContent =
      document.querySelector("main") ||
      document.querySelector("article") ||
      document.querySelector("#content") ||
      document.querySelector(".content"); // Common selectors

    // If no specific container, use the <body>
    if (!mainContent) {
      console.log("no main content found, using body");
      mainContent = document.body;
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
        const elementsToRemove = mainContent.querySelectorAll(selector);
        for (const element of elementsToRemove) {
          element.remove(); // Remove the element from the DOM
        }
      }

      return mainContent.textContent || ""; // Extract the text content, return empty string if null
    }

    return ""; // Return empty string if no content found
  } catch (error) {
    console.error("Error:", error);
    return ""; // Return an empty string on error
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
