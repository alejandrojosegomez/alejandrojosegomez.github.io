# Contact form → Google Drive setup

Website form → `/api/contact` (Vercel) → Google Apps Script (your Google account)
→ saves the message in Drive + emails you.

Do this once, on a computer, logged into the Google account that should own the messages.

1. Go to https://script.google.com → **New project**. Name it `Website Contact Form`.
2. Delete the sample code, paste all of `Code.gs` from this folder, and click **Save**.
3. **Project Settings** (gear icon) → **Script properties** → **Add script property**:
   - Property: `SHARED_SECRET`
   - Value: the secret Claude gave you (same value as `CONTACT_SHARED_SECRET` in Vercel)
4. Back in **Editor**, choose the `setup` function in the toolbar and click **Run**.
   Approve the permissions (Drive, Sheets, send email as you). If Google shows
   "unverified app", click **Advanced → Go to Website Contact Form**; it's your own script.
   This creates the **Website Messages** folder and the **Message Log** sheet in your Drive.
5. **Deploy → New deployment** → type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   Click **Deploy** and copy the **Web app URL** (ends in `/exec`).
6. Put that URL in Vercel as `CONTACT_SCRIPT_URL` (Production and Preview), or send it to Claude.

## What the Message Log gives you
- **Messages** tab: one row per message with auto **Category** (Job / Internship, Freelance / Project,
  Collaboration, Networking / Question, General, Spam) and **Priority**, a **Status** dropdown
  (New, Read, Replied, Done, Spam), **Read** and **Replied** checkboxes, a one-click **✉ Reply** link,
  the saved file and a **Notes** column. Filters on every column, colors by status/category/priority.
- Ticking **Replied** marks it Read + Replied; ticking **Read** moves New → Read; Status **Done** greys the row.
- **Dashboard** tab: totals, unread, waiting for reply, high priority open, last 7 days, spam blocked,
  counts by status and category, and a pie chart.
- Spam is still logged (red, struck through) but doesn't email you.

## Changing the code later
Edit the script, then **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**.
The URL stays the same.

## Turning it off
Deploy → Manage deployments → Archive. The website will show a "message not sent" error
with your email as a fallback.
