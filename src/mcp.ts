#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ToolSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { indexPage } from "./pageIndexer";

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

const libraryToURL: { [key: string]: string } = {
  svelte: "https://svelte.dev/docs/svelte",
};

const IndexArgsSchema = z
  .object({
    name: z.string().optional().describe("name of library/framework to index"),
    url: z.string().optional().describe("url of website to crawl and index"),
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
        description: "Indexes the website a exposes the website",
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
          await indexPage(url);
        } else {
          if (name in libraryToURL) {
            await indexPage(libraryToURL[name]);
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
async function runServer() {
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
