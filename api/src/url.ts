export function checkBaseUrl(url: string, baseUrl: string): boolean {
  try {
    const urlObj = new URL(url);
    const baseUrlObj = new URL(baseUrl);

    // Check hostname matches
    if (urlObj.hostname !== baseUrlObj.hostname) return false;

    // Get path segments (removing empty strings from split)
    const urlPath = urlObj.pathname.split("/").filter(Boolean);
    const basePath = baseUrlObj.pathname.split("/").filter(Boolean);

    // Check if url path starts with base path front
    const urlPathFront = urlPath.slice(0, basePath.length);
    if (!basePath.every((segment, i) => segment === urlPathFront[i])) return false;

    return true;
  } catch (error) {
    return false;
  }
}

export function getUrlSlug(url: string, baseUrl: string): string {
  try {
    const urlObj = new URL(url);
    const baseUrlObj = new URL(baseUrl);

    // Get path segments for both URLs
    const urlPath = urlObj.pathname.split("/").filter(Boolean);
    const basePath = baseUrlObj.pathname.split("/").filter(Boolean);

    // Remove base path segments from URL path to get relative path
    const relativePath = urlPath.slice(basePath.length);

    // If there's no relative path, return empty string
    if (relativePath.length === 0) {
      return "";
    }

    // Join remaining path segments with /
    const slug = relativePath.join("/");

    return slug;
  } catch (error) {
    // Return a default slug if URL parsing fails
    return "invalid-url";
  }
}
