# MES-DTS-Deployments

GitHub Pages hosting for Magma MES customer DTS deployment reports.

**Base URL:** `https://magmagroup.github.io/MES-DTS-Deployments/`

All DTS content lives in this repo — Zoho tickets are only the data *source*, never the
content container. Deployment IDs are global and sequential (`DTS_00001`, `DTS_00002`, ...),
shared across all customers.

---

## Internal Tools

| Tool | URL | Purpose |
|---|---|---|
| Dashboard | `/magma-d8vn3k/` | Live status across every customer, populated dynamically from `account-map.json` |
| Content Editor | `/magma-d8vn3k/editor.html` | Edit ticket descriptions, test steps, status, and dates |

Both URLs are internal-only (security by obscurity — not linked publicly).

---

## Repository Structure

```
MES-DTS-Deployments/
├── account-map.json         ← accountId → {slug, name, color} — single source of truth
├── assets/
│   ├── dts-history.js       ← renders every customer index.html from its data.json
│   ├── dts-report.js        ← renders every DTS_#####.html report from its data.json
│   └── dts-report.css       ← shared styling for report pages
├── magma-d8vn3k/             ← Internal tools
│   ├── index.html           ← Dashboard (dynamic customer list from account-map.json)
│   └── editor.html          ← Content editor — writes data.json only, nothing else
├── {customer-slug}/          ← One folder per customer (slug from account-map.json)
│   ├── index.html            ← Customer DTS history page — renders live from data.json
│   ├── data.json             ← Source of truth for this customer's DTS content
│   └── DTS_#####.html        ← Generic report shell — same 12 lines for every deployment,
│                                 renders live from data.json, never hand-edited
└── README.md
```

**Nothing renders HTML content directly.** `index.html` and every `DTS_#####.html` are static
shells that fetch `data.json` client-side and render from it. Updating a customer's history or
report page means writing `data.json` — never touching the `.html` files themselves (except the
one-time creation of a new `DTS_#####.html` shell, which is always the same boilerplate).

### Customer Slugs

Defined in `account-map.json` — do not duplicate this list elsewhere. As of this writing:
Tosaf, Elcam, Ytong, Tama, Carmit, Motorad, Rav-Bariach, Polybid, Flex, Electra.
New customers are auto-created (new slug, folder, `data.json`, `index.html`, color, and
`account-map.json` entry) the first time a ticket is seen for an unmapped `accountId`.

---

## data.json Schema

`data.json` is the single source of truth for a customer's DTS content. Both the dashboard,
the customer history page, and every report page read it directly — nothing else does.

```json
{
  "customer": "Rav-Bariach",
  "deployments": [
    {
      "ticketNumber": "DTS_00003",
      "title": "DTS_00003 # Rav-Bariach # 02.07.2026",
      "status": "Open",
      "createDate": "02.07.2026",
      "deployDate": null,
      "closeDate": null,
      "ticketCount": 2,
      "url": "DTS_00003.html",
      "checklist": {
        "familiarize_scope": true,
        "team_meeting": false,
        "schedule_date_customer": false
      },
      "tickets": [
        {
          "number": "2554",
          "subject": "Ticket subject from Zoho",
          "assignee": "First Last",
          "status": "Waiting DTS",
          "isCR": false,
          "contentLocked": true,
          "description": "Manually edited description — preserved on next sync.",
          "testSteps": [
            "Step one",
            "Step two"
          ]
        },
        {
          "number": "2600",
          "subject": "Another ticket",
          "assignee": "First Last",
          "status": "Waiting DTS",
          "isCR": true,
          "contentLocked": false,
          "description": "Fetched from Zoho — sync may update this.",
          "testSteps": []
        }
      ]
    }
  ]
}
```

`ticketNumber` and `url` always use the global `DTS_#####` ID — never the underlying Zoho
ticket number. `title` follows the fixed format `{DTS_ID} # {CustomerName} # {createDate}`.

### `contentLocked` — Per-Ticket Content Lock

`contentLocked` lives on each individual ticket, not on the deployment.

| Value | Meaning |
|---|---|
| `false` | The next DTS Sync run may refresh subject/assignee/status/description from Zoho |
| `true` | Sync preserves the existing description + test steps — only status/subject/assignee sync from Zoho |

**What sets `contentLocked: true`:** editing any field in the Content Editor (auto-locks on
input), or clicking the lock icon manually in the Content Editor.

**What sets `contentLocked: false`:** clicking the lock icon to unlock in the Content Editor.

### `checklist` — Pre-Deploy Checklist

