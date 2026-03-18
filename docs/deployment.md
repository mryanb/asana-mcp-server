# Deployment

## Local development

```bash
npm install
npm run build
ASANA_ACCESS_TOKEN="your-token" npm start
```

Or with hot reload:

```bash
ASANA_ACCESS_TOKEN="your-token" npm run dev
```

## Using a `.env` file

Copy `.env.example` to `.env` and fill in your values. The server loads `.env` from the project root automatically — this works regardless of the working directory (including when launched by Claude Desktop).

```bash
cp .env.example .env
```

## Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "asana": {
      "command": "node",
      "args": ["/path/to/asana-mcp-server/dist/index.js"]
    }
  }
}
```

No secrets needed in this config if you use a `.env` file.

## 1Password integration

For credential injection via 1Password:

```bash
OP_SERVICE_ACCOUNT_TOKEN="your-op-service-token" \
ASANA_ACCESS_TOKEN="op://Vault/Item/access_token" \
op run -- node dist/index.js
```

Claude Desktop config with 1Password:

```json
{
  "mcpServers": {
    "asana": {
      "command": "op",
      "args": ["run", "--", "node", "/path/to/asana-mcp-server/dist/index.js"],
      "env": {
        "OP_SERVICE_ACCOUNT_TOKEN": "your-op-service-token",
        "ASANA_ACCESS_TOKEN": "op://Vault/Item/access_token"
      }
    }
  }
}
```

## Global install

```bash
npm install -g asana-mcp-server
asana-mcp-server
```

## Running tests

```bash
npm test
```
