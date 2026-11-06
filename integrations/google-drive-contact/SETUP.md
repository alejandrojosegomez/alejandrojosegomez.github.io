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

## Changing the code later
Edit the script, then **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**.
The URL stays the same.

## Turning it off
Deploy → Manage deployments → Archive. The website will show a "message not sent" error
with your email as a fallback.
