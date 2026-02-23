# CLI Distribution Plan

Track cross-platform package manager distribution for `securitylayer` / `sl`.

GitHub Issue: https://github.com/securitylayerai/securitylayer/issues/TBD

## Prerequisites

- [ ] Set up `bun build --compile` for all target platforms
  - `darwin-arm64` (macOS Apple Silicon)
  - `darwin-x64` (macOS Intel)
  - `linux-x64` (glibc)
  - `linux-arm64` (glibc)
  - `linux-x64-musl` (Alpine)
  - `win-x64` (Windows)
- [ ] Create GitHub Actions release workflow (`.github/workflows/release.yml`)
  - Triggered on version tags (`v*`)
  - Builds standalone binaries for all targets
  - Uploads to GitHub Releases
  - Auto-updates Homebrew formula and Scoop manifest

## Package Managers

### 1. Homebrew (macOS + Linux) — Priority: High

- [ ] Create repo: `securitylayerai/homebrew-securitylayer`
- [ ] Write `Formula/securitylayer.rb`
  - Download URLs for `darwin-arm64` and `darwin-x64` from GitHub Releases
  - SHA256 checksums
  - `bin.install "securitylayer"` + `bin.install_symlink "securitylayer" => "sl"`
- [ ] Add release CI step to auto-update formula SHA256 on new release
- [ ] Test: `brew install securitylayerai/securitylayer/securitylayer`

### 2. Scoop (Windows) — Priority: High

- [ ] Create repo: `securitylayerai/scoop-securitylayer`
- [ ] Write `securitylayer.json` manifest
  - URL to Windows binary from GitHub Releases
  - SHA256 hash
  - `bin` mapping for both `securitylayer.exe` and `sl.exe`
- [ ] Add release CI step to auto-update manifest hash on new release
- [ ] Test: `scoop bucket add securitylayer https://github.com/securitylayerai/scoop-securitylayer && scoop install securitylayer`

### 3. AUR / Arch Linux — Priority: Medium

- [ ] Create `packaging/PKGBUILD` in this repo
  - Downloads binary from GitHub Releases
  - Installs to `/usr/bin/securitylayer` + symlink `sl`
- [ ] Register package on AUR
- [ ] Test: `yay -S securitylayer`

### 4. Debian / Ubuntu (apt/deb) — Priority: Medium

- [ ] Create `packaging/nfpm.yaml` config (shared with RPM)
  - Package name, version, description, maintainer, license
  - Binary placed in `/usr/bin/`
  - Symlink `/usr/bin/sl` -> `/usr/bin/securitylayer`
- [ ] Add release CI step to build `.deb` via `nfpm` and upload to GitHub Releases
- [ ] Set up GPG signing for the repo
- [ ] Create install script or docs for adding the apt repo
- [ ] Test: `apt install securitylayer`

### 5. Red Hat / CentOS / Amazon Linux (rpm/yum/dnf) — Priority: Medium

- [ ] Reuse `packaging/nfpm.yaml` (nfpm builds both .deb and .rpm)
- [ ] Add release CI step to build `.rpm` and upload to GitHub Releases
- [ ] Set up COPR or self-hosted yum repo
- [ ] Test: `yum install securitylayer`

### 6. Winget (Windows) — Priority: Low

- [ ] Write winget manifest YAML (publisher, version, installer URL, hash)
- [ ] Submit PR to `microsoft/winget-pkgs`
- [ ] Set up `wingetcreate` in release CI for automated version bumps
- [ ] Test: `winget install securitylayer`

### 7. Alpine (apk) — Priority: Low

- [ ] Create `packaging/APKBUILD`
- [ ] Verify `bun build --compile` works with musl (Alpine's libc)
- [ ] Set up signing with `abuild-keygen`
- [ ] Self-host apk repo or submit to Alpine `community`
- [ ] Test: `apk add securitylayer`

## File Structure

```
securitylayer/                        # this monorepo
  packages/cli/                       # CLI source
  packaging/
    nfpm.yaml                         # builds .deb + .rpm
    PKGBUILD                          # AUR
    APKBUILD                          # Alpine
  .github/workflows/
    release.yml                       # build + publish pipeline

securitylayerai/homebrew-securitylayer/   # separate repo (required)
  Formula/securitylayer.rb

securitylayerai/scoop-securitylayer/      # separate repo (required)
  securitylayer.json
```

## Notes

- All package managers install both `securitylayer` and `sl` binaries
- Standalone binaries via `bun build --compile` — no runtime dependency on Bun
- Homebrew and Scoop repos are auto-updated by release CI, never manually edited
- `nfpm` produces both `.deb` and `.rpm` from a single config
- Alpine needs separate musl-targeted binary build
