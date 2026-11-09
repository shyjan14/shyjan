# AWS deployment: Newton Training Center HR

A dedicated setup for 100 staff, 8 branches:

```
Staff phones / HR browser
        │ HTTPS (hr. / api.newtontraininguae.com)
        ▼
┌───────────────────────────┐   private network   ┌──────────────────────────────┐
│ EC2 server  (t3.medium)   │ ──────────────────► │ RDS PostgreSQL 16            │
│ Caddy HTTPS + API + Portal│   SSL, port 5432     │ automatic daily backups      │
│ + uploaded selfies/docs   │                      │ point-in-time restore        │
└───────────────────────────┘                      └──────────────────────────────┘
```
Region: **Middle East (UAE), `me-central-1`**, so all data stays in the UAE.

## Load test result (before go-live)

The same setup, with an SSL-only PostgreSQL standing in for RDS, was tested on a 4-CPU machine:

| Scenario | Result |
|---|---|
| 100 staff **check in at the same moment** (80 KB selfie each) | 300 of 301 OK over 3 rounds; all 100 done in about **1.4 s** |
| First day: 100 staff **log in** at the same moment | 100/100 OK, all done in about 10 s |

Phones stay logged in for 30 days, so the daily 9 AM rush is check-ins, not logins.
One check-in in the first round failed and the cause was not found; the server log showed no errors, and later rounds were 100/100.
A t3.medium has 2 vCPUs, about half of the test machine. Daily check-ins will still be quick. On the first day, ask branches to log in a few minutes apart.

## Monthly budget (estimate; confirm with the AWS Pricing Calculator)

| Item | Size | Approx. USD / month |
|---|---|---|
| EC2 server | t3.medium (2 vCPU, 4 GB), 40 GB gp3 disk | 35–45 |
| RDS PostgreSQL | db.t3.small or db.t4g.small, 50 GB gp3, Single-AZ | 35–50 |
| Public IP (Elastic IP) | 1 | ~4 |
| Data transfer, snapshots | | 5–10 |
| **Total** | | **≈ USD 80–110 (≈ AED 300–400)** |
| Optional: RDS **Multi-AZ** (standby DB copy, automatic failover) | | + 35–50 |

One-time / yearly costs:
- Google Play developer account: USD 25 one-time
- Apple Developer: USD 99 per year (only if staff use iPhones)
- Domain: already owned (Hostinger)

To save money: after 1–2 months of stable use, buy a **1-year Savings Plan / Reserved Instance**. That's typically about 30–40% cheaper.

## Step 1: AWS account (15 min)
1. Go to **aws.amazon.com** → *Create an AWS Account* (you need a credit card).
2. Turn on **MFA** for the root user (IAM → Security credentials).
3. Top-right region menu → **Middle East (UAE) me-central-1**. If it isn't listed, enable it under *Account → AWS Regions*.
4. **Billing → Budgets → Create budget:** monthly USD 120 with an email alert.

## Step 2: Database (RDS), 20 min
RDS → *Create database*:
- Engine: **PostgreSQL 16**
- Template: **Production** (or *Dev/Test* to save cost)
- DB instance identifier: `newton-hr-db`
- Master username: `hrms`. Master password: a strong password; write it down safely.
- Instance: **db.t3.small** or **db.t4g.small**
- Storage: gp3, **50 GB**, enable storage autoscaling (max 200 GB)
- Availability: Single-AZ (cheaper) or **Multi-AZ** (safest)
- Connectivity: **Public access = No**, default VPC
- Security group: create new, named `newton-hr-db-sg`
- Additional configuration:
  - Initial database name: **`hrms`**
  - Backup retention: **14 days**
  - Encryption: **enabled**
  - Deletion protection: **enabled**

When it shows *Available*, copy the **Endpoint**. It looks like `newton-hr-db.xxxx.me-central-1.rds.amazonaws.com`.

## Step 3: Server (EC2), 15 min
EC2 → *Launch instance*:
- Name: `newton-hr-server`
- Image: **Ubuntu Server 24.04 LTS**
- Type: **t3.medium**
- Key pair: create one and download the `.pem` file. Keep it safe; you need it to log in.
- Network → *Create security group*, `newton-hr-web-sg`:
  - SSH 22 from **My IP**
  - HTTP 80 from anywhere
  - HTTPS 443 from anywhere
- Storage: **40 GB gp3**, encrypted

Then:
- EC2 → **Elastic IPs** → *Allocate*, then *Associate* it with `newton-hr-server`. Note this IP.
- Allow the server to reach the database: RDS → your DB → security group `newton-hr-db-sg` → *Edit inbound rules* → add **PostgreSQL 5432**, source = **`newton-hr-web-sg`**. Use the security group as the source, not an IP.

## Step 4: DNS at Hostinger, 5 min
hPanel → Domains → `newtontraininguae.com` → DNS records:

| Type | Name | Points to |
|---|---|---|
| A | `hr` | Elastic IP |
| A | `api` | Elastic IP |

Do **not** change the nameservers or the existing `@` / `www` records.

## Step 5: Install on the server (30 min)
From your PC:
```bash
ssh -i newton-hr.pem ubuntu@ELASTIC_IP
```
On the server, install Docker:
```bash
curl -fsSL https://get.docker.com | sudo sh
```
Let the `ubuntu` user run Docker without sudo:
```bash
sudo usermod -aG docker ubuntu
```
Log out (`exit`) and SSH in again. Then get the code:
```bash
git clone https://github.com/shyjan14/shyjan.git
```
```bash
cd shyjan
```
```bash
git checkout claude/jolly-newton-s60pdd
```
(The repository is private: use your GitHub username and a Personal Access Token as the password. After the branch is merged, use `main` instead.)

Create the settings file:
```bash
cp deploy/.env.aws.example .env
```
Run this twice and keep both values:
```bash
openssl rand -hex 48
```
Edit the file:
```bash
nano .env
```
- `DATABASE_URL`: replace `RDS_PASSWORD` and `RDS_ENDPOINT` with your values from Step 2. If the password has special characters, URL-encode them; for example `@` becomes `%40`.
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`: the two random values
- `ACME_EMAIL`: your email

Start everything:
```bash
docker compose -f deploy/docker-compose.aws.yml --env-file .env up -d --build
```
Check that all services are Up:
```bash
docker compose -f deploy/docker-compose.aws.yml --env-file .env ps
```
Create the admin login, leave rules and holidays:
```bash
docker compose -f deploy/docker-compose.aws.yml --env-file .env exec -e ADMIN_PASSWORD='admin@2026' api node dist/setup/setup-production.js
```

## Step 6: Go live
1. Open **https://hr.newtontraininguae.com** and log in with **admin / admin@2026**. Set a new password and turn on two-step verification.
2. In **Branches & shifts**, set the real GPS location and radius for each branch, and add all 8 branches.
3. Add employees.
4. Build the Android app and send it to staff (see `DEPLOYMENT.md`, Step 8). It already connects to `api.newtontraininguae.com`.

## Backups
- **Database:** RDS automatic backups (14 days, restore to any minute). Nothing to do.
- **Uploaded selfies and documents:** EC2 → *Lifecycle Manager* → create a policy for daily **EBS snapshots** of the server disk, keeping 14.

## Updates later
```bash
cd ~/shyjan
```
```bash
git pull
```
```bash
docker compose -f deploy/docker-compose.aws.yml --env-file .env up -d --build
```

## Monitoring (recommended)
CloudWatch → Alarms:
- EC2 CPU above 80% for 15 min
- RDS free storage below 10 GB
- RDS CPU above 80%

Send all alarms to your email.
