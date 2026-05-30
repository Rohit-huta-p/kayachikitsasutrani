# AWS Migration

**Status:** Draft
**Date:** 2026-05-27
**Scope:** Move both repos off Render onto AWS. Frontend → Amplify Hosting. Backend → EC2 t4g.micro (Mumbai). MongoDB Atlas + Cloudinary unchanged. Auto-deploy on `git push origin main` for both.

## Goal

After this ships:

1. Frontend hosted on AWS Amplify (Mumbai region), auto-deployed from GitHub on push to `main`.
2. Backend hosted on a single EC2 t4g.micro instance in `ap-south-1`, behind nginx + Let's Encrypt SSL, supervised by PM2, auto-deployed via GitHub Actions on push to `main`.
3. MongoDB Atlas IP allowlist updated to include the EC2 Elastic IP.
4. Frontend `BACKEND_URL` env var points to the EC2 public DNS (so Next.js rewrites continue proxying `/api/*` server-side — Safari cookie fix preserved).
5. Render services shut down (no double-billing).
6. No custom domain in v1 — both services use AWS default URLs (`*.amplifyapp.com` and `ec2-*.ap-south-1.compute.amazonaws.com`).

## Non-Goals

- No custom domain in v1 (deferred — easy to add later via Route 53 + ACM).
- No CloudFront in front of the backend (single EC2 in single region is enough for current scale).
- No auto-scaling (single t4g.micro is sized for current traffic).
- No database migration — Atlas stays.
- No media migration — Cloudinary stays.
- No staging environment (single prod environment, matches current Render setup).
- No blue/green deploys (PM2 reload is good enough).
- No Infrastructure-as-Code (Terraform/CDK) — manual console setup is faster for one-time work at this scale.
- No VPC / private subnet / NAT Gateway (single public-subnet EC2 + Security Group is sufficient and avoids the $32/mo NAT cost).

## Constraints

- **Existing AWS account, lightly used.** Free Tier may still apply. Need to verify in Billing console before relying on it.
- **Region: ap-south-1 (Mumbai)** — lowest latency for Indian BAMS students.
- **Instance type: t4g.micro** (ARM Graviton, 2 vCPU, 1GB RAM). Cheaper than t3.micro and within Free Tier 750-hr allowance.
- **Operating system: Ubuntu 22.04 LTS ARM64** (matches t4g architecture).
- **Backend stays Node 22 + Express + Mongoose.** No code refactor required.
- **Frontend stays Next.js 15.** Amplify supports SSR natively.
- **Cookie strategy unchanged:** SameSite=lax + Next.js rewrites proxy `/api/*` server-side so the browser sees only the Amplify origin (Safari ITP fix).

## Decisions

| Topic | Choice |
|---|---|
| AWS account | Existing (verify Free Tier status before launch) |
| Region | ap-south-1 (Mumbai) |
| Frontend hosting | AWS Amplify Hosting (Next.js SSR support) |
| Backend hosting | EC2 t4g.micro + nginx + PM2 |
| SSL on backend | Let's Encrypt via certbot (free, auto-renew) |
| SSL on frontend | Amplify-provided ACM cert (auto) |
| Public IP | Elastic IP (free while attached to running instance) |
| Deploy automation (frontend) | Amplify GitHub auto-deploy |
| Deploy automation (backend) | GitHub Actions → SSH → pull/build/pm2 reload |
| Secrets storage | EC2: `.env` file (chmod 600). Amplify: Amplify console env vars |
| Database | MongoDB Atlas (unchanged) |
| Media | Cloudinary (unchanged) |
| Custom domain | Deferred — use AWS defaults |
| Monitoring | CloudWatch default metrics only (no custom dashboards) |
| Backups | None (Atlas backs up the DB; EC2 stateless except `.env`) |

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  BROWSER                                                   │
└──────┬──────────────────────────────────────────┬──────────┘
       │ HTTPS                                    │ HTTPS
       ▼                                          ▼
