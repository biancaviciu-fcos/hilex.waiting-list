import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const configuredDataDir = process.env.DATA_DIR || path.join(__dirname, "data");
const dataDir = path.isAbsolute(configuredDataDir)
  ? configuredDataDir
  : path.join(__dirname, configuredDataDir);
const contactsJson = path.join(dataDir, "contacts.json");
const contactsCsv = path.join(dataDir, "contacts.csv");
const outboxDir = path.join(dataDir, "email-outbox");

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";
const launchDate = process.env.LAUNCH_DATE || "2026-06-26T14:00:00+01:00";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

async function ensureStorage() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(outboxDir, { recursive: true });
  try {
    await fs.access(contactsJson);
  } catch {
    await fs.writeFile(contactsJson, "[]\n");
  }
  try {
    await fs.access(contactsCsv);
  } catch {
    await fs.writeFile(
      contactsCsv,
      "id,createdAt,firstName,lastName,email,marketingConsent,source\n"
    );
  }
}

async function readContacts() {
  await ensureStorage();
  const raw = await fs.readFile(contactsJson, "utf8");
  return JSON.parse(raw || "[]");
}

async function saveContact(contact) {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return saveContactToSupabase(contact);
  }

  const contacts = await readContacts();
  const existing = contacts.find((item) => normalizeEmail(item.email) === contact.email);
  if (existing) {
    return { contact: existing, created: false };
  }

  contacts.push(contact);
  await fs.writeFile(contactsJson, `${JSON.stringify(contacts, null, 2)}\n`);
  await fs.appendFile(
    contactsCsv,
    [
      contact.id,
      contact.createdAt,
      contact.firstName,
      contact.lastName,
      contact.email,
      contact.marketingConsent,
      contact.source
    ].map(csvCell).join(",") + "\n"
  );
  return { contact, created: true };
}

async function supabaseRequest(pathname, options = {}) {
  const baseUrl = process.env.SUPABASE_URL
    .replace(/\/$/, "")
    .replace(/\/rest\/v1$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${baseUrl}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase request failed: ${message}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function saveContactToSupabase(contact) {
  const emailFilter = encodeURIComponent(contact.email);
  const existingRows = await supabaseRequest(
    `waitlist_contacts?email=eq.${emailFilter}&select=*`
  );

  if (existingRows.length > 0) {
    const existing = mapSupabaseContact(existingRows[0]);
    return { contact: existing, created: false };
  }

  const rows = await supabaseRequest("waitlist_contacts", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id: contact.id,
      created_at: contact.createdAt,
      first_name: contact.firstName,
      last_name: contact.lastName,
      email: contact.email,
      marketing_consent: contact.marketingConsent,
      source: contact.source
    })
  });

  return { contact: mapSupabaseContact(rows[0]), created: true };
}

function mapSupabaseContact(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    marketingConsent: row.marketing_consent,
    source: row.source
  };
}

