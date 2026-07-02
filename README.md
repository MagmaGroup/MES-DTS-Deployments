# MES-DTS-Deployments

GitHub Pages hosting for Magma MES customer DTS deployment reports.

**Base URL:** `https://magmagroup.github.io/MES-DTS-Deployments/`

---

## Internal Tools

| Tool | URL | Purpose |
|---|---|---|
| Dashboard | `/magma-d8vn3k/` | Live status across all 10 customers |
| Content Editor | `/magma-d8vn3k/editor.html` | Edit ticket descriptions and test steps |

Both URLs are internal-only (security by obscurity — not linked publicly).

---

## Repository Structure

```
MES-DTS-Deployments/
├── magma-d8vn3k/           ← Internal tools (dashboard + editor)
│   ├── index.html
│   └── editor.html
├── {customer-slug}/        ← One folder per customer
│   ├── index.html          ← Customer DTS history page
│   ├── data.json           ← Source of truth for DTS content
│   └── DTS-{number}.html  ← Generated deployment report
└── README.md
```

### Customer Slugs

| Customer | Slug |
|---|---|
| Tosaf | `tosaf-54sfww` |
| Elcam | `elcam-bs3h7e` |
| Ytong | `ytong-qunmvy` |
| Tama | `tama-ij6mnp` |
| Carmit | `carmit-pys97q` |
| Motorad | `motorad-4yrxcm` |
| Rav-Bariach | `rav-bariach-0ii743` |
| Polybid | `polybid-g90djj` |
| Flex | `flex-mestd8` |
| Electra | `electra-lg43m8` |

---

## data.json Schema

`data.json` is the source of truth for all DTS content. It is read by the editor and by Claude when generating HTML reports.

```json
{
  "customer": "Rav-Bariach",
  "deployments": [
    {
      "ticketNumber": "2695",
      "title": "DTS title from Zoho",
      "status": "Open",
      "createDate": "02.07.2026",
      "deployDate": null,
      "closeDate": null,
      "ticketCount": 2,
      "url": "DTS-2695.html",
      "tickets": [
        {
          "number": "2554",
          "subject": "Ticket subject from Zoho",
          "assignee": "First Last",
          "status": "Waiting DTS",
          "isCR": false,
          "contentLocked": true,
          "description": "Manually edited description — preserved by Claude.",
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
          "description": "Fetched from Zoho — Claude may update this.",
          "testSteps": []
        }
      ]
    }
  ]
}
```

### `contentLocked` — Per-Ticket Content Lock

`contentLocked` lives on each individual ticket, not on the deployment.

| Value | Meaning |
|---|---|
| `false` | Claude fetches fresh description + test steps from Zoho on next report run |
| `true` | Claude preserves existing description + test steps — only updates subject / assignee / status / isCR from Zoho |

**What sets `contentLocked: true`:**
- Editing any field in the Content Editor (auto-locks on input)
- Clicking the lock icon manually in the Content Editor
- Running Option 6 (Edit DTS Content) via Claude

**What sets `contentLocked: false`:**
- Clicking the lock icon to unlock in the Content Editor

---

## Workflow

```
Option 4 (Populate DTS Ticket)
  → Updates Zoho DTS ticket table
  → No data.json write

Option 5 (DTS Deploy Report)
  → Reads data.json — checks contentLocked per ticket
  → Locked tickets: use stored content, skip Zoho fetch
  → Unlocked tickets: fetch description + test steps from Zoho
  → Generates DTS-{number}.html
  → Writes data.json with per-ticket contentLocked state
  → Git commits + pushes both files

Content Editor (browser)
  → Reads data.json from GitHub API
  → Edit description + test steps per ticket
  → Any edit auto-locks that ticket
  → Save commits data.json + regenerated HTML in one operation

Option 6 (Edit DTS Content) — Claude
  → Edit a specific ticket's content via Claude
  → Sets contentLocked: true on that ticket
  → Regenerates HTML + pushes
```

---

## Content Editor — Usage

1. Open `https://magmagroup.github.io/MES-DTS-Deployments/magma-d8vn3k/editor.html`
2. Enter a GitHub Personal Access Token with `repo` write scope (saved in browser localStorage)
3. Select customer → DTS → Load
4. Edit descriptions and test steps per ticket
5. Lock icon (🔒 / 🔓) on each ticket — toggle manually or edit to auto-lock
6. Click **Save & Publish** — commits `data.json` and regenerates the HTML report

**GitHub PAT setup:** `github.com → Settings → Developer settings → Personal access tokens (classic)` → scope: `repo`

---

## Deployment

All changes are served via GitHub Pages from the `master` branch. After any `git push`, GitHub Pages redeploys automatically (~1 minute).

```bash
cd "C:\Git Repos\MagmaGroup\MES-DTS-Deployments"
git add {slug}/
git commit -m "feat: DTS-{number} — {Customer}"
git push origin master
```
