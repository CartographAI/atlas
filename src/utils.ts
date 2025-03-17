import { mkdir } from "node:fs/promises";

export async function ensureDirectoryExists(dir: string) {
  try {
    // Attempt to create the directory
    await mkdir(dir, { recursive: true });
  } catch (error) {
    console.error(`Error creating directory: ${dir}`, error);
  }
}
