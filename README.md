# Google CLI

[![npm version](https://img.shields.io/npm/v/@stephendolan/google-cli.svg)](https://www.npmjs.com/package/@stephendolan/google-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A command-line interface for Google services (Gmail, Calendar) designed for LLMs and developers. JSON output by default.

## Installation

Requires [Bun](https://bun.sh).

```bash
bun install -g @stephendolan/google-cli

# Or run without installing
bunx @stephendolan/google-cli auth status
```

<details>
<summary>Linux: requires libsecret for keychain storage</summary>

```bash
sudo apt-get install libsecret-1-dev  # Ubuntu/Debian
sudo dnf install libsecret-devel      # Fedora/RHEL
sudo pacman -S libsecret              # Arch
```

Without libsecret, use environment variables instead.
</details>

## Setup

1. Create a [Google Cloud project](https://console.cloud.google.com/)
2. Enable the Gmail API and Calendar API
3. Create OAuth2 credentials (Desktop application)
4. Add `http://localhost:8089/callback` as an authorized redirect URI
5. Authenticate:

```bash
google auth login --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET
```

## Commands

### Authentication

```bash
google auth login --client-id <id> --client-secret <secret>
google auth status
google auth logout
google auth current                             # Show active profile
google auth list                                # List all profiles
google auth switch <name>                       # Switch to profile
google auth delete <name>                       # Delete a profile
```

Or use environment variables:
- `GOOGLE_CLIENT_ID` (or `GMAIL_CLIENT_ID`)
- `GOOGLE_CLIENT_SECRET` (or `GMAIL_CLIENT_SECRET`)
- `GOOGLE_TOKENS` (or `GMAIL_TOKENS`) - JSON string of OAuth tokens

### Calendar

```bash
google calendar calendars                    # List all calendars
google calendar today                        # Today's events
google calendar week                         # This week's events
google calendar list --from 2024-01-01 --to 2024-01-31  # Date range
google calendar search "meeting"             # Search upcoming events
google calendar event <event-id>             # Get specific event
```

### Messages

```bash
google messages list                         # List recent messages
google messages list --limit 50              # Limit results
google messages list --query "is:unread"     # Filter with Gmail search
google messages list --label INBOX           # Filter by label

google messages read <message-id>            # Read a specific message
google messages read <id> --format full      # Full/metadata/minimal format
google messages search "from:boss@example.com"  # Search messages
google messages attachment <msg-id> <att-id>   # Download attachment
google messages attachment <msg-id> <att-id> -o file.pdf  # Save to file
```

### Inbox

```bash
google inbox list                            # List inbox messages
google inbox list --unread                   # Only unread messages
google inbox search <query>                  # Search within inbox
```

### Drafts

```bash
google drafts list                           # List all drafts
google drafts read <draft-id>                # Read a draft

google drafts create \
  --to recipient@example.com \
  --subject "Hello" \
  --body "Message body"
```

### Labels

```bash
google labels list                           # List all labels
```

### MCP Server

Run as an MCP server for AI agent integration:

```bash
google mcp
```

## MCP Tools

### Gmail

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
| `get_attachment` | Download attachment |
| `current_profile` | Get active profile |
| `switch_profile` | Switch to profile |
| `list_profiles` | List all profiles |

### Calendar

| Tool | Description |
|------|-------------|
| `list_calendars` | List all calendars |
| `calendar_today` | Get today's events |
| `calendar_week` | Get this week's events |
| `calendar_events` | Get events in a date range |
| `calendar_search` | Search upcoming events |
| `calendar_event` | Get a specific event |

## Output

All commands output JSON. Use `--compact` or `-c` for single-line output:

```bash
google messages list                # Pretty-printed JSON
google -c calendar today            # Compact JSON
```

Errors are also returned as JSON:

```json
{"error": {"name": "auth_error", "detail": "Not authenticated", "statusCode": 401}, "hint": "Run: google auth login"}
```

## Scopes

Required Google API scopes:

| Scope | Purpose |
|-------|---------|
| `gmail.readonly` | Read messages, labels, threads |
| `gmail.compose` | Create and modify drafts |
| `calendar.readonly` | Read calendar events |

**Note:** The `gmail.send` scope is intentionally not requested. This CLI cannot send emails.

## License

MIT
