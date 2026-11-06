// Recibe los mensajes del formulario de contacto y los envía al
// Google Apps Script de Alejandro, que los guarda en Google Drive
// y le manda un correo de aviso.
//
// Variables de entorno (Vercel → Settings → Environment Variables):
//   CONTACT_SCRIPT_URL     URL del Web App de Apps Script (termina en /exec)
//   CONTACT_SHARED_SECRET  misma clave guardada en el Apps Script

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

const LIMITS = { name: 100, email: 200, title: 150, message: 800 };

// Límite simple por IP (por instancia del servidor): 5 mensajes cada 10 minutos
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const recentByIp = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (recentByIp.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  recentByIp.set(ip, hits);
  return hits.length > RATE_MAX;
}

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const scriptUrl = process.env.CONTACT_SCRIPT_URL;
  const secret = process.env.CONTACT_SHARED_SECRET;
  if (!scriptUrl || !secret) {
    return Response.json(
      { ok: false, error: "The contact service is not set up yet." },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  // Campo trampa: los humanos no lo ven, los bots lo llenan.
  if (clean(body.website, 200)) {
    return Response.json({ ok: true });
  }

  const name = clean(body.name, LIMITS.name);
  const email = clean(body.email, LIMITS.email);
  const title = clean(body.title, LIMITS.title);
  const message = clean(body.message, LIMITS.message);

  if (!name || !email || !title || !message || !EMAIL_REGEX.test(email)) {
    return Response.json(
      { ok: false, error: "Please fill out every field with a valid email." },
      { status: 400 }
    );
  }

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (isRateLimited(ip)) {
    return Response.json(
      { ok: false, error: "Too many messages. Please try again in a few minutes." },
      { status: 429 }
    );
  }

  try {
    const res = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        name,
        email,
        title,
        message,
        submittedAt: new Date().toISOString(),
        userAgent: (request.headers.get("user-agent") ?? "").slice(0, 300),
      }),
      redirect: "follow",
      cache: "no-store",
    });

    const data = (await res.json().catch(() => null)) as { ok?: boolean; id?: string } | null;
    if (!res.ok || !data?.ok) {
      console.error("Contact script rejected the message", res.status, data);
      return Response.json(
        { ok: false, error: "Your message could not be delivered. Please try again." },
        { status: 502 }
      );
    }

    return Response.json({ ok: true, id: data.id ?? null });
  } catch (err) {
    console.error("Contact script request failed", err);
    return Response.json(
      { ok: false, error: "Your message could not be delivered. Please try again." },
      { status: 502 }
    );
  }
}
