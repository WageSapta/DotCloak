# Security Policy

DotCloak is designed with security and privacy as core principles. Because DotCloak handles sensitive environment variables and credentials (`.env` files), we take security vulnerabilities very seriously.

---

## Supported Versions

We provide security updates and patches for the following versions of DotCloak:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

If you discover a security vulnerability or security flaw in DotCloak, please report it to us confidentially before disclosing it publicly.

### How to Report

1. **GitHub Private Vulnerability Reporting (Preferred):**
   Navigate to the [DotCloak Repository Security Tab](https://github.com/WageSapta/DotCloak/security/advisories/new) and submit a private security advisory.

2. **Direct Contact:**
   If private vulnerability reporting is unavailable, contact the repository maintainer directly via GitHub ([@WageSapta](https://github.com/WageSapta)).

### What to Include in Your Report

To help us evaluate and address the issue efficiently, please include:
- A description of the vulnerability and its potential impact.
- Step-by-step instructions or proof-of-concept (PoC) to reproduce the behavior.
- Operating system and VS Code extension version.
- Any suggested mitigations or fixes, if available.

### Disclosure & Response Process

- **Acknowledgment:** We aim to acknowledge receipt of your security report within 48 hours.
- **Assessment & Fix:** We will assess the severity and develop a patch as quickly as possible.
- **Publication:** Once a patch is released, we will publish a security advisory and credit reporter(s) (unless anonymity is requested).

---

## Security Architecture & Design Principles

DotCloak is engineered to prevent sensitive data leaks during live streams, screen shares, pair programming, and screen recordings:

- **100% Local Execution:** All parsing, masking, and editing occur strictly within your local VS Code environment.
- **Zero Telemetry / Zero Network Overhead:** DotCloak does not send data, analytics, or environment variable keys/values to any remote server or third-party service.
- **Inline Masking & Lock Mode:** Values in `.env` files are replaced with visual masks (`***`) by default.
- **Transient State Handling:** Values revealed during explicit unlock sessions reset when switching files or reloading the workspace.
- **No Unsanitised Log Outputs:** Secret values are never printed to output channels or system logs.

---

## Recommended User Practices

While DotCloak protects credentials in your editor UI:

1. **Add `.env` files to `.gitignore`:** Ensure credentials are never committed into public or shared version control repositories.
2. **Use Lock Mode when streaming:** Keep DotCloak locked (`***`) during presentations, screen sharing, or recordings.
3. **Verify File Permissions:** Secure local file system permissions for sensitive environment configuration files.
