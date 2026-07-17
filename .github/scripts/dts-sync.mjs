// dts-sync.mjs
//
// Unattended version of MagmaMES_Skill_DTSSync.md — runs hourly via
// .github/workflows/dts-sync.yml (GitHub Actions, always-on, no dependency on
// any developer machine being awake).
//
// Scans Zoho Desk for MES tickets in "Waiting DTS" status and syncs each
// customer's data.json here in MES-DTS-Deployments to match. Never writes or
// regenerates report HTML except the one-time generic shell for a brand-new
// deployment ID (report pages render live from data.json via assets/dts-report.js).
//
// Zero npm dependencies — uses Node's built-in fetch (Node 18+).
//
// Required environment variables (set as GitHub Actions secrets on this repo):
//   ZOHO_CLIENT_ID
//   ZOHO_CLIENT_SECRET
//   ZOHO_REFRESH_TOKEN

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const ZOHO_BASE_URL = "https://desk.zoho.com/api/v1";
const ZOHO_TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token";
const MES_DEPARTMENT_ID = "1041021000000819029";
const STATUSES = ["waiting dts"]; // lower-cased match against ticket.status

const PALETTE = [
  "#818cf8", "#38bdf8", "#34d399", "#fbbf24", "#f87171",
  "#a78bfa", "#2dd4bf", "#fb923c", "#f472b6", "#60a5fa",
  "#c084fc", "#4ade80", "#facc15", "#fb7185", "#22d3ee",
];

// ---------------------------------------------------------------------------
// Zoho auth + fetch helpers
// ---------------------------------------------------------------------------

let accessToken = null;
let tokenExpiresAt = 0;

async function refreshAccessToken() {
  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token",
  });

  const res = await fetch(ZOHO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Zoho token refresh failed: ${JSON.stringify(data)}`);
  }
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
}

async function getAccessToken() {
  if (!accessToken || Date.now() >= tokenExpiresAt) {
    await refreshAccessToken();
  }
  return accessToken;
}

async function zohoGet(pathSuffix, params = {}, attempt = 1) {
  const token = await getAccessToken();
  const url = new URL(`${ZOHO_BASE_URL}${pathSuffix}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  const bodyText = await res.text();

  if (!res.ok) {
    throw new Error(`Zoho GET ${pathSuffix} failed (${res.status}): ${bodyText}`);
  }

  // Zoho occasionally returns 200 with an empty body (transient) instead of
  // a real payload. Retry a couple of times with backoff before giving up.
  if (!bodyText) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      return zohoGet(pathSuffix, params, attempt + 1);
    }
    throw new Error(`Zoho GET ${pathSuffix} returned an empty body after ${attempt} attempts (status ${res.status})`);
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    throw new Error(`Zoho GET ${pathSuffix} returned invalid JSON (status ${res.status}): ${bodyText.slice(0, 500)}`);
  }
}

// ---------------------------------------------------------------------------
// Step 1 — fetch all MES tickets in Waiting DTS status
// ---------------------------------------------------------------------------

async function listMesTickets() {
  const all = [];
  let from = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await zohoGet("/tickets", {
      departmentId: MES_DEPARTMENT_ID,
      from,
      limit: 50,
      include: "assignee",
    });
    const page = result?.data || [];
    all.push(...page);
    hasMore = page.length === 50;
    from += 50;
  }

  const seen = new Set();
  const statusSet = new Set(STATUSES);
  const filtered = all.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    if ((t.statusType || "").toLowerCase() === "closed") return false;
    return statusSet.has((t.status || "").toLowerCase());
  });

  // Enrich each with full detail — no `include` param here on purpose:
  // /tickets/{id} returns `cf` and `description` by default, and passing
  // include=cf,assignee was found to suppress `cf` (confirmed Zoho quirk).
  const enriched = await Promise.all(
    filtered.map(async (t) => {
      try {
        const detail = await zohoGet(`/tickets/${t.id}`);
        return {
          id: t.id,
          ticketNumber: t.ticketNumber,
          subject: t.subject,
          status: t.status,
          accountId: t.accountId,
          ticketType: detail.cf?.cf_ticket_type || null,
          description: detail.description || "",
          assignee: detail.assignee || t.assignee || null,
        };
      } catch {
        return {
          id: t.id,
          ticketNumber: t.ticketNumber,
          subject: t.subject,
          status: t.status,
          accountId: t.accountId,
          ticketType: null,
          description: "",
          assignee: t.assignee || null,
        };
      }
    })
  );

  return enriched;
}