function buildConfirmationEmail(contact) {
  const name = escapeHtml(contact.firstName || "Salut");
  return {
    subject: `${contact.firstName}, ești pe lista de așteptare HiLex`,
    html: `
      <div style="margin:0;padding:0;background:#f7f6fb;font-family:Arial,sans-serif;color:#10143d">
        <div style="max-width:640px;margin:0 auto;padding:36px 18px">
          <div style="background:#ffffff;border:1px solid #e7e4f0;border-radius:18px;overflow:hidden">
            <div style="padding:28px 32px;background:#11186a;color:#ffffff">
              <div style="font-size:34px;font-weight:800;letter-spacing:0">Hi<span style="color:#c9037b">Lex</span></div>
              <div style="margin-top:8px;color:#f5c4df;font-size:12px;font-weight:700;letter-spacing:5px">INDIVIDUALS</div>
            </div>
            <div style="padding:34px 32px;line-height:1.65">
              <p style="margin:0 0 12px;color:#c9037b;font-weight:700">Înscriere confirmată</p>
              <h1 style="margin:0 0 22px;color:#11163a;font-size:32px;line-height:1.15">Bună, ${name}. Ești pe lista de așteptare HiLex.</h1>
              <p style="margin:0 0 18px;font-size:17px">Îți confirmăm că înscrierea ta a fost înregistrată. Te vom anunța când HiLex Individuals este gata de lansare.</p>
              <p style="margin:0 0 22px;font-size:17px">Pregătim un loc în care informația juridică este explicată clar, pentru situații reale din viața de zi cu zi.</p>
              <div style="margin:26px 0;padding:20px;border-radius:14px;background:#f4f3fb;color:#343958">
                <strong style="display:block;margin-bottom:8px;color:#11163a">Ce urmează?</strong>
                Vei primi noutăți despre lansare, acces prioritar și update-uri despre HiLex Individuals.
              </div>
              <p style="margin:0;color:#6b708c">Situații reale. Explicații clare. Acces la informația juridică atunci când contează.</p>
              <p style="margin:26px 0 0">Cu drag,<br />Echipa HiLex</p>
            </div>
          </div>
        </div>
      </div>
    `,
    text: `Bună, ${contact.firstName || ""}!\n\nEști pe lista de așteptare HiLex.\n\nÎți confirmăm că înscrierea ta a fost înregistrată. Te vom anunța când HiLex Individuals este gata de lansare.\n\nPregătim un loc în care informația juridică este explicată clar, pentru situații reale din viața de zi cu zi.\n\nCu drag,\nEchipa HiLex`
  };
}

