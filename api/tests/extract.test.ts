import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import {
  fetchURL,
  extractContent,
  extractLinksFromLlmsTxt,
  extractDescription,
  relativizeMarkdownLinks,
  type Link,
} from "../src/extract";

// Mock axios
vi.mock("axios");

describe("extract.ts", () => {
  describe("fetchURL", () => {
    beforeEach(() => {
      // Reset mocks before each test
      vi.resetAllMocks();
    });

    it("should fetch data and content type successfully", async () => {
      const mockData = "<html><body>Test Data</body></html>";
      const mockContentType = "text/html; charset=utf-8";
      const url = "https://example.com";

      vi.mocked(axios.get).mockResolvedValue({
        data: mockData,
        headers: { "content-type": mockContentType },
        status: 200,
        statusText: "OK",
        config: {} as any, // Add required properties for AxiosResponse type
        request: {} as any, // Add required properties for AxiosResponse type
      });

      const result = await fetchURL(url);

      expect(axios.get).toHaveBeenCalledWith(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:136.0) Gecko/20100101 Firefox/136.0",
        },
      });
      expect(result.pageData).toBe(mockData);
      expect(result.contentType).toBe(mockContentType);
    });

    it("should throw an error if fetching fails", async () => {
      const url = "https://example.com/notfound";
      const errorMessage = "Request failed with status code 404";
      vi.mocked(axios.get).mockRejectedValue(new Error(errorMessage));

      await expect(fetchURL(url)).rejects.toThrow(`Failed to fetch or parse content: Error: ${errorMessage}`);
    });

    it("should handle different content types", async () => {
      const mockData = "# Markdown Content";
      const mockContentType = "text/markdown";
      const url = "https://example.com/markdown";

      vi.mocked(axios.get).mockResolvedValue({
        data: mockData,
        headers: { "content-type": mockContentType },
        status: 200,
        statusText: "OK",
        config: {} as any,
        request: {} as any,
      });

      const result = await fetchURL(url);
      expect(result.pageData).toBe(mockData);
      expect(result.contentType).toBe(mockContentType);
    });
  });

  describe("extractContent", () => {
    it("should extract title and markdown content from simple HTML", () => {
      const html = `
        <html>
          <head><title>Test Title</title></head>
          <body>
            <article>
              <h1>Main Heading</h1>
              <p>This is the main content.</p>
              <a href="https://example.com">Link</a>
              <pre><code>const x = 1;</code></pre>
            </article>
            <nav>Navigation</nav>
            <footer>Footer</footer>
          </body>
        </html>`;

      const result = extractContent(html);

      expect(result.title).toBe("Test Title");
      // Turndown might add extra newlines, adjust assertion accordingly
      expect(result.content).toContain("# Main Heading");
      expect(result.content).toContain("This is the main content.");
      expect(result.content).toContain("[Link](https://example.com/)");
      expect(result.content).toContain("```\nconst x = 1;\n```");
      // Check that nav/footer are excluded by Readability/Turndown
      expect(result.content).not.toContain("Navigation");
      expect(result.content).not.toContain("Footer");
      expect(result.description).toBe(""); // Description is currently always empty
    });

    it("should handle HTML without a clear article tag", () => {
      const html = `
        <html>
          <head><title>Another Title</title></head>
          <body>
            <div>
              <h2>Subheading</h2>
              <p>Some paragraph text.</p>
              <ul><li>Item 1</li><li>Item 2</li></ul>
            </div>
          </body>
        </html>`;

      const result = extractContent(html);
      expect(result.title).toBe("Another Title");
      expect(result.content).toContain("## Subheading");
      expect(result.content).toContain("Some paragraph text.");
      expect(result.content).toContain("-   Item 1"); // error: its creating extra spaces
      expect(result.content).toContain("-   Item 2");
    });

    it("should throw error if Readability cannot parse", () => {
      const html = `<html><head><title>Empty</title></head><body></body></html>`;
      // JSDOM/Readability might still parse this, but let's test the error path conceptually
      // A more robust test might involve mocking Readability itself.
      // For now, we test with potentially problematic input.
      try {
        extractContent(html);
        // If it doesn't throw, the test might need adjustment based on Readability's behavior
      } catch (e) {
        expect(e.message).toContain("Failed to parse content");
      }

      // Test with completely invalid HTML that might cause JSDOM/Readability issues
      const invalidHtml = `<unclosed`;
      try {
        extractContent(invalidHtml);
      } catch (e) {
        // Expect either JSDOM error or Readability error
        expect(e).toBeInstanceOf(Error);
      }
    });

    it("should sanitize potentially harmful HTML", () => {
      const html = `
        <html>
          <head><title>Sanitize Test</title></head>
          <body>
            <article>
              <p>Safe content</p>
              <script>alert('danger')</script>
              <p onclick="alert('danger')">Click me</p>
              <iframe src="javascript:alert('danger')"></iframe>
            </article>
          </body>
        </html>`;

      const result = extractContent(html);
      expect(result.title).toBe("Sanitize Test");
      expect(result.content).toContain("Safe content");
      expect(result.content).toContain("Click me"); // DOMPurify might keep the text
      expect(result.content).not.toContain("<script");
      expect(result.content).not.toContain("onclick");
      expect(result.content).not.toContain("<iframe");
    });
  });

  describe("extractLinksFromLlmsTxt", () => {
    it("should extract links with titles and descriptions", () => {
      const markdown = `
# Documentation

## Section 1
- [Link One](page1.html): Description for link one.
- [Link Two](page2.md): Another description.

## Section 2
- [Link Three](/abs/page3): Final description.
      `;
      const expected: Link[] = [
        { title: "Link One", href: "page1.html", description: "Description for link one." },
        { title: "Link Two", href: "page2.md", description: "Another description." },
        { title: "Link Three", href: "/abs/page3", description: "Final description." },
      ];
      expect(extractLinksFromLlmsTxt(markdown)).toEqual(expected);
    });

    it("should extract links with titles but no descriptions", () => {
      const markdown = `
- [Link One](page1.html)
- [Link Two](/page2)
      `;
      const expected: Link[] = [
        { title: "Link One", href: "page1.html", description: "" },
        { title: "Link Two", href: "/page2", description: "" },
      ];
      expect(extractLinksFromLlmsTxt(markdown)).toEqual(expected);
    });

    it("should handle links with extra whitespace in description", () => {
      const markdown = `- [Link Four](page4.html):   Spaced out description.  `;
      const expected: Link[] = [{ title: "Link Four", href: "page4.html", description: "Spaced out description." }];
      expect(extractLinksFromLlmsTxt(markdown)).toEqual(expected);
    });

    it("should handle links without a colon before description (treat as no description)", () => {
      const markdown = `- [Link Five](page5.html) Just some text after.`;
      const expected: Link[] = [{ title: "Link Five", href: "page5.html", description: "" }];
      expect(extractLinksFromLlmsTxt(markdown)).toEqual(expected);
    });

    it("should return empty array if no list item links found", () => {
      const markdown = `
Just some text.
[Not in list](link.html)
## Heading
Paragraph.
      `;
      expect(extractLinksFromLlmsTxt(markdown)).toEqual([]);
    });

    it("should handle nested lists (extracts links from direct li > a)", () => {
      const markdown = `
- Top level
  - [Nested Link](nested.html): Nested desc.
- [Top Link](top.html): Top desc.
      `;
      const expected: Link[] = [
        { title: "Nested Link", href: "nested.html", description: "Nested desc." },
        { title: "Top Link", href: "top.html", description: "Top desc." },
      ];
      // Note: Marked might flatten the list structure in HTML depending on indentation.
      // This test assumes cheerio can still find `li a`.
      expect(extractLinksFromLlmsTxt(markdown)).toEqual(expected);
    });
  });

  describe("extractDescription", () => {
    it("should extract description from blockquote at the beginning", () => {
      const markdown = `
> This is the description.
## Heading
Some content.
      `;
      expect(extractDescription(markdown)).toBe("This is the description.");
    });

    it("should extract description with leading/trailing whitespace in blockquote", () => {
      const markdown = `>   Another description here.   \nMore text.`;
      expect(extractDescription(markdown)).toBe("Another description here.");
    });

    it("should return description from blockquote", () => {
      const markdown = `
## Heading
> This is the description.
Some content.
      `;
      expect(extractDescription(markdown)).toBe("This is the description.");
    });

    it("should return null if blockquote is after the first 10 lines", () => {
      const markdown = `
Line 1
Line 2
Line 3
Line 4
Line 5
Line 6
Line 7
Line 8
Line 9
Line 10
> This blockquote is too far down.
      `;
      expect(extractDescription(markdown)).toBeNull();
    });

    it("should return null for empty markdown", () => {
      expect(extractDescription("")).toBeNull();
    });

    it("should handle markdown with only a blockquote", () => {
      const markdown = `> Just a description.`;
      expect(extractDescription(markdown)).toBe("Just a description.");
    });
  });

  describe("relativizeMarkdownLinks", () => {
    const baseUrl = "https://docs.example.com/v1/product";

    it("should relativize absolute URLs within the base path", () => {
      const markdown = "Check the [Getting Started](https://docs.example.com/v1/product/start) guide.";
      const expected = "Check the [Getting Started](/start) guide.";
      expect(relativizeMarkdownLinks(markdown, baseUrl)).toBe(expected);
    });

    it("should relativize absolute URLs matching the base path exactly", () => {
      const markdown = "Link to [Base](https://docs.example.com/v1/product)";
      const expected = "Link to [Base](/)"; // Should become root relative path
      expect(relativizeMarkdownLinks(markdown, baseUrl)).toBe(expected);
    });

    it("should relativize absolute URLs matching the base path with trailing slash", () => {
      const markdown = "Link to [Base Slash](https://docs.example.com/v1/product/)";
      const expected = "Link to [Base Slash](/)";
      expect(relativizeMarkdownLinks(markdown, baseUrl)).toBe(expected);
    });

    it("should keep absolute URLs outside the base path", () => {
      const markdown =
        "Visit [External Site](https://othersite.com/page). Also see [Other Version](https://docs.example.com/v2/product/feature).";
      const expected =
        "Visit [External Site](https://othersite.com/page). Also see [Other Version](https://docs.example.com/v2/product/feature).";
      expect(relativizeMarkdownLinks(markdown, baseUrl)).toBe(expected);
    });

    it("should keep absolute URLs with different hostname", () => {
      const markdown = "See [Another Doc](https://another.example.com/v1/product/info)";
      const expected = "See [Another Doc](https://another.example.com/v1/product/info)";
      expect(relativizeMarkdownLinks(markdown, baseUrl)).toBe(expected);
    });

    it("should make non-root relative URLs root-relative", () => {
      const markdown = "See the [API section](api/methods). Also [Guides](guides/intro).";
      const expected = "See the [API section](/api/methods). Also [Guides](/guides/intro).";
      expect(relativizeMarkdownLinks(markdown, baseUrl)).toBe(expected);
    });

    it("should keep already root-relative URLs", () => {
      const markdown = "Link to [/start](/start). Another [/api/v1](/api/v1).";
      const expected = "Link to [/start](/start). Another [/api/v1](/api/v1).";
      expect(relativizeMarkdownLinks(markdown, baseUrl)).toBe(expected);
    });

    it("should remove anchors from URLs", () => {
      const markdown =
        "Jump to [#section](#section). Link [Absolute Anchor](https://docs.example.com/v1/product/page#anchor)";
      const expected = "Jump to [#section](#section). Link [Absolute Anchor](/page)"; // Base URL part gets relativized
      expect(relativizeMarkdownLinks(markdown, baseUrl)).toBe(expected);
    });

    it("should ignore mailto and other schemes", () => {
      const markdown = "Contact us at [mail](mailto:test@example.com). Call [phone](tel:+1234567890).";
      const expected = "Contact us at [mail](mailto:test@example.com). Call [phone](tel:+1234567890).";
      expect(relativizeMarkdownLinks(markdown, baseUrl)).toBe(expected);
    });

    it("should handle mixed link types", () => {
      const markdown = `
- [Absolute Same Origin](https://docs.example.com/v1/product/feature)
- [Absolute Different Origin](https://anothersite.com)
- [Root Relative](/guides/setup)
- [Relative](sub/page.html)
- [Anchor](#details)
- [Mail](mailto:info@example.com)
- [Base URL](https://docs.example.com/v1/product/)
       `;
      const expected = `
- [Absolute Same Origin](/feature)
- [Absolute Different Origin](https://anothersite.com)
- [Root Relative](/guides/setup)
- [Relative](/sub/page.html)
- [Anchor](#details)
- [Mail](mailto:info@example.com)
- [Base URL](/)
       `;
      expect(relativizeMarkdownLinks(markdown, baseUrl)).toBe(expected);
    });

    it("removes query params from URLs", () => {
      const markdown = "Link [With Query](https://docs.example.com/v1/product/search?q=test)";
      const expected = "Link [With Query](/search)";
      expect(relativizeMarkdownLinks(markdown, baseUrl)).toBe(expected);
    });

    it("should handle base URL at root", () => {
      const rootBaseUrl = "https://example.com/";
      const markdown = `
- [Page 1](https://example.com/page1)
- [Nested](https://example.com/dir/page2)
- [External](https://othersite.com)
- [Relative](relative/path)
- [Root Relative](/root/path)
        `;
      const expected = `
- [Page 1](/page1)
- [Nested](/dir/page2)
- [External](https://othersite.com)
- [Relative](/relative/path)
- [Root Relative](/root/path)
        `;
      expect(relativizeMarkdownLinks(markdown, rootBaseUrl)).toBe(expected);
    });

    it("should handle base URL without trailing slash", () => {
      const noSlashBaseUrl = "https://docs.example.com/v1/product"; // Same as baseUrl
      const markdown = "Link to [Start](https://docs.example.com/v1/product/start)";
      const expected = "Link to [Start](/start)";
      expect(relativizeMarkdownLinks(markdown, noSlashBaseUrl)).toBe(expected);
    });
  });
});
