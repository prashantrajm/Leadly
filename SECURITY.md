# Security Policy

Leadly handles visitor conversations, lead contact details and customers' own LLM provider keys, so we take security reports seriously. Thank you for helping keep the project and its users safe.

## Supported versions

Leadly is pre-1.0 and moves quickly. Security fixes land on the `main` branch only. If you self-host, please track `main`.

| Version | Supported |
|---|---|
| `main` (latest) | ✅ |
| Older commits / forks | ❌ |

## Reporting a vulnerability

**Please do not open a public issue, discussion or pull request for security problems.**

Report privately through one of these:

1. **GitHub private vulnerability reporting** (preferred): go to the [Security tab](https://github.com/prashantrajm/Leadly/security) and click **Report a vulnerability**.
2. **Email:** [prashantraj@synonymy.studio](mailto:prashantraj@synonymy.studio), with `[Leadly security]` in the subject.

Please include:

- A description of the issue and its impact
- Steps to reproduce, or a proof of concept
- The affected component (API worker, Durable Object, dashboard, widget loader, a package) and the commit you tested
- Any suggested fix, if you have one

### What to expect

- **Acknowledgement** within 3 business days.
- **Initial assessment** (confirmed or not, and severity) within 7 business days.
- **Fix and disclosure:** we aim to ship a fix within 30 days for confirmed issues, depending on severity, and will coordinate a disclosure date with you. We're happy to credit you in the advisory unless you'd rather stay anonymous.

## Scope

Areas we're especially interested in:

- **Multi-tenant isolation:** reading or modifying another workspace's agents, conversations, leads, knowledge base or members.
- **BYOK key handling:** any path that exposes plaintext provider keys outside `decryptForOrg`, or weaknesses in the AES-256-GCM envelope encryption.
- **Widget tokens and WebSocket auth:** forging or replaying tokens, or joining or observing a conversation you shouldn't.
- **Authentication and invitations:** session handling, invitation token abuse, role escalation (member → admin → owner).
- **Prompt-injection paths** that make an agent leak other tenants' data or system configuration, or take tool actions it shouldn't.
- **Injection** (SQL, XSS in the dashboard or widget, SSRF via knowledge-base uploads).

Out of scope:

- Vulnerabilities in a third-party service (Cloudflare, OpenRouter, Prisma, Better Auth). Please report those upstream, but tell us if Leadly's use of them makes things worse.
- Findings that need a compromised Cloudflare account, database or `.dev.vars` file.
- Missing hardening headers or best-practice suggestions with no demonstrated impact. Feel free to open a regular issue for these.
- Denial of service through volume or rate (load testing a deployment you don't own).
- An LLM simply giving a wrong or off-topic answer, with no security impact.

## Safe harbor

We won't pursue legal action over good-faith research that follows this policy. That means you avoid privacy violations, data destruction and service disruption, test only against your own self-hosted instance or accounts you own, and give us reasonable time to fix the issue before disclosing it.
