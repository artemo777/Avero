# Avero

A clean Node.js starter for building the Avero application.

## Requirements

- Node.js 20 or newer
- npm (bundled with Node.js)

## Getting started

1. Clone the repository and enter the project directory.
2. Copy the example environment file:

   ```sh
   cp .env.example .env
   ```

3. Install dependencies (there are no third-party runtime dependencies):

   ```sh
   npm install
   ```

4. Start the server:

   ```sh
   npm start
   ```

The server listens on port `3000` by default. Set `PORT` to change it. The port must be an integer between 1 and 65535.

For development with automatic restarts, run `npm run dev`.

## Endpoints

- `GET /health` — returns JSON indicating that the service is running.
- Any other route — returns a JSON `404 Not Found` response.

## Tests

Run the built-in Node.js test suite:

```sh
npm test
```

## Project structure

```text
.
├── .env.example
├── .gitignore
├── package.json
├── src/
│   ├── app.js
│   ├── config.js
│   └── server.js
└── test/
    └── app.test.js
```

## Configuration and safety

- Keep real secrets in local environment variables; never commit `.env`.
- Validate configuration at startup so invalid settings fail early.
- The starter uses Node.js built-in modules only, keeping the dependency surface small.

This is an initial foundation, not a complete product yet. Product-specific features can be added once the intended behavior is defined.
