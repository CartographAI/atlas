# Atlas

Atlas is a documentation ingestion and query API. It fetches documentation from various web sources (specified via URLs or `llms.txt` files), extracts relevant content, converts it to Markdown, stores it in a PostgreSQL database, and provides an API for searching and retrieving the documentation. It is meant to be used with [atlas-docs-mcp](https://github.com/CartographAI/atlas-docs-mcp).

## Features

*   **Documentation Ingestion:** Fetches and processes documentation from web sources.
*   **Clean Markdown Conversion:** Converts HTML pages to clean Markdown.
*   **API Endpoints:** Provides a RESTful API built with Hono for:
    *   Listing available documentation sets.
    *   Retrieving metadata for a specific documentation set.
    *   Listing all pages within a documentation set.
    *   Retrieving the processed Markdown content of a specific page.
    *   Performing weighted full-text search across pages within a documentation set.
*   **Link Handling:** Standarizes links within the processed Markdown content based on the source base URL.
*   **Extensibility:** Designed to easily add new documentation sources (see `api/src/documentation.ts`).

## Technology Stack

*   **Backend:** Bun, Hono, TypeScript
*   **Database:** PostgreSQL (Supabase), Kysely
*   **Testing:** Vitest
*   **Linting/Formatting:** Biome, Pre-commit
*   **Deployment:** Docker, Google Cloud Build

## Prerequisites

*   [Bun](https://bun.sh/) (v1.2.0 or later recommended)
*   [Docker](https://www.docker.com/) (for containerization)
*   [Supabase CLI](https://supabase.com/docs/guides/cli) (for PostgreSQL database management)

## Getting Started

1.  **Clone the repository:**
    ```bash
    git clone git@github.com:CartographAI/atlas.git
    cd atlas
    ```

2.  **Navigate to the API directory:**
    ```bash
    cd api
    ```

3.  **Set up environment variables:**
    *   Copy the example environment file:
        ```bash
        cp .env.example .env
        ```
    *   Edit the `.env` file and set your `DATABASE_URL` for PostgreSQL.

4.  **Install dependencies:**
    ```bash
    bun install
    ```

5.  **Set up the database:**
    *   **Using Supabase CLI (for local development):**
        *   Ensure Supabase CLI is installed and Docker is running.
        *   Start the Supabase services:
            ```bash
            # From the project root directory (atlas/)
            supabase start
            ```
        *   The local `DATABASE_URL` will be outputted by the command. Update your `api/.env` file accordingly.
        *   The necessary migrations (`supabase/migrations/`) should be applied automatically on start. You can reset and re-seed if needed:
            ```bash
            supabase db reset
            ```
    *   **Using a different PostgreSQL instance:**
        *   Ensure your database is running and accessible.
        *   Apply the SQL migrations located in the `supabase/migrations/` directory in order. You might need a migration tool or apply them manually using `psql` or another client.

6.  **Generate Database Types (Optional but Recommended):**
    *   If you make changes to the database schema, regenerate the Kysely types:
        ```bash
        # Inside the api/ directory
        bun run db:typegen
        ```

7.  **Run the API:**
    ```bash
    # Inside the api/ directory
    bun run dev
    ```
    The API should now be running (typically on `http://localhost:3000`). Check the console output for the exact address.

8.  **Ingest Documentation (Optional):**
    *   To populate the database with documentation, run the ingestion script. You can process all configured libraries or specific ones:
        ```bash
        # Inside the api/ directory

        # Process all libraries defined in api/src/documentation.ts
        bun run src/documentation.ts --all

        # Process specific libraries
        bun run src/documentation.ts Hono SvelteKit
        ```

## API Endpoints

The API is served under the `/api` prefix.

*   `GET /api/health`: Health check endpoint.
*   `GET /api/docs`: List all available documentation sets (minimal details).
*   `GET /api/docs/:docName`: Get details for a specific documentation set.
*   `GET /api/docs/:docName/pages`: List all pages (titles, paths, descriptions) within a documentation set.
*   `GET /api/docs/:docName/pages/:pagePath`: Get the full processed content for a specific page. (`:pagePath` should be the root-relative path, e.g., `/guides/introduction`).
*   `GET /api/docs/:docName/search?q=<query>`: Search for pages within a documentation set using full-text search.

## Development

*   **Linting & Formatting:** Biome is used for linting and formatting. Pre-commit hooks are configured to run checks automatically.
    ```bash
    # Run checks manually (from root directory)
    make hooks

    # Or install hooks (from root directory)
    make install-hooks
    # Then commit changes
    ```
*   **Testing:** Run tests using Vitest.
    ```bash
    # Inside the api/ directory
    bun test
    ```
*   **Database Migrations:** Use the Supabase CLI to create new database migrations.
    ```bash
    # From the project root directory (atlas/)
    supabase migration new <migration_name>
    ```
    Edit the generated SQL file in `supabase/migrations/`. Apply migrations locally using `supabase db reset` or `supabase migration up`.

## Deployment

*   A `Dockerfile` is provided in the `api/` directory for building a container image of the API.
*   A `cloudbuild.yaml` file is included for building and pushing the Docker image using Google Cloud Build. Configure your `PROJECT_ID` and Artifact Registry path accordingly.
