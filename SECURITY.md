# Security and Incident Response

## Security Contacts

- Security mailbox: security@plataformaj.com
- Privacy mailbox (LGPD): privacidade@plataformaj.com

## Immediate Containment Playbook

1. Revoke and rotate secrets immediately: `AUTH_SECRET`, `NEXTAUTH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, SMTP/API keys.
2. Invalidate active sessions and reset credentials for affected users.
3. Disable suspicious integrations/endpoints while triage runs.
4. Preserve evidence (logs, request IDs, DB snapshots) before cleanup.

## Secret Rotation Checklist

1. Generate new strong secrets:

- `openssl rand -base64 32` (or equivalent CSPRNG).

2. Replace in secure environment storage only (never in source files).
3. Confirm Stripe webhook secret format starts with `whsec_` and matches endpoint.
4. Redeploy and verify auth and billing flows.
5. Revoke old secrets in provider dashboards.

## Data Breach Response (PII)

1. Identify exposed data classes: account, profile, billing, audit, support.
2. Scope impact window and affected users.
3. Notify legal/compliance and follow LGPD obligations.
4. Notify affected users with clear remediation guidance.
5. Publish post-incident report with timeline and fixes.

## Preventive Controls

1. Keep dependencies patched (weekly `npm audit --omit=dev`).
2. Enforce least privilege in admin actions and server actions.
3. Use hashed reset tokens and short TTL.
4. Keep `AUTH_DEBUG=false` in production and avoid logging raw PII.
5. Restrict remote image hosts and enforce CSP headers.

## Controlled Security Validation

- Static checks:
  - `npm run lint`
  - `npm audit --omit=dev`
- Dynamic checks (OWASP ZAP baseline):
  - Target a staging URL only.
  - Run active scan only with explicit authorization.
  - Save HTML/JSON reports and create remediation tasks by severity.

## Git Hygiene After Secret Exposure

1. Ensure `.env` is ignored and not tracked.
2. Remove committed secrets from history using history rewrite in a real git repository.
3. Force rotate all exposed secrets even after history cleanup.
4. Invalidate caches/artifacts that may contain leaked values.
