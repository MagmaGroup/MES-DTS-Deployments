// Shared DTS deployment report renderer — used by every DTS_XXXXX.html page
// in every customer folder. The HTML shell for these pages is identical
// everywhere (see any existing DTS_XXXXX.html for the template); this script
// does all the work:
//   1. Derives the deployment ID (e.g. "DTS_00001") from the page filename.
//   2. Derives the customer slug from the folder name in the URL.
//   3. Fetches ./data.json (same folder) and finds the matching deployment.
//   4. Fetches ../account-map.json to get the customer's display name + accent color.
//   5. Renders the full report: header meta + one card per included ticket.
// Nothing here should ever need hand-editing per deployment — only data.json
// changes.
(function () {
  function t(key, vars) {
    return window.DtsI18n ? window.DtsI18n.t(key, vars) : key;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function cell(value) {
    return value ? escapeHtml(value) : '<span class="na-block">—</span>';
  }

  function badgeHtml(status) {
    const s = (status || '').toLowerCase();
    if (s === 'open') return `<span class="badge badge-open"><span class="badge-dot"></span>${t('statusOpen')}</span>`;
    if (s === 'scheduled') return `<span class="badge badge-scheduled"><span class="badge-dot"></span>${t('statusScheduled')}</span>`;
    if (s === 'closed') return `<span class="badge badge-closed"><span class="badge-dot"></span>${t('statusClosed')}</span>`;
    return status ? `<span class="badge">${escapeHtml(status)}</span>` : '';
  }

  // Every content section (original description, summary, test steps) only
  // renders when it actually has content — an empty field means clean empty
  // space below the subject/assignee, never a "No X yet" placeholder.
  function ticketCardHtml(tk) {
    const badges = [];
    if (tk.isCR) badges.push(`<span class="badge badge-cr">${t('cr')}</span>`);
    if (tk.status) badges.push(`<span class="badge badge-closed">${escapeHtml(tk.status)}</span>`);
    if (tk.contentLocked) badges.push(`<span class="badge badge-locked">🔒 ${t('locked')}</span>`);

    const sections = [];

    if (tk.originalDescription) {
      sections.push(`<div class="ticket-section">
        <div class="ticket-section-label">${t('originalDescription')}</div>
        <div class="ticket-original-description" dir="auto">${escapeHtml(tk.originalDescription)}</div>
      </div>`);
    }

    // Skip the summary section entirely if it's empty, or if it's identical
    // to the original description (i.e. no AI summary was actually drafted
    // for this ticket) — showing the same text twice serves no one.
    if (tk.description && tk.description !== tk.originalDescription) {
      sections.push(`<div class="ticket-section">
        <div class="ticket-section-label">${t('summary')}</div>
        <div class="ticket-description" dir="auto">${escapeHtml(tk.description)}</div>
      </div>`);
    } else if (tk.description && !tk.originalDescription) {
      // No originalDescription on record at all (older ticket, pre-dates that
      // field) — description is the only text we have, still show it.
      sections.push(`<div class="ticket-section">
        <div class="ticket-section-label">${t('description')}</div>
        <div class="ticket-description" dir="auto">${escapeHtml(tk.description)}</div>
      </div>`);
    }

    if (tk.testSteps && tk.testSteps.length) {
      sections.push(`<div class="ticket-section">
        <div class="ticket-section-label">${t('testSteps')}</div>
        <ol class="test-steps" dir="auto">${tk.testSteps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
      </div>`);
    }

    return `<div class="ticket-card">
      <div class="ticket-card-head">
        <div class="ticket-head-left">
          <span class="ticket-number">#${escapeHtml(tk.number)}</span>
        </div>
        <div class="ticket-badges">${badges.join('')}</div>
      </div>
<div class="ticket-subject" dir="auto">${escapeHtml(tk.subject)}</div>
      <div class="ticket-assignee">${tk.assignee ? t('assignedTo', { name: escapeHtml(tk.assignee) }) : ''}</div>
      ${sections.join('')}
    </div>`;
  }

  function langToggleHtml() {
    return '<button type="button" id="lang-toggle" class="lang-toggle-btn">עב</button>';
  }

  function renderNotFound(root, ticketId) {
    root.innerHTML = `<canvas class="star-canvas" id="star-canvas"></canvas>
    <main>
      <div class="report-toolbar">
        <a class="back-link" href="./index.html">&larr; ${t('backToHistory')}</a>
        ${langToggleHtml()}
      </div>
      <div class="empty-block">🚀 ${t('reportNotFound', { id: escapeHtml(ticketId) })}</div>
    </main>`;
    initStarField();
    if (window.DtsI18n) window.DtsI18n.init();
  }

  function renderReport(root, dep, customerName, accent) {
    document.title = `${dep.ticketNumber} — ${customerName}`;
    document.documentElement.style.setProperty('--accent', accent);

    const count = dep.ticketCount != null ? dep.ticketCount : (dep.tickets ? dep.tickets.length : 0);
    const tickets = dep.tickets && dep.tickets.length
      ? dep.tickets.map(ticketCardHtml).join('')
      : `<div class="empty-block">${t('noTickets')}</div>`;

    root.innerHTML = `<canvas class="star-canvas" id="star-canvas"></canvas>
    <main>
      <div class="report-toolbar">
        <a class="back-link" href="./index.html">&larr; ${t('backToHistory')}</a>
        ${langToggleHtml()}
      </div>
      <div class="report-header">
        <div class="report-pill">${escapeHtml(customerName)}</div>
        <div class="report-head-row">
          <div class="report-id">${escapeHtml(dep.ticketNumber)}</div>
          ${badgeHtml(dep.status)}
        </div>
        <div class="report-title" dir="auto">${escapeHtml(dep.title)}</div>
        <div class="report-meta">
          <div><div class="meta-col-label">${t('metaCreated')}</div><div class="meta-col-value">${cell(dep.createDate)}</div></div>
          <div><div class="meta-col-label">${t('metaDeployDate')}</div><div class="meta-col-value ${dep.deployDate ? '' : 'na'}">${cell(dep.deployDate)}</div></div>
          <div><div class="meta-col-label">${t('metaCloseDate')}</div><div class="meta-col-value ${dep.closeDate ? '' : 'na'}">${cell(dep.closeDate)}</div></div>
          <div><div class="meta-col-label">${t('metaTickets')}</div><div class="meta-col-value">${count}</div></div>
        </div>
      </div>
      <div class="tickets-label">${t('includedTickets')}</div>
      <div class="ticket-list">${tickets}</div>
    </main>`;
    initStarField();
    if (window.DtsI18n) window.DtsI18n.init();
  }

  // Same biased-fade star field used on the dashboard and history pages —
  // stars cluster toward the top and dim out before the gradient reaches
  // the fully-light zone, so the transition reads as a smooth space-to-
  // daylight effect instead of a hard cutoff.
  function initStarField() {
    const canvas = document.getElementById('star-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    function drawStars() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      for (let i = 0; i < 160; i++) {
        const y = Math.pow(Math.random(), 1.6) * canvas.height;
        const fade = 1 - (y / canvas.height) * 0.85;
        ctx.beginPath();
        ctx.arc(Math.random() * canvas.width, y, Math.random() * 1.2 + 0.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${(fade * (Math.random() * 0.5 + 0.15)).toFixed(2)})`;
        ctx.fill();
      }
    }
    drawStars();
    window.addEventListener('resize', drawStars);
  }

  async function init() {
    const root = document.getElementById('dts-report');
    if (!root) return;

    // "DTS_00001.html" -> "DTS_00001"
    const ticketId = location.pathname.split('/').pop().replace(/\.html$/i, '');
    // ".../<slug>/DTS_00001.html" -> "<slug>"
    const pathParts = location.pathname.split('/').filter(Boolean);
    const slug = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : '';

    let customerName = '';
    let accent = '#38bdf8';
    try {
      const mapRes = await fetch(`../account-map.json?_=${Date.now()}`);
      if (mapRes.ok) {
        const map = await mapRes.json();
        const entry = (map.customers || []).find((c) => c.slug === slug);
        if (entry) {
          customerName = entry.name;
          accent = entry.color || accent;
        }
      }
    } catch (e) {
      // Fall back to defaults below.
    }

    let dep = null;
    try {
      const res = await fetch(`./data.json?_=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        customerName = customerName || data.customer || '';
        dep = (data.deployments || []).find((d) => d.ticketNumber === ticketId) || null;
      }
    } catch (e) {
      // No data.json — dep stays null, renderNotFound below.
    }

    if (!dep) {
      window.addEventListener('dts-lang-changed', () => renderNotFound(root, ticketId));
      renderNotFound(root, ticketId);
      return;
    }
    const name = customerName || 'Customer';
    window.addEventListener('dts-lang-changed', () => renderReport(root, dep, name, accent));
    renderReport(root, dep, name, accent);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
