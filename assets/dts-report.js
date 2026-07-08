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
    if (s === 'open') return '<span class="badge badge-open"><span class="badge-dot"></span>Open</span>';
    if (s === 'scheduled') return '<span class="badge badge-scheduled"><span class="badge-dot"></span>Scheduled</span>';
    if (s === 'closed') return '<span class="badge badge-closed"><span class="badge-dot"></span>Closed</span>';
    return status ? `<span class="badge">${escapeHtml(status)}</span>` : '';
  }

  function ticketCardHtml(t) {
    const badges = [];
    if (t.isCR) badges.push('<span class="badge badge-cr">CR</span>');
    if (t.status) badges.push(`<span class="badge badge-closed">${escapeHtml(t.status)}</span>`);
    if (t.contentLocked) badges.push('<span class="badge badge-locked">🔒 Locked</span>');

    const steps =
      t.testSteps && t.testSteps.length
        ? `<ol class="test-steps">${t.testSteps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>`
        : '<div class="na-block">No test steps recorded yet</div>';

    return `<div class="ticket-card">
      <div class="ticket-card-head">
        <div class="ticket-head-left">
          <span class="ticket-number">#${escapeHtml(t.number)}</span>
        </div>
        <div class="ticket-badges">${badges.join('')}</div>
      </div>
      <div class="ticket-subject">${escapeHtml(t.subject)}</div>
      <div class="ticket-assignee">${t.assignee ? 'Assigned to ' + escapeHtml(t.assignee) : ''}</div>
      <div class="ticket-section-label">Description</div>
      <div class="ticket-description">${t.description ? escapeHtml(t.description) : '<span class="na-block">No description</span>'}</div>
      <div class="ticket-section-label">Test Steps</div>
      ${steps}
    </div>`;
  }

  function renderNotFound(root, ticketId) {
    root.innerHTML = `<main>
      <a class="back-link" href="./index.html">&larr; Back to deployment history</a>
      <div class="empty-block">🚀 Report ${escapeHtml(ticketId)} not found</div>
    </main>`;
  }

  function renderReport(root, dep, customerName, accent) {
    document.title = `${dep.ticketNumber} — ${customerName}`;
    document.documentElement.style.setProperty('--accent', accent);

    const count = dep.ticketCount != null ? dep.ticketCount : (dep.tickets ? dep.tickets.length : 0);
    const tickets = dep.tickets && dep.tickets.length
      ? dep.tickets.map(ticketCardHtml).join('')
      : '<div class="empty-block">No tickets in this deployment yet</div>';

    root.innerHTML = `<main>
      <a class="back-link" href="./index.html">&larr; Back to deployment history</a>
      <div class="report-header">
        <div class="report-pill">${escapeHtml(customerName)}</div>
        <div class="report-head-row">
          <div class="report-id">${escapeHtml(dep.ticketNumber)}</div>
          ${badgeHtml(dep.status)}
        </div>
        <div class="report-title">${escapeHtml(dep.title)}</div>
        <div class="report-meta">
          <div><div class="meta-col-label">Created</div><div class="meta-col-value">${cell(dep.createDate)}</div></div>
          <div><div class="meta-col-label">Deploy Date</div><div class="meta-col-value ${dep.deployDate ? '' : 'na'}">${cell(dep.deployDate)}</div></div>
          <div><div class="meta-col-label">Close Date</div><div class="meta-col-value ${dep.closeDate ? '' : 'na'}">${cell(dep.closeDate)}</div></div>
          <div><div class="meta-col-label">Tickets</div><div class="meta-col-value">${count}</div></div>
        </div>
      </div>
      <div class="tickets-label">Included Tickets</div>
      <div class="ticket-list">${tickets}</div>
    </main>`;
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
      renderNotFound(root, ticketId);
      return;
    }
    renderReport(root, dep, customerName || 'Customer', accent);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