`checklist` lives on each deployment, keyed by item id (see `assets/dts-checklist-data.js`,
the single source of truth for the item list) → `true`/`false`. Derived from the org's actual
DTS procedure (Zoho ticket #2664's custom fields). Grouped into 5 phases for display —
`prep`, `schedule`, `deploy`, `after`, and `situational` — but **all 22 items count toward
the progress total**; the grouping is purely organizational, not a filter.

New deployments are created with `checklist: {}` (all items implicitly unchecked) by the
automated sync. Missing keys default to unchecked — no backfilling required for old
deployments.

This is tracked from the **DTS Dashboard** (`magma-d8vn3k/index.html`), not the Content
Editor. Each active-DTS card shows a compact progress bar (`done/22`); clicking it opens
a checklist modal right on the dashboard where a manager can tick items and save. Saving
writes directly to that
customer's `data.json` via the GitHub Contents API, reusing the same GitHub token
(`dts_editor_pat` in `localStorage`) already used by the Content Editor — no separate
token setup. It's a **visual tracker, not a hard gate**: nothing blocks Status changes or
saves based on checklist completeness.

---

## Workflow

```
DTS Sync — automated (GitHub Actions, runs hourly, no developer machine needed)
  → .github/workflows/dts-sync.yml, cron '0 * * * *' + manual "Run workflow" button
  → .github/scripts/dts-sync.mjs scans Zoho for "Waiting DTS" tickets across all customers
  → New ticket, customer has an Open/Scheduled deployment → added to it
  → New ticket, no Open/Scheduled deployment exists       → new DTS_##### created
  → Ticket already present anywhere (any status)          → left untouched
  → Writes data.json per affected customer, plus a new report shell for any new DTS_#####,
    plus a backfilled index.html for any known customer that never had one yet
  → Commits + pushes automatically, then explicitly triggers the Pages deploy workflow
    (a bot-token push does not fire GitHub's own push-triggered workflows — see note below)

DTS Sync — manual (Claude, task intake Option 4)
  → Same logic, run on demand from a chat session instead of waiting for the hourly cron
  → Useful for testing, or syncing immediately after a status change instead of waiting

Content Editor (browser, magma-d8vn3k/editor.html)
  → Reads data.json via the GitHub API
  → Edit description, test steps, status, or dates
  → Any content edit auto-locks that ticket (contentLocked: true)
  → Save commits data.json only — history and report pages update on next page load,
    no HTML regeneration, no separate publish step
```

There is no "generate report" or "update index" step anywhere in this workflow — both were
retired once the pages moved to rendering live from `data.json`.

---

## Automated Sync (GitHub Actions)

`.github/workflows/dts-sync.yml` runs the sync unattended, every hour, on GitHub's own
infrastructure — it does not depend on any developer's computer being on.

**One-time setup required:** add 3 repository secrets under
`Settings → Secrets and variables → Actions`:

| Secret | Value |
|---|---|
| `ZOHO_CLIENT_ID` | Same value used by the `ZOHO-DTS-MCP` server's local `.env` |
| `ZOHO_CLIENT_SECRET` | Same value used by the `ZOHO-DTS-MCP` server's local `.env` |
| `ZOHO_REFRESH_TOKEN` | Same value used by the `ZOHO-DTS-MCP` server's local `.env` |

**Manual trigger:** Actions tab → **DTS Sync** → **Run workflow** — runs immediately instead
of waiting for the next hourly tick.

**Why it explicitly triggers the Pages deploy:** GitHub does not let a push made with the
default `GITHUB_TOKEN` fire other workflows' `on: push` triggers (anti-loop protection). Since
the sync commit uses that token, `deploy.yml` would never see it — so the last step of
`dts-sync.yml` runs `gh workflow run deploy.yml --ref master` directly whenever a sync actually
changed something. A normal `git push` from a developer's machine doesn't have this problem
and deploys automatically as usual.

**Script location:** `.github/scripts/dts-sync.mjs` — zero npm dependencies (uses Node's
built-in `fetch`), implements the same sync rule documented in the org template's
`MagmaMES_Skill_DTSSync.md`.

---

## Content Editor — Usage

1. Open `https://magmagroup.github.io/MES-DTS-Deployments/magma-d8vn3k/editor.html`
2. Enter a GitHub Personal Access Token with `repo` write scope (saved in browser localStorage)
3. Select customer → DTS → Load
4. Edit descriptions, test steps, status, or dates
5. Lock icon (🔒 / 🔓) on each ticket — toggle manually or edit to auto-lock
6. Click **Save & Publish** — commits `data.json`. The customer page and report page reflect
   the change on their next load; nothing else needs to run.

**GitHub PAT setup:** `github.com → Settings → Developer settings → Personal access tokens (classic)` → scope: `repo`

---

## Deployment

All changes are served via GitHub Pages from the `master` branch. After any `git push`, GitHub
Pages redeploys automatically (~1 minute) — check
`https://github.com/MagmaGroup/MES-DTS-Deployments/actions` if a page doesn't update as expected.

```bash
cd "C:\Git Repos\MagmaGroup\MES-DTS-Deployments"
git add {slug}/ account-map.json
git commit -m "sync: DTS_##### — {Customer}"
git push origin master
```

**Known sandbox quirk:** if committing from an AI sandbox mount of this repo, verify file
content via a direct read (not just the sandbox's own file listing) before committing — this
repo's mount has intermittently served stale or null-padded file reads mid-session. When in
doubt, run `git status` / open the file directly on the actual machine, not just through the
sandbox.
