# Going live: Newton Training Center HR

This guide puts the system online at:

| Address | What |
|---|---|
| **https://hr.newtontraininguae.com** | HR / admin portal (browser) |
| **https://api.newtontraininguae.com** | Server the mobile app talks to |

Your main website `newtontraininguae.com` is **not changed**. We only add two sub-domains.

Total time: about 1–2 hours.

---

## Step 1: Create a cloud server (about 15 min)

Any Ubuntu server works. Recommended: **Microsoft Azure, region "UAE North"** (keeps data in the UAE).
**AWS, region "Middle East (UAE) me-central-1"** works the same way.

Server settings:
- **OS:** Ubuntu Server 24.04 LTS
- **Size:** 2 vCPU, 4 GB RAM, 64 GB disk. That's enough for 100 employees.
  - Azure: `Standard_B2s`
  - AWS: `t3.medium`
- **Login:** SSH key (safer than a password)
- **Firewall / network security group:** allow only
  - **22** (SSH): only from your office IP if possible
  - **80** (HTTP)
  - **443** (HTTPS)
- Give it a **static public IP** and note it down (for example `20.74.x.x`).

## Step 2: DNS records (5 min, then wait up to 1 hour)

Where you manage `newtontraininguae.com` (GoDaddy, Namecheap, Cloudflare, etc.), add:

| Type | Name / Host | Value |
|---|---|---|
| A | `hr` | your server IP |
| A | `api` | your server IP |

If you use Cloudflare, set these two records to **DNS only** (grey cloud), at least for the first setup.

Check: `ping hr.newtontraininguae.com` should show your server IP.

## Step 3: Install Docker on the server (5 min)

Connect with SSH:
```bash
ssh azureuser@YOUR_SERVER_IP
```
Install Docker:
```bash
curl -fsSL https://get.docker.com | sudo sh
```
Let your user run Docker without sudo:
```bash
sudo usermod -aG docker $USER
```
Log out and SSH in again.

## Step 4: Get the code (5 min)

```bash
git clone https://github.com/shyjan14/shyjan.git
```
```bash
cd shyjan
```
```bash
git checkout claude/jolly-newton-s60pdd
```
(After you merge the branch into `main`, use `main` instead.)

The repository is private, so git will ask for your GitHub username and a **Personal Access Token** as the password.
Create the token on GitHub: Settings → Developer settings → Personal access tokens.

## Step 5: Settings file (5 min)

```bash
cp .env.example .env
```
Run this three times to generate three random secrets:
```bash
openssl rand -hex 48
```
Then edit the file:
```bash
nano .env
```
Fill in:
```
DB_PASSWORD=<paste secret 1>
JWT_ACCESS_SECRET=<paste secret 2>
JWT_REFRESH_SECRET=<paste secret 3>
COMPANY_NAME=Newton Training Center
PORTAL_DOMAIN=hr.newtontraininguae.com
API_DOMAIN=api.newtontraininguae.com
ACME_EMAIL=your-email@newtontraininguae.com
```
Save with Ctrl+O, Enter, then Ctrl+X. **Never share this file or upload it to GitHub.**

## Step 6: Start everything (10 min)

```bash
docker compose up -d --build
```
Check that all 4 services say **Up**:
```bash
docker compose ps
```
The HTTPS certificate is created automatically within a minute. Then create the admin login, the UAE leave rules and holidays:
```bash
docker compose exec -e ADMIN_PASSWORD='admin@2026' api node dist/setup/setup-production.js
```

## Step 7: First login (10 min)

1. Open **https://hr.newtontraininguae.com**.
2. Sign in with **admin** / **admin@2026**.
3. You'll be asked to set a new password: at least 10 characters, with upper case, lower case and a number.
4. **Settings → Two-step verification → Set up.** Strongly recommended for the admin account.
5. **Branches & shifts:**
   - Edit *Head Office* and enter the real GPS location. In Google Maps, long-press the entrance and copy the coordinates.
   - Set a radius of 100–150 m.
   - Add your other branches.
6. **Settings → Leave policy / Holidays:** check them against your HR policy.
7. **Employees → Add employee.** Each one gets a temporary password; give it to the employee in person.

## Step 8: Mobile app

The app already points to `https://api.newtontraininguae.com`.

### Android
On a PC with Flutter and Android Studio:
```bash
cd mobile-app
```
```bash
flutter build apk --release
```
The file is at `build/app/outputs/flutter-apk/app-release.apk`.

- **Quick start:** send the APK to staff (WhatsApp, email or a download link). They need to allow "Install unknown apps".
- **Better:** publish on **Google Play** (USD 25 one-time). Before uploading, set up an app signing key (see Flutter's "Build and release an Android app" guide), then build an app bundle:
  ```bash
  flutter build appbundle --release
  ```
  Use **Internal testing** for your 100 staff. Review takes a few days.

### iPhone
- You need an **Apple Developer account** (USD 99/year) and a Mac. A cloud build service such as Codemagic also works.
- On the Mac:
  ```bash
  cd mobile-app
  ```
  ```bash
  flutter build ipa --release
  ```
- Upload with Xcode or Transporter, then invite staff through **TestFlight**.

## Step 9: Backups (5 min)

On the server:
```bash
chmod +x deploy/backup.sh
```
Schedule it every night at 02:30:
```bash
(crontab -l 2>/dev/null; echo "30 2 * * * cd $HOME/shyjan && ./deploy/backup.sh >> $HOME/backup.log 2>&1") | crontab -
```
Test it once:
```bash
./deploy/backup.sh
```
Also copy `~/hr-backups` off the server regularly (Azure Blob, AWS S3 or a company drive).

Restoring a backup:
```bash
docker compose exec -T db pg_restore -U hrms -d hrms --clean < ~/hr-backups/db_YYYY-MM-DD_HHMM.dump
```

## Updating to a new version later
```bash
cd ~/shyjan
```
```bash
git pull
```
```bash
docker compose up -d --build
```
Database changes are applied automatically when the API starts.

## Rollout plan
1. **Week 1–2:** pilot at **one branch** with 10–15 staff. Fix GPS radius issues and collect feedback.
2. **Week 3:** all 8 branches.
3. Run your old attendance method in parallel for the first month.

## Troubleshooting
| Problem | Check |
|---|---|
| Site does not open | Run `docker compose ps`. Check that DNS A records point to the server, and that ports 80/443 are open in the cloud firewall. |
| "Not secure" / certificate error | Check the caddy logs (command below). DNS must point to this server before the certificate can be issued. |
| Staff "outside branch" though inside | Increase the branch radius (e.g. 200 m), or add the branch Wi-Fi BSSID in Branches. |
| Staff changed phone | Portal → Approvals → New phones → Approve. |
| Forgot admin password | Another Super Admin / HR can reset it from Employees. |

Caddy (HTTPS) logs:
```bash
docker compose logs caddy --tail 50
```
API logs:
```bash
docker compose logs api --tail 100
```
