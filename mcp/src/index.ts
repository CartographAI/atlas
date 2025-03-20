#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ToolSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const API_BASE_URL = "http://localhost:3000";

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
  docName: z.string().describe("Name of the documentation to retrieve LLM-friendly index"),
});

const LlmsFullTxtSchema = z.object({
  docName: z.string().describe("Name of the documentation to retrieve full content"),
});

const GetPageSchema = z.object({
  docName: z.string().describe("Name of the documentation"),
  pageName: z.string().describe("Name of the specific page"),
});

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

async function fetchApi(path: string) {
  const response = await fetch(`${API_BASE_URL}${path}`);
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
        description: "Lists all available documentation with basic metadata",
        inputSchema: zodToJsonSchema(ListDocsSchema) as ToolInput,
      },
      {
        name: "llms_txt",
        description: "Retrieves LLM-friendly index for a specific documentation",
        inputSchema: zodToJsonSchema(LlmsTxtSchema) as ToolInput,
      },
      {
        name: "llms_full_txt",
        description: "Retrieves all pages concatenated for a documentation",
        inputSchema: zodToJsonSchema(LlmsFullTxtSchema) as ToolInput,
      },
      {
        name: "get_page",
        description: "Retrieves a specific page from a documentation",
        inputSchema: zodToJsonSchema(GetPageSchema) as ToolInput,
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

        const { docName, pageName } = parsedArgs.data;
        const page = await fetchApi(`/docs/${docName}/pages/${pageName}`);

        return {
          content: [{ type: "text", text: JSON.stringify(page, null, 2) }],
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