async function listAccounts() {
  const all = [];
  let from = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await zohoGet("/accounts", { from, limit: 99 });
    const page = result?.data || [];
    all.push(...page);
    hasMore = page.length === 99;
    from += 99;
  }

  return all.map((a) => ({ id: a.id, accountName: a.accountName }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(html) {
  return (html || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function hashSlug(slug) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h;
}

function randomSuffix(len = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function slugify(accountName) {
  const firstWord = (accountName || "customer").trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${firstWord || "customer"}-${randomSuffix()}`;
}

function todayDDMMYYYY() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("day")}.${get("month")}.${get("year")}`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, data) {
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

const REPORT_SHELL = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>DTS Report</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="../assets/dts-report.css" />
</head>
<body>
  <div id="dts-report"></div>
  <script src="../assets/dts-report.js"></script>
</body>
</html>
`;

async function writeReportShell(slug, dtsId) {
  await writeFile(path.join(REPO_ROOT, slug, `${dtsId}.html`), REPORT_SHELL, "utf8");
}

async function ensureIndexHtml(slug, name, color) {
  const indexPath = path.join(REPO_ROOT, slug, "index.html");
  if (existsSync(indexPath)) return;

  const templatePath = path.join(REPO_ROOT, "elcam-bs3h7e", "index.html");
  let template = await readFile(templatePath, "utf8");
  template = template.replaceAll("Elcam", name).replaceAll("#38bdf8", color);
  await writeFile(indexPath, template, "utf8");
}

async function createCustomerFolder(slug, name, color) {
  const dir = path.join(REPO_ROOT, slug);
  await mkdir(dir, { recursive: true });
  await writeJson(path.join(dir, "data.json"), { customer: name, deployments: [] });
  await ensureIndexHtml(slug, name, color);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const summaryLines = [];
  const touchedSlugs = new Set();

  const tickets = await listMesTickets();
  if (tickets.length === 0) {
    console.log("No tickets in Waiting DTS status found. Nothing to sync.");
    return;
  }

  const accountMapPath = path.join(REPO_ROOT, "account-map.json");
  const accountMap = await readJson(accountMapPath);
  let accountMapChanged = false;

  const byAccount = new Map();
  for (const t of tickets) {
    if (!byAccount.has(t.accountId)) byAccount.set(t.accountId, []);
    byAccount.get(t.accountId).push(t);
  }

  let zohoAccounts = null; // lazy-fetch only if an unknown accountId shows up

  // Resolve every accountId to a customer entry, auto-creating new ones.
  const resolved = new Map(); // accountId -> { name, slug, color }
  const unresolved = [];

  for (const accountId of byAccount.keys()) {
    let entry = accountMap.customers.find((c) => c.accountId === accountId);

    if (!entry) {
      if (!zohoAccounts) zohoAccounts = await listAccounts();
      const account = zohoAccounts.find((a) => a.id === accountId);

      if (!account) {
        unresolved.push(accountId);
        continue;
      }

      const slug = slugify(account.accountName);
      const color = PALETTE[hashSlug(slug) % PALETTE.length];
      entry = { name: account.accountName, slug, color, accountId };

      await createCustomerFolder(slug, account.accountName, color);
      accountMap.customers.push(entry);
      accountMapChanged = true;
      touchedSlugs.add(slug);
      summaryLines.push(`New customer detected: ${account.accountName} -> created ${slug}`);
    }

    resolved.set(accountId, entry);
  }

  if (unresolved.length > 0) {
    summaryLines.push(`Skipped ${unresolved.length} ticket(s) with unresolvable accountId: ${unresolved.join(", ")}`);
  }

  // Step 3 — next global DTS id, scanning every customer's data.json.
  let maxId = 0;
  for (const c of accountMap.customers) {
    const dataPath = path.join(REPO_ROOT, c.slug, "data.json");
    if (!existsSync(dataPath)) continue;
    const data = await readJson(dataPath);
    for (const dep of data.deployments || []) {
      const m = /^DTS_(\d+)$/.exec(dep.ticketNumber || "");
      if (m) maxId = Math.max(maxId, parseInt(m[1], 10));
    }
  }
  let nextIdNum = maxId + 1;
  const nextDtsId = () => `DTS_${String(nextIdNum++).padStart(5, "0")}`;

  const today = todayDDMMYYYY();

  // Step 4 — apply sync rule per customer.
  for (const [accountId, customerTickets] of byAccount.entries()) {
    const entry = resolved.get(accountId);
    if (!entry) continue; // already flagged in unresolved

    const dataPath = path.join(REPO_ROOT, entry.slug, "data.json");
    const data = existsSync(dataPath) ? await readJson(dataPath) : { customer: entry.name, deployments: [] };

    // Known customer (already in account-map.json) but this is the first time
    // it's ever had a deployment — folder/index.html may not exist yet.
    await mkdir(path.join(REPO_ROOT, entry.slug), { recursive: true });
    await ensureIndexHtml(entry.slug, entry.name, entry.color);

    const existingNumbers = new Set();
    for (const dep of data.deployments) {
      for (const tk of dep.tickets) existingNumbers.add(tk.number);
    }

    const openOrScheduled = data.deployments.filter((d) => d.status === "Open" || d.status === "Scheduled");
    if (openOrScheduled.length > 1) {
      summaryLines.push(`${entry.name}: SKIPPED — has ${openOrScheduled.length} Open/Scheduled deployments (data inconsistency), resolve manually.`);
      continue;
    }

    const newTickets = customerTickets.filter((t) => !existingNumbers.has(t.ticketNumber));
    if (newTickets.length === 0) continue;

    let target = openOrScheduled[0] || null;
    let createdNewDeployment = false;
    let usedDtsId = target?.ticketNumber;

    for (const t of newTickets) {
      if (!target) {
        usedDtsId = nextDtsId();
        target = {
          ticketNumber: usedDtsId,
          title: `${usedDtsId} # ${entry.name} # ${today}`,
          status: "Open",
          createDate: today,
          deployDate: null,
          closeDate: null,
          ticketCount: 0,
          url: `${usedDtsId}.html`,
          tickets: [],
          checklist: {}, // pre-deploy checklist, tracked/edited in the Content Editor
        };
        data.deployments.push(target);
        createdNewDeployment = true;
      }

      target.tickets.push({
        number: t.ticketNumber,
        subject: t.subject || "",
        assignee: t.assignee ? `${t.assignee.firstName || ""} ${t.assignee.lastName || ""}`.trim() : null,
        status: t.status,
        isCR: (t.ticketType || "").toLowerCase() === "change request",
        contentLocked: false,
        description: stripHtml(t.description),
        testSteps: [],
      });
      target.ticketCount = target.tickets.length;
    }

    if (createdNewDeployment) {
      await writeReportShell(entry.slug, usedDtsId);
      summaryLines.push(`${entry.name}: ${usedDtsId} created (${newTickets.length} ticket(s))`);
    } else {
      summaryLines.push(`${entry.name}: +${newTickets.length} ticket(s) added to ${usedDtsId}`);
    }

    await writeJson(dataPath, data);
    touchedSlugs.add(entry.slug);
  }

  if (accountMapChanged) {
    await writeJson(accountMapPath, accountMap);
  }

  if (touchedSlugs.size === 0 && !accountMapChanged) {
    console.log("All tickets already accounted for. Nothing to sync.");
    return;
  }

  console.log("DTS Sync summary:");
  for (const line of summaryLines) console.log(`  ${line}`);

  // Signal to the workflow (via stdout marker) which paths changed, so it
  // knows what to `git add` before committing.
  console.log(`::dts-sync-touched::${[...touchedSlugs].join(",")}`);
  console.log(`::dts-sync-account-map-changed::${accountMapChanged}`);
  console.log(`::dts-sync-summary::${tickets.length} tickets scanned, ${summaryLines.length} change line(s)`);
}

main().catch((err) => {
  console.error("DTS Sync failed:", err);
  process.exit(1);
});
