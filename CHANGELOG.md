# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-13

### Added

- `auth export` command to export profile credentials for transfer to another machine
- `auth import` command to import credentials from an export file
- Global `-p, --profile` option now works with `auth status`, `auth logout`, and `auth export`

### Changed

- `auth login` now uses `--name` instead of `-p, --profile` to avoid conflict with global `-p` option
- `auth import` uses `--name` for target profile name (consistent with `auth login`)

## [1.0.0] - 2026-01-06

### Added

- Initial release
- Gmail commands: messages, inbox, drafts, labels
- Calendar commands: calendars, today, week, list, search, event
- Multi-profile authentication with secure keychain storage
- MCP server for AI agent integration
- JSON output for all commands
