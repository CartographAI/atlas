import { describe, it, expect } from "vitest";
import { checkBaseUrl, getUrlPath } from "../src/url";

describe("url.ts", () => {
  describe("checkBaseUrl", () => {
    const baseUrl = "https://example.com/docs/v1";

    it("should return true for URLs within the base path", () => {
      expect(checkBaseUrl("https://example.com/docs/v1/getting-started", baseUrl)).toBe(true);
      expect(checkBaseUrl("https://example.com/docs/v1/api/methods", baseUrl)).toBe(true);
      expect(checkBaseUrl("https://example.com/docs/v1/", baseUrl)).toBe(true); // Trailing slash
      expect(checkBaseUrl("https://example.com/docs/v1", baseUrl)).toBe(true); // Exact match
    });

    it("should return true for URLs within the base path with query params/fragments", () => {
      expect(checkBaseUrl("https://example.com/docs/v1/getting-started?param=1#section", baseUrl)).toBe(true);
    });

    it("should return false for URLs outside the base path but same host", () => {
      expect(checkBaseUrl("https://example.com/docs/v2/getting-started", baseUrl)).toBe(false);
      expect(checkBaseUrl("https://example.com/other/path", baseUrl)).toBe(false);
      expect(checkBaseUrl("https://example.com/docs", baseUrl)).toBe(false); // Path shorter than base
      expect(checkBaseUrl("https://example.com/", baseUrl)).toBe(false);
    });

    it("should return false for URLs with different hostnames", () => {
      expect(checkBaseUrl("https://anotherexample.com/docs/v1/getting-started", baseUrl)).toBe(false);
    });

    it("should handle root base URL", () => {
      const rootBase = "https://example.com/";
      expect(checkBaseUrl("https://example.com/page1", rootBase)).toBe(true);
      expect(checkBaseUrl("https://example.com/dir/page2", rootBase)).toBe(true);
      expect(checkBaseUrl("https://example.com/", rootBase)).toBe(true);
      expect(checkBaseUrl("https://other.com/", rootBase)).toBe(false);
    });

    it("should handle base URL without path", () => {
      const hostBase = "https://example.com";
      expect(checkBaseUrl("https://example.com/page1", hostBase)).toBe(true);
      expect(checkBaseUrl("https://example.com/dir/page2", hostBase)).toBe(true);
      expect(checkBaseUrl("https://example.com/", hostBase)).toBe(true);
      expect(checkBaseUrl("https://other.com/", hostBase)).toBe(false);
    });

    it("should return false for invalid URLs", () => {
      expect(checkBaseUrl("invalid-url", baseUrl)).toBe(false);
      expect(checkBaseUrl("https://example.com/docs/v1", "invalid-base")).toBe(false);
    });
  });

  describe("getUrlPath", () => {
    const baseUrl = "https://example.com/docs/v1";

    it("should return the relative path", () => {
      expect(getUrlPath("https://example.com/docs/v1/getting-started", baseUrl)).toBe("getting-started");
      expect(getUrlPath("https://example.com/docs/v1/api/methods", baseUrl)).toBe("api/methods");
      expect(getUrlPath("https://example.com/docs/v1/api/methods/", baseUrl)).toBe("api/methods"); // Trailing slash on URL
    });

    it("should return empty string for URL identical to base URL", () => {
      expect(getUrlPath("https://example.com/docs/v1", baseUrl)).toBe("");
      expect(getUrlPath("https://example.com/docs/v1/", baseUrl)).toBe(""); // Trailing slash
    });

    it("should ignore query parameters and fragments", () => {
      expect(getUrlPath("https://example.com/docs/v1/getting-started?param=1#section", baseUrl)).toBe(
        "getting-started",
      );
    });

    it("should handle base URL with trailing slash", () => {
      const baseWithSlash = "https://example.com/docs/v1/";
      expect(getUrlPath("https://example.com/docs/v1/getting-started", baseWithSlash)).toBe("getting-started");
      expect(getUrlPath("https://example.com/docs/v1/api/methods", baseWithSlash)).toBe("api/methods");
      expect(getUrlPath("https://example.com/docs/v1/", baseWithSlash)).toBe("");
    });

    it("should handle root base URL", () => {
      const rootBase = "https://example.com/";
      expect(getUrlPath("https://example.com/page1", rootBase)).toBe("page1");
      expect(getUrlPath("https://example.com/dir/page2", rootBase)).toBe("dir/page2");
      expect(getUrlPath("https://example.com/", rootBase)).toBe("");
    });

    it("should handle base URL without path", () => {
      const hostBase = "https://example.com";
      expect(getUrlPath("https://example.com/page1", hostBase)).toBe("page1");
      expect(getUrlPath("https://example.com/dir/page2", hostBase)).toBe("dir/page2");
      expect(getUrlPath("https://example.com/", hostBase)).toBe("");
    });

    it('should return "invalid-url" for invalid inputs', () => {
      expect(getUrlPath("invalid-url", baseUrl)).toBe(null);
      expect(getUrlPath("https://example.com/docs/v1/page", "invalid-base")).toBe(null);
      expect(getUrlPath("https://anotherexample.com/unrelated", baseUrl)).toBe(null);
      expect(getUrlPath("https://example.com/other", baseUrl)).toBe(null);
    });
  });
});
