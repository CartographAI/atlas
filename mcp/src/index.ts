import { runServer } from "./mcp";

if (import.meta.main) {
  runServer().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
  });
}