function buildInternalNotificationEmail(contact, created) {
  const firstName = escapeHtml(contact.firstName);
  const lastName = escapeHtml(contact.lastName);
  const email = escapeHtml(contact.email);
  const notificationType = created ? "Înscriere nouă" : "Formular retrimis";
  const notificationTitle = created
    ? `${firstName} ${lastName} s-a înscris pe lista de așteptare.`
    : `${firstName} ${lastName} a retrimis formularul de așteptare.`;
  const footer = created
    ? "Contactul a fost salvat în lista HiLex Individuals."
    : "Contactul există deja în lista HiLex Individuals.";
  const createdAt = new Date(contact.createdAt).toLocaleString("ro-RO", {
    timeZone: "Europe/Bucharest",
    dateStyle: "medium",
    timeStyle: "short"
  });

  return {
    subject: `${notificationType} pe lista HiLex: ${contact.firstName} ${contact.lastName}`,
    html: `
      <div style="margin:0;padding:0;background:#f7f6fb;font-family:Arial,sans-serif;color:#10143d">
        <div style="max-width:620px;margin:0 auto;padding:32px 18px">
          <div style="background:#ffffff;border:1px solid #e7e4f0;border-radius:18px;overflow:hidden">
            <div style="padding:24px 28px;background:#11186a;color:#ffffff">
              <div style="font-size:30px;font-weight:800;letter-spacing:0">Hi<span style="color:#c9037b">Lex</span></div>
              <div style="margin-top:8px;color:#f5c4df;font-size:12px;font-weight:700;letter-spacing:4px">WAITLIST</div>
            </div>
            <div style="padding:30px 28px;line-height:1.6">
              <p style="margin:0 0 10px;color:#c9037b;font-weight:700">${notificationType}</p>
              <h1 style="margin:0 0 20px;color:#11163a;font-size:28px;line-height:1.18">${notificationTitle}</h1>
              <div style="margin:0 0 22px;padding:18px;border-radius:14px;background:#f4f3fb;color:#343958">
                <p style="margin:0 0 8px"><strong>Nume:</strong> ${firstName} ${lastName}</p>
                <p style="margin:0 0 8px"><strong>Email:</strong> <a href="mailto:${email}" style="color:#c9037b">${email}</a></p>
                <p style="margin:0 0 8px"><strong>Dată:</strong> ${createdAt}</p>
                <p style="margin:0"><strong>Acord marketing:</strong> ${contact.marketingConsent ? "Da" : "Nu"}</p>
              </div>
              <p style="margin:0;color:#6b708c">${footer}</p>
            </div>
          </div>
        </div>
      </div>
    `,
    text: `${notificationType} pe lista HiLex\n\nNume: ${contact.firstName} ${contact.lastName}\nEmail: ${contact.email}\nDată: ${createdAt}\nAcord marketing: ${contact.marketingConsent ? "Da" : "Nu"}\n\n${footer}`
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function getNotificationEmails() {
  return String(process.env.NOTIFICATION_EMAILS || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

async function deliverEmail(email, to, label) {
  const from = process.env.FROM_EMAIL || "HiLex <noreply@example.com>";

  if (process.env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to,
        subject: email.subject,
        html: email.html,
        text: email.text
      })
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Resend email failed: ${message}`);
    }
    return { mode: "resend" };
  }

  await ensureStorage();
  const outboxPath = path.join(
    outboxDir,
    `${new Date().toISOString().replaceAll(":", "-")}-${crypto.randomUUID()}-${label}.json`
  );
  await fs.writeFile(
    outboxPath,
    `${JSON.stringify({ from, to, ...email }, null, 2)}\n`
  );
  return { mode: "outbox", path: outboxPath };
}

async function sendConfirmation(contact) {
  return deliverEmail(buildConfirmationEmail(contact), contact.email, `${contact.id}-confirmation`);
}

async function sendInternalNotification(contact, created) {
  const recipients = getNotificationEmails();
  if (recipients.length === 0) {
    return { mode: "skipped" };
  }

  const email = buildInternalNotificationEmail(contact, created);
  const results = [];
  for (const recipient of recipients) {
    results.push(await deliverEmail(email, recipient, `${contact.id}-internal-notification`));
  }
  return { mode: "sent", results };
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
    if (Buffer.concat(chunks).length > 1_000_000) {
      throw new Error("Payload too large");
    }
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function handleWaitlist(req, res) {
  try {
    const body = await parseBody(req);
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const email = normalizeEmail(body.email);
    const marketingConsent = Boolean(body.marketingConsent);

    if (!firstName || !lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendJson(res, 400, { message: "Completează prenumele, numele și un email valid." });
    }

    if (!marketingConsent) {
      return sendJson(res, 400, { message: "Avem nevoie de acordul tău pentru a trimite confirmarea." });
    }

    const contact = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      firstName,
      lastName,
      email,
      marketingConsent,
      source: "HiLex Individuals waitlist"
    };

    const result = await saveContact(contact);
    let confirmationSent = true;
    let internalNotificationSent = true;

    try {
      await sendConfirmation(result.contact);
    } catch (emailError) {
      confirmationSent = false;
      console.error("Confirmation email failed:", emailError);
    }

    try {
      const notificationResult = await sendInternalNotification(result.contact, result.created);
      internalNotificationSent = notificationResult.mode !== "skipped";
    } catch (emailError) {
      internalNotificationSent = false;
      console.error("Internal notification email failed:", emailError);
    }

    return sendJson(res, 200, {
      ok: true,
      created: result.created,
      confirmationSent,
      internalNotificationSent,
      message: result.created
        ? confirmationSent
          ? "Te-ai înscris cu succes. Verifică emailul pentru confirmare."
          : "Te-ai înscris cu succes. Emailul de confirmare va fi trimis în curând."
        : confirmationSent
          ? "Acest email este deja pe listă. Ți-am retrimis confirmarea."
          : "Acest email este deja pe listă. Confirmarea va fi retrimisă în curând."
    });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: "Nu am putut salva înscrierea. Încearcă din nou." });
  }
}

async function serveStatic(req, res) {
  const requestedPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const safePath = requestedPath === "/" ? "/index.html" : requestedPath;
  const filePath = path.normalize(path.join(publicDir, safePath));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  try {
    let content = await fs.readFile(filePath);
    if (path.basename(filePath) === "index.html") {
      content = Buffer.from(String(content).replace("__LAUNCH_DATE__", launchDate));
    }
    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
    });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

await ensureStorage();

createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }
  if (req.method === "POST" && req.url === "/api/waitlist") {
    handleWaitlist(req, res);
    return;
  }
  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }
  res.writeHead(405);
  res.end("Method not allowed");
}).listen(PORT, HOST, () => {
  console.log(`HiLex waitlist running at http://${HOST}:${PORT}`);
});
