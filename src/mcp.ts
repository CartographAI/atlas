#!/usr/bin/env node

import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ToolSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { indexPage } from "./pageIndexer";
import { ensureDirectoryExists } from "./utils";

const server = new Server(
  {
    name: "mcp-server-atlas",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const cacheDirectory = path.join(os.homedir(), ".cache", "atlas");
await ensureDirectoryExists(cacheDirectory);
const db = new PGlite(cacheDirectory);
const schemaSql = await Bun.file("src/db/schema.sql").text();
await db.exec(schemaSql);

const libraryToURL: { [key: string]: string } = {
  react: "https://react.dev/reference/react",
  svelte: "https://svelte.dev/docs/svelte",
};

const IndexArgsSchema = z
  .object({
    name: z
      .string()
      .optional()
      .describe(
        "The name of a supported library or framework (e.g., 'react'/'svelte'). If provided, the tool will automatically use the corresponding documentation URL.",
      ),
    url: z
      .string()
      .optional()
      .describe(
        "The direct URL of a documentation website to crawl and index. Use this when the library name isn't in the predefined list or when indexing a custom documentation site",
      ),
  })
  .refine((data) => data.name || data.url, {
    message: "At least one of 'name' or 'url' is required",
  });

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "index",
        description:
          "Indexes and processes a documentation website to make it programmatically accessible. This tool crawls the specified website, extracts relevant content, and structures it for easy querying. Supports both direct URL input and predefined library names (e.g., 'react'/'svelte') for common documentation sites.",
        inputSchema: zodToJsonSchema(IndexArgsSchema) as ToolInput,
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "index": {
        const parsedArgs = IndexArgsSchema.safeParse(args);
        if (!parsedArgs.success) {
          throw new Error(`Invalid arguments for index: ${parsedArgs.error}`);
        }

        const name = parsedArgs.data.name;
        const url = parsedArgs.data.url;

        if (url) {
          await indexPage(url, db);
        } else if (name && name in libraryToURL) {
          await indexPage(libraryToURL[name], db);
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Documentation URL not found for ${name}, please use the URL of the documentation site.`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: "Page indexed sucessfully" }],
        };
      }
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Start server
export async function runServer() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Server Atlas running on stdio");
  } catch (error) {
    console.error("Error during server setup:", error);
    process.exit(1);
  }
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
