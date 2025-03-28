#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ToolSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const ATLAS_BASE_URL = `${process.env.ATLAS_BASE_URL ?? ""}/api`;

const server = new Server(
  {
    name: "docs-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Schema definitions
const ListDocsSchema = z.object({});

const LlmsTxtSchema = z.object({
  docName: z
    .string()
    .describe(
      "The unique identifier or name of the documentation set you want to explore. Get this from list_docs first if you're unsure.",
    ),
});

const LlmsFullTxtSchema = z.object({
  docName: z
    .string()
    .describe(
      "The unique identifier or name of the documentation set you want to explore. Get this from list_docs first if you're unsure.",
    ),
});

const GetPageSchema = z.object({
  docName: z
    .string()
    .describe(
      "The unique identifier or name of the documentation set you want to explore. Get this from list_docs first if you're unsure.",
    ),
  pageSlug: z
    .string()
    .describe(
      "The root-relative path (slug) of the specific documentation page (e.g., '/guides/getting-started', '/api/authentication'). This is typically obtained from search results or documentation structure.",
    ),
});

const SearchPageSchema = z.object({
  docName: z
    .string()
    .describe(
      "The unique identifier or name of the documentation set you want to explore. Get this from list_docs first if you're unsure.",
    ),
  searchQuery: z
    .string()
    .describe(
      "The search terms or phrase to look for within the documentation. This can include keywords, function names, concepts, or any text you want to find in the documentation.",
    ),
});

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

async function fetchApi(path: string) {
  const response = await fetch(`${ATLAS_BASE_URL}${path}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "API request failed");
  }
  return response.json();
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_docs",
        description:
          "Lists all available documentation libraries and frameworks. Use this first to discover what documentation is available and get basic metadata about each documentation set. Returns a list of documentation sets with their names, descriptions, and types.",
        inputSchema: zodToJsonSchema(ListDocsSchema) as ToolInput,
      },
      {
        name: "llms_txt",
        description:
          "Retrieves a condensed, LLM-friendly index of a documentation set. Use this when you need a high-level understanding of what topics and concepts are covered in a library's documentation. This is ideal for initial exploration or when you need to determine which parts of the documentation are relevant to a user's query.",
        inputSchema: zodToJsonSchema(LlmsTxtSchema) as ToolInput,
      },
      {
        name: "llms_full_txt",
        description:
          "Retrieves the complete documentation content in a single consolidated file. Use this when you need comprehensive knowledge about a library or when you need to search through the entire documentation for specific details. Note that this returns a larger volume of text.",
        inputSchema: zodToJsonSchema(LlmsFullTxtSchema) as ToolInput,
      },
      {
        name: "get_page",
        description:
          "Retrieves a specific documentation page's content using its slug (root-relative path). Use this when you already know which page contains the information you need, or after using search to identify relevant pages. This provides detailed information about a specific topic, function, or feature.",
        inputSchema: zodToJsonSchema(GetPageSchema) as ToolInput,
      },
      {
        name: "search_page",
        description:
          "Searches through a documentation set for pages matching a specific query. Use this when you need to find relevant pages or sections within a documentation set that contain specific keywords, concepts, or topics. Returns a list of matching pages with their relevance scores, slugs, and descriptions.",
        inputSchema: zodToJsonSchema(SearchPageSchema) as ToolInput,
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "list_docs": {
        const docs = await fetchApi("/docs");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(docs, null, 2),
            },
          ],
        };
      }

      case "llms_txt": {
        const parsedArgs = LlmsTxtSchema.safeParse(args);
        if (!parsedArgs.success) {
          throw new Error(`Invalid arguments: ${parsedArgs.error}`);
        }

        const docName = parsedArgs.data.docName;
        const page = await fetchApi(`/docs/${docName}/pages/llms.txt`);

        return {
          content: [{ type: "text", text: JSON.stringify(page, null, 2) }],
        };
      }

      case "llms_full_txt": {
        const parsedArgs = LlmsFullTxtSchema.safeParse(args);
        if (!parsedArgs.success) {
          throw new Error(`Invalid arguments: ${parsedArgs.error}`);
        }

        const docName = parsedArgs.data.docName;
        const page = await fetchApi(`/docs/${docName}/pages/llms-full.txt`);

        return {
          content: [{ type: "text", text: JSON.stringify(page, null, 2) }],
        };
      }

      case "get_page": {
        const parsedArgs = GetPageSchema.safeParse(args);
        if (!parsedArgs.success) {
          throw new Error(`Invalid arguments: ${parsedArgs.error}`);
        }

        const { docName, pageSlug } = parsedArgs.data;
        const page = await fetchApi(`/docs/${docName}/pages/${pageSlug}`);

        return {
          content: [{ type: "text", text: JSON.stringify(page, null, 2) }],
        };
      }
      case "search_page": {
        const parsedArgs = SearchPageSchema.safeParse(args);
        if (!parsedArgs.success) {
          throw new Error(`Invalid arguments: ${parsedArgs.error}`);
        }

        const { docName, searchQuery } = parsedArgs.data;
        const results = await fetchApi(`/docs/${docName}/search?q=${searchQuery}`);

        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
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
    console.error("Documentation MCP Server running on stdio");
  } catch (error) {
    console.error("Error during server setup:", error);
    process.exit(1);
  }
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