┌─────────────────────┐                  ┌─────────────────────┐
│  AWS Amplify        │   internal       │  EC2 t4g.micro      │
│  (Next.js SSR)      │   /api/* via     │  ap-south-1         │
│  ap-south-1         │   Next rewrites  │  ┌────────────────┐ │
│  *.amplifyapp.com   │◀────────────────▶│  │ nginx :443     │ │
└─────────────────────┘                  │  │  ↓             │ │
                                          │  │ Express :3000  │ │
                                          │  │  (PM2)         │ │
                                          │  └────────────────┘ │
                                          │  Let's Encrypt SSL  │
                                          └──────────┬──────────┘
                                                     │
                              ┌──────────────────────┴────────────────────┐
                              ▼                                            ▼
                     ┌─────────────────┐                          ┌─────────────────┐
                     │  MongoDB Atlas  │                          │  Cloudinary     │
                     │  (unchanged)    │                          │  (unchanged)    │
                     └─────────────────┘                          └─────────────────┘
```

## Components

### EC2 instance (backend)

- **Instance type:** t4g.micro (ARM Graviton)
- **AMI:** Ubuntu 22.04 LTS ARM64
- **Storage:** 8GB gp3 (within 30GB Free Tier)
- **Security Group rules:**
  - Inbound: 22 (SSH from your IP only), 80 (HTTP — for Let's Encrypt challenge), 443 (HTTPS, public)
  - Outbound: all (default)
- **Elastic IP:** allocated + attached so the public IP survives reboots
- **Software stack:**
  - Node.js 22 (via NodeSource apt repo)
  - PM2 (`npm i -g pm2`) for process supervision
  - nginx (apt install) as reverse proxy
  - certbot + python3-certbot-nginx for Let's Encrypt
- **Application path:** `/home/ubuntu/shloka-backend`
- **PM2 config:** `pm2 start npm --name shloka-backend -- start` then `pm2 startup` + `pm2 save`
- **nginx config:** reverse-proxies `/` → `http://127.0.0.1:3000`, handles SSL termination

### Amplify (frontend)

- **App:** Created from the `kayachikitsasutrani` GitHub repo, branch `main`
- **Build settings:** Auto-detected Next.js 15. Build command: `npm run build`. Output dir: `.next`. Node 22.
- **Environment variables (Amplify console):**
  - `BACKEND_URL` = `https://ec2-<elastic-ip-with-dashes>.ap-south-1.compute.amazonaws.com` (the same Let's Encrypt-served hostname)
  - any other vars currently set on Render frontend (NEXT_PUBLIC_*, etc.)
- **Custom rewrites/redirects:** none needed at the Amplify level — Next.js `next.config.ts` already has the `/api/*` → `${BACKEND_URL}/api/*` rewrite that handles this server-side.

### GitHub Actions (backend CI/CD)

- **File:** `shloka-backend/.github/workflows/deploy.yml`
- **Trigger:** `push` on `main`
- **Steps:**
  1. Checkout
  2. Add SSH key from `secrets.EC2_SSH_KEY`
  3. SSH into EC2 host (`secrets.EC2_HOST` = Elastic IP)
  4. Run remote deploy script: `cd ~/shloka-backend && git pull && npm ci && npm run build && pm2 reload shloka-backend`
- **Secrets required (set in GitHub repo settings):**
  - `EC2_HOST` — Elastic IP (e.g., `13.234.56.78`)
  - `EC2_USER` — `ubuntu`
  - `EC2_SSH_KEY` — private key matching the EC2 instance's key pair

## Cost (Mumbai pricing, June 2026)

| Item | Free tier 12mo | After free tier |
|---|---|---|
| EC2 t4g.micro (730 hrs/mo) | 750 hrs/mo free | $7.40/mo |
| EBS gp3 8GB | 30 GB free | $0.80/mo |
| Elastic IP (attached) | Free | Free |
| Data transfer OUT (first 100 GB) | Always free | Always free |
| Data transfer OUT (above 100 GB) | $0.1093/GB | $0.1093/GB |
| Amplify build minutes (1k/mo) | Free | $0.01/min after |
| Amplify SSR hosting (15GB egress) | Free | $0.15/GB after |
| Amplify SSR compute (5GB-sec) | Free | $0.20/GB-sec after |
| CloudWatch metrics (basic) | Free | Free |
| Route 53 hosted zone | N/A (no custom domain) | N/A |
| **Total** | **$0** | **~$8-12/mo** |

**Note:** Free Tier is account-wide and 12 months from account creation. Since the user has an existing lightly-used account, the remaining months on the Free Tier need to be verified in the AWS Billing console (Billing → Free Tier page shows usage + expiry date).

## Migration runbook (high-level)

1. **Verify Free Tier remaining** — Billing console → Free Tier dashboard.
2. **Launch EC2** — t4g.micro, Ubuntu 22.04 ARM, 8GB gp3, key pair, Security Group (22/80/443).
3. **Allocate Elastic IP** + attach to instance.
4. **SSH in, install stack** — Node 22, PM2, nginx, certbot.
5. **Clone repo + configure `.env`** — paste Render env vars verbatim (Atlas URI, JWT_SECRET, Cloudinary creds).
6. **Build + start app** — `npm ci && npm run build && pm2 start npm --name shloka-backend -- start && pm2 save`.
7. **Configure nginx** — reverse proxy to `:3000`, accept HTTP first for cert challenge.
8. **Obtain Let's Encrypt cert** — `certbot --nginx -d ec2-<...>.ap-south-1.compute.amazonaws.com`.
9. **Add Atlas IP allowlist** — Elastic IP / 32.
10. **Add GitHub Secrets** — `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`.
11. **Add `.github/workflows/deploy.yml`** to backend repo, push, verify auto-deploy on test commit.
12. **Create Amplify app** — point at frontend repo, configure env vars, deploy.
13. **Smoke-test prod URLs** — Amplify URL loads, /api/health proxies through, login flow works.
14. **Shut down Render services** — both frontend + backend.

## Risks / open items

- **Free Tier exhaustion risk** — if user's existing account is past 12 months, the bill jumps to ~$8/mo from day 1. Mitigation: check Billing before launch.
- **Self-signed cert on EC2 hostname** — Let's Encrypt requires a publicly resolvable hostname. The EC2 default DNS (`ec2-X-X-X-X.ap-south-1.compute.amazonaws.com`) is publicly resolvable, so this works. Confirmed in Let's Encrypt's accepted hostname patterns.
- **Atlas IP allowlist for Render still present** — leave the old Render-friendly `0.0.0.0/0` rule in place until cutover completes, then tighten to just the Elastic IP.
- **GitHub Actions SSH from public runners** — runners have rotating IPs, so EC2 Security Group can't restrict SSH to a fixed range. Must allow 22 from `0.0.0.0/0` OR use a self-hosted runner. v1 spec accepts public 22 with SSH key auth (no password) — same security level as current Render workflow.
- **Cold start latency on first request** — EC2 stays warm 24/7 unlike Render free tier. Eliminates the cold-start issue.
- **MongoDB Atlas free tier (M0)** — separate from AWS. Already in use, unchanged.

## Rollback

If something breaks during migration: keep Render services running until Amplify + EC2 are fully smoke-tested. Cutover only after the EC2 backend has handled real traffic for at least 1 hour without errors. Render shutdown is the LAST step (#14).

## Files (changes to existing repos)

**Backend (`shloka-backend/`):**
- Create: `.github/workflows/deploy.yml` (GitHub Actions deploy)
- Modify: `README.md` — add AWS deploy section
- Optional: `ecosystem.config.cjs` (PM2 config file, alternative to `pm2 start npm`)

**Frontend (`kayachikitsasutrani/`):**
- No code changes. `next.config.ts` already supports `BACKEND_URL` env var. Just update the value in Amplify console.
- Modify: `README.md` — add Amplify deploy section
- Add: `amplify.yml` (optional — Amplify auto-detects Next.js, but explicit config makes builds reproducible)

## Verification checklist

- [ ] Free Tier remaining confirmed in Billing console
- [ ] EC2 instance running, Elastic IP attached
- [ ] `curl https://ec2-<...>.ap-south-1.compute.amazonaws.com/api/health` returns `{"ok":true}`
- [ ] Atlas connection verified (`db connected` log line on app start)
- [ ] GitHub Actions deploy succeeds on test commit
- [ ] Amplify app deployed, frontend URL loads landing page
- [ ] `/api/*` requests from frontend reach EC2 (check nginx access log)
- [ ] Login flow works end-to-end (Safari + Chrome + iPhone)
- [ ] Shloka detail page loads, audio plays, completion records
- [ ] Render services shut down (both repos)
