# AGENTS.md

## Profiles

- Credential storage (keyring or file backend) is the source of truth for which profiles exist. `config.json` is a cache of profile metadata (email, active profile) and may be missing or stale.
- Check profile existence with `profileExists()` / `discoverProfiles()`, which reconcile storage into `config.json`. Do not read `config.profiles` directly for existence checks.
- The keyring backend enumerates profiles with `findCredentials('google-cli')`; accounts are named `profile:<name>:<key>`.

## Testing against the real keychain

- Keychain items trust the binary that created them (usually Homebrew `bun`). Running the CLI with a different runtime such as `node` triggers a blocking macOS keychain prompt.
- `os.homedir()` and the macOS keychain both follow `$HOME`. To simulate a missing `config.json` with an intact keychain, point `HOME` at a scratch directory containing a `Library/Keychains` symlink to the real `~/Library/Keychains`.
