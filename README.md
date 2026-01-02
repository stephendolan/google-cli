# Gmail CLI

A command-line interface for Gmail, designed for developers and AI agents.

## Features

- **AI-agent friendly** - JSON output, MCP server support
- **Read & draft** - Read messages, search, create drafts
- **No send capability** - Drafts only, cannot send email
- **Secure auth** - OAuth2 with credentials in OS keychain

## Installation

```bash
npm install -g @anthropic-stephen/gmail-cli
```

On Linux, install libsecret for keychain support: `sudo apt-get install libsecret-1-dev`

## Setup

1. Create a [Google Cloud project](https://console.cloud.google.com/)
2. Enable the Gmail API
3. Create OAuth2 credentials (Desktop application)
4. Add `http://localhost:8089/callback` as an authorized redirect URI
5. Authenticate:

```bash
gmail auth login --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET
```

## Commands

### Authentication

```bash
gmail auth login --client-id <id> --client-secret <secret>
gmail auth status
gmail auth logout
```

Or use environment variables:
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_TOKENS` (JSON string of OAuth tokens)

### Messages

```bash
gmail messages list                           # List recent messages
gmail messages list --limit 50                # Limit results
gmail messages list --query "is:unread"       # Filter with Gmail search
gmail messages list --label INBOX             # Filter by label

gmail messages read <message-id>              # Read a specific message
gmail messages search "from:boss@example.com" # Search messages
```

### Drafts

```bash
gmail drafts list                             # List all drafts
gmail drafts read <draft-id>                  # Read a draft

gmail drafts create \
  --to recipient@example.com \
  --subject "Hello" \
  --body "Message body"
```

### Labels

```bash
gmail labels list                             # List all labels
```

### MCP Server

Run as an MCP server for AI agent integration:

```bash
gmail mcp
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `check_auth` | Check authentication status |
| `list_messages` | List inbox messages |
| `read_message` | Read a specific message |
| `search_messages` | Search with Gmail syntax |
| `list_labels` | List all labels |
| `list_drafts` | List drafts |
| `read_draft` | Read a draft |
| `create_draft` | Create a draft |

## Output

All commands output JSON. Use `--compact` or `-c` for single-line output:

```bash
gmail messages list                # Pretty-printed JSON
gmail -c messages list             # Compact JSON
```

Errors are also returned as JSON:

```json
{"error": {"name": "auth_error", "detail": "Not authenticated", "statusCode": 401}, "hint": "Run: gmail auth login"}
```

## Scopes

This CLI requests the following Gmail API scopes:

| Scope | Purpose |
|-------|---------|
| `gmail.readonly` | Read messages, labels, threads |
| `gmail.compose` | Create and modify drafts |

**Note:** The `gmail.send` scope is intentionally not requested. This CLI cannot send emails.

## License

MIT
