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
const launchDate = process.env.LAUNCH_DATE || "2026-09-01T09:00:00+03:00";

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

function buildConfirmationEmail(contact) {
  const name = contact.firstName || "Salut";
  return {
    subject: "Confirmare inscriere pe lista de asteptare HiLex",
    html: `
      <div style="font-family:Arial,sans-serif;color:#11163a;line-height:1.6;max-width:620px">
        <h1 style="color:#11163a">Esti pe lista de asteptare HiLex.</h1>
        <p>Buna, ${escapeHtml(name)},</p>
        <p>Iti confirmam ca inscrierea ta a fost inregistrata. Te vom anunta cand HiLex Individuals este gata de lansare.</p>
        <p style="color:#6b708c">Situatii reale. Explicatii clare. Acces rapid la informatia juridica de care ai nevoie.</p>
        <p>Echipa HiLex</p>
      </div>
    `,
    text: `Buna, ${name}!\n\nIti confirmam ca inscrierea ta pe lista de asteptare HiLex a fost inregistrata.\nTe vom anunta cand HiLex Individuals este gata de lansare.\n\nEchipa HiLex`
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

async function sendConfirmation(contact) {
  const email = buildConfirmationEmail(contact);
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
        to: contact.email,
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

  const outboxPath = path.join(outboxDir, `${contact.createdAt.replaceAll(":", "-")}-${contact.id}.json`);
  await fs.writeFile(
    outboxPath,
    `${JSON.stringify({ from, to: contact.email, ...email }, null, 2)}\n`
  );
  return { mode: "outbox", path: outboxPath };
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
      return sendJson(res, 400, { message: "Completeaza prenumele, numele si un email valid." });
    }

    if (!marketingConsent) {
      return sendJson(res, 400, { message: "Avem nevoie de acordul tau pentru a trimite confirmarea." });
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
    await sendConfirmation(result.contact);

    return sendJson(res, 200, {
      ok: true,
      created: result.created,
      message: result.created
        ? "Te-ai inscris cu succes. Verifica emailul pentru confirmare."
        : "Acest email este deja pe lista. Ti-am retrimis confirmarea."
    });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: "Nu am putut salva inscrierea. Incearca din nou." });
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
