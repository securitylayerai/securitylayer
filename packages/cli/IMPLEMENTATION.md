# CLI Distribution Implementation

## Tools and Dependencies

- [ ] `bun` to build binaries (with scripts/build-cli.ts targeting different platforms)
- [] `bumpp` to bump version (with scripts/release.ts) (https://github.com/antfu-collective/bumpp)
- [] `github-actions` to create release (with .github/workflows/release.yml)
- [] `changeloggithub` to generate changelog in GH release (https://github.com/antfu/changelogithub)


See: ./TODO.md for more details related to where we should publish the CLI

## Implementation

- [x] Create the release script in `scripts/release.ts` (Add it to package.json)
- [x] Create the build script in `scripts/build.ts` (Also add it to package.json)
- [x] Create the release workflow in `.github/workflows/release.yml`
- [x] Upload CLI binaries via `gh release upload` after `changelogithub` creates the release


## Release Flow

Run the release script:

```bash
bun run scripts/release.ts
```

This will create a new release in GitHub and upload the CLI binaries to it.

## Homebrew
TODO: We'll implement this later. Basically the idea is to create a formula in `securitylayerai/homebrew-securitylayer`. We will need to update the formula on every release. We can use GH CLI to update the formula. It's only about updating SHA256 and URL of the binary.

```yaml
 - name: Trigger Homebrew formula update
        run: |
          VERSION=${GITHUB_REF#refs/tags/v}
          echo "Triggering Homebrew formula update for version: $VERSION"

          gh workflow run update-formula.yml \
            --repo securitylayerai/homebrew-securitylayer \
            --field version="$VERSION" \
            --field auto_merge=true

          echo "✅ Successfully triggered Homebrew formula update workflow"
```

We can simply use the above workflow in our release workflow.
Note: This repo is not created yet. We'll create it when we implement this.