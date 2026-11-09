"use client";

import { Analytics } from "@vercel/analytics/next";

// Vercel Web Analytics for the public site. Visits to /admin are not counted.
export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => (new URL(event.url).pathname.startsWith("/admin") ? null : event)}
    />
  );
}
