# alejandrogomez.me — Personal Portfolio

**Live site:** [https://www.alejandrogomez.me](https://www.alejandrogomez.me)

Personal portfolio of **Alejandro Gómez**, Information Systems B.S. student at Florida Institute of Technology (Computer Science minor, cybersecurity focus), Junior Full-Stack Developer and Systems Analyst.

The site shows my work experience, collegiate competitions and leadership, certifications, a skills matrix, my CV, and a contact form that delivers messages straight to my Google Drive.

---

## Why I built it

- **One place for recruiters.** Experience, competitions, certifications and my CV in a single link, instead of scattered PDFs and profiles.
- **Show it, not just say it.** It runs on my own domain with a real deployment pipeline, a server API, and an integration with Google services.
- **Learn the whole stack end to end.** Front end, back end, DNS, SSL, CI/CD, secrets management and basic security, the same pieces a production web app needs.

---

## Languages and technologies

| Language | Where it's used |
|---|---|
| **TypeScript** | Main language: the page (`app/page.tsx`), layout and the contact API route (`app/api/contact/route.ts`) |
| **JavaScript** | Google Apps Script backend that saves messages to Drive (`integrations/google-drive-contact/Code.gs`), plus config files (`eslint.config.mjs`) |
| **CSS** | Tailwind CSS v4 utility classes and custom animations (`app/globals.css`, inline keyframes) |
| **HTML / JSX** | Page markup written as React components |
| **JSON** | Project and TypeScript config (`package.json`, `tsconfig.json`) |
| **Markdown** | Documentation (`README.md`, `CLAUDE.md`, `SETUP.md`) |

| Area | Tools |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Styling | Tailwind CSS v4, Geist font via `next/font` |
| Hosting / CI-CD | Vercel (auto-deploy on every push, preview link for every branch) |
| Source control | Git + GitHub (pull requests for every change) |
| Domain / DNS | Namecheap (`.me` domain from the GitHub Student Developer Pack) |
| SSL | Let's Encrypt certificate issued and renewed automatically by Vercel |
| Contact backend | Next.js Route Handler → Google Apps Script → Google Drive, Sheets and Gmail |
| Code quality | ESLint, TypeScript strict type checks |

---

## Features

- **Responsive design:** works on phones (compact header, swipeable section menu, swipe gestures on the leadership carousel, inputs that don't trigger iOS zoom) and desktop.
- **Sections:** Work Experience, Collegiate Competitions & Leadership (carousel), Licenses & Certifications, Verified Skills Matrix.
- **CV:** "View CV" and "Preview Official Resume" open the PDF (`public/CV_Alejandro_Gomez.pdf`), compressed from 16.7 MB to 1.3 MB without changing how it looks.
- **Contact form → Google Drive:** visitors send a message from the site, with no email app needed (details below).

---

## How the contact form works

```
Visitor fills the form
        │  POST /api/contact
        ▼
Next.js API route (Vercel)
  • validates every field
  • hidden honeypot field to catch bots
  • rate limit: 5 messages / 10 min per IP
  • adds a shared secret
        │  HTTPS
        ▼
Google Apps Script web app (my Google account)
  • checks the shared secret
  • saves the message as a .txt file in Drive → "Website Messages"
  • adds a row to the "Message Log" spreadsheet
  • emails me (Reply goes straight to the visitor)
        │
        ▼
Website shows "Message Sent Successfully!" with the real message ID
```

**Message Log (Google Sheets) works like a small database:**
- Auto **Category** (Job / Internship, Freelance / Project, Collaboration, Networking / Question, General, Spam) and **Priority** from English and Spanish keywords
- **Status** (New, Read, Replied, Done, Spam) plus **Read** and **Replied** checkboxes that update the status automatically
- One-click **Reply** link, link to the saved file, **Notes** column, filters on every column, color coding
- **Dashboard** tab: totals, unread, waiting for reply, high priority, last 7 days, spam blocked, and a chart by category

**Security choices:**
- Secrets (`CONTACT_SCRIPT_URL`, `CONTACT_SHARED_SECRET`) live only in Vercel environment variables and Apps Script properties, never in the code
- Spreadsheet formula injection is blocked: text starting with `=`, `+`, `-` or `@` is stored as plain text
- Spam is logged but doesn't send an email

Setup steps are in [`integrations/google-drive-contact/SETUP.md`](integrations/google-drive-contact/SETUP.md).

---

## How I got the domain and put it online

### 1. The domain: Namecheap + GitHub Student Developer Pack
`alejandrogomez.me` was claimed for free through **Namecheap's `.me` offer in the [GitHub Student Developer Pack](https://education.github.com/pack)**, verified with my Florida Tech student email at [nc.me](https://nc.me).

Namecheap also offers an SSL certificate with the domain, but I didn't need to activate it: Vercel issues and renews a free Let's Encrypt certificate automatically once DNS is verified.

### 2. Hosting: GitHub → Vercel
The repo is connected to Vercel. Every push to `main` builds and deploys to production, and every other branch gets its own private preview link.

### 3. DNS: pointing the domain to Vercel
In Namecheap → **Advanced DNS**:

| Action | Type | Host | Value | Why |
|---|---|---|---|---|
| Removed | A (×4) | `@` | `185.199.108–111.153` | Default GitHub Pages IPs that conflicted with Vercel |
| Removed | CNAME | `www` | `alejandrogomez.me.` | Default record |
| Added | A | `@` | `216.198.79.1` | Vercel production IP |
| Added | CNAME | `www` | Vercel project DNS target | Points `www` to the Vercel project |

### 4. Vercel domain settings
- Added `alejandrogomez.me` and `www.alejandrogomez.me` under **Settings → Domains**
- `alejandrogomez.me` **redirects (308)** to `www.alejandrogomez.me` so there's one canonical URL
- Both show **Valid Configuration**, and HTTPS is on

---

## How changes are made

This repo is edited with help from **Claude** (Anthropic's AI assistant), following the rules in [`CLAUDE.md`](CLAUDE.md):

1. Every change goes on its own branch (`claude/...`), never straight to `main`
2. Type check and lint before pushing
3. Vercel builds a **preview link** for the branch
4. I review the preview, then merge the pull request
5. Vercel deploys to `alejandrogomez.me` in about a minute
6. If something breaks: **Instant Rollback** in Vercel, then fix on a new branch

---

## Run it locally

```bash
git clone https://github.com/alejandrojosegomez/alejandrojosegomez.github.io
cd alejandrojosegomez.github.io
npm install
npm run dev        # http://localhost:3000
```

To test the contact form locally, create `.env.local` with `CONTACT_SCRIPT_URL` and `CONTACT_SHARED_SECRET`. Without them, the form shows a "not set up" error.

## Project structure

```
app/
  page.tsx                 the whole single-page portfolio
  layout.tsx               fonts and metadata
  globals.css              Tailwind v4 styles
  api/contact/route.ts     contact form API (validation, anti-spam, forwards to Apps Script)
integrations/
  google-drive-contact/
    Code.gs                Google Apps Script: Drive file, Message Log database, email
    SETUP.md               one-time setup guide
public/
  CV_Alejandro_Gomez.pdf   resume
  assets/                  portrait, project and icon images
CLAUDE.md                  rules for AI-assisted changes
CNAME                      custom domain
```

---

## Contact

- Website: [alejandrogomez.me](https://www.alejandrogomez.me)
- LinkedIn: [linkedin.com/in/alejandro-josegomez](https://linkedin.com/in/alejandro-josegomez)
- GitHub: [@alejandrojosegomez](https://github.com/alejandrojosegomez)
