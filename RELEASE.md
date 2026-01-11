# Release Process

This document describes how to create a new release of Auto-Codex.

This project is a Codex-based fork derived from https://github.com/AndyMik90/Auto-Claude.

## Automated Release Process (Recommended)

We provide an automated script that handles version bumping, git commits, and tagging to ensure version consistency.

### Prerequisites

- Clean git working directory (no uncommitted changes)
- You're on the branch you want to release from (usually `main`)

### Steps

1. **Run the version bump script:**

   ```bash
   # Bump patch version (2.5.5 -> 2.5.6)
   node scripts/bump-version.js patch

   # Bump minor version (2.5.5 -> 2.6.0)
   node scripts/bump-version.js minor

   # Bump major version (2.5.5 -> 3.0.0)
   node scripts/bump-version.js major

   # Set specific version
   node scripts/bump-version.js 2.6.0
   ```

   This script will:
   - ✅ Update `auto-codex-ui/package.json` with the new version
   - ✅ Create a git commit with the version change
   - ✅ Create a git tag (e.g., `v2.5.6`)
   - ⚠️  **NOT** push to remote (you control when to push)

2. **Review the changes:**

   ```bash
   git log -1              # View the commit
   git show HEAD           # Review the version bump commit
   ```

3. **Push to GitHub:**

   ```bash
   # Push the commit
   git push origin main
   ```

4. **Create GitHub Release (recommended tag source):**

   - Go to [GitHub Releases](https://github.com/tytsxai/Auto-Codex/releases)
   - Click "Draft a new release"
   - Create/select the tag (e.g., `v2.5.6`) from the target commit
   - Add release notes (describe what changed)
   - Click "Publish release"

5. **Automated builds will trigger on release publish:**

   - ✅ Version validation workflow will verify version consistency
   - ✅ Tests will run (`test-on-release.yml`)
   - ✅ Native module prebuilds will be created (`build-prebuilds.yml`)
   - ✅ Discord notification will be sent (`discord-release.yml`)

## Manual Release Process (Not Recommended)

If you need to create a release manually, follow these steps **carefully** to avoid version mismatches:

1. **Update `auto-codex-ui/package.json`:**

   ```json
   {
     "version": "2.5.6"
   }
   ```

2. **Commit the change:**

   ```bash
   git add auto-codex-ui/package.json
   git commit -m "chore: bump version to 2.5.6"
   ```

3. **Create GitHub Release** (creates tag)

   - Go to [GitHub Releases](https://github.com/tytsxai/Auto-Codex/releases)
   - Click "Draft a new release"
   - Create/select the tag (e.g., `v2.5.6`) from the target commit
   - Publish the release (this triggers validation/tests/builds)

## Version Validation

A GitHub Action automatically validates that the version in `package.json` matches the git tag on release publish.

If there's a mismatch, the workflow will **fail** with a clear error message:

```
❌ ERROR: Version mismatch detected!

The version in package.json (2.5.0) does not match
the git tag version (2.5.5).

To fix this:
  1. Delete this tag: git tag -d v2.5.5
  2. Update package.json version to 2.5.5
  3. Commit the change
  4. Recreate the tag (via GitHub Release or locally) and republish
```

This validation ensures we never ship a release where the updater shows the wrong version.

## Troubleshooting

### Version Mismatch Error

If you see a version mismatch error in GitHub Actions:

1. **Delete the incorrect tag:**
   ```bash
   git tag -d v2.5.6                    # Delete locally
   git push origin :refs/tags/v2.5.6    # Delete remotely
   ```

2. **Use the automated script:**
   ```bash
   node scripts/bump-version.js 2.5.6
   git push origin main
   ```

### Git Working Directory Not Clean

If the version bump script fails with "Git working directory is not clean":

```bash
# Commit or stash your changes first
git status
git add .
git commit -m "your changes"

# Then run the version bump script
node scripts/bump-version.js patch
```

## Release Checklist

Use this checklist when creating a new release:

- [ ] All tests passing on main branch
- [ ] Run `./scripts/healthcheck.sh` (preflight readiness)
- [ ] Lock files updated (run `./scripts/lock-deps.sh` if deps changed)
- [ ] CHANGELOG updated (if applicable)
- [ ] Run `node scripts/bump-version.js <type>`
- [ ] Review commit
- [ ] Push commit to GitHub
- [ ] Create GitHub Release with release notes (creates tag)
- [ ] Upload `SHA256SUMS` asset for source updates (required by updater)
- [ ] Verify version validation passed
- [ ] Verify builds completed successfully
- [ ] Test the updater shows correct version
- [ ] (macOS) Notarization + signing configured (if distributing externally)
- [ ] (Windows) Code signing configured (if distributing externally)

## Source Update Checksums

Auto-Codex source updates verify a `SHA256SUMS` release asset before applying updates.

Example flow:

```bash
TAG=v2.5.6
curl -L "https://api.github.com/repos/tytsxai/Auto-Codex/tarball/refs/tags/${TAG}" -o auto-codex-update.tar.gz
shasum -a 256 auto-codex-update.tar.gz > SHA256SUMS
gh release upload "${TAG}" SHA256SUMS
```

If you need to bypass verification for development, set `AUTO_CODEX_ALLOW_UNSIGNED_UPDATES=true`.

## What Gets Released

When you create a release, the following are built and published:

1. **Native module prebuilds** - Windows node-pty binaries
2. **Electron app packages** - Desktop installers (triggered manually or via electron-builder)
3. **Discord notification** - Sent to the Auto-Codex community

## Version Numbering

We follow [Semantic Versioning (SemVer)](https://semver.org/):

- **MAJOR** version (X.0.0) - Breaking changes
- **MINOR** version (0.X.0) - New features (backward compatible)
- **PATCH** version (0.0.X) - Bug fixes (backward compatible)

Examples:
- `2.5.5 -> 2.5.6` - Bug fix
- `2.5.6 -> 2.6.0` - New feature
- `2.6.0 -> 3.0.0` - Breaking change
