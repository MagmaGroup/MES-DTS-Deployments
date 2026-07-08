// Shared DTS history renderer for every customer's index.html.
// Reads ./data.json (same folder as the page), sorts deployments newest-first
// by createDate, renders a deployment-card list, and wires up the toolbar
// stats + status filter bar.
// Markup expected on the page:
//   <div class="toolbar-stats" id="toolbar-stats"></div>
//   <div class="filter-bar" id="filter-bar"></div>
//   <div class="deploy-list" id="dts-list" style="--accent:#xxxxxx"></div>
(function () {
  function parseDate(d) {
    // Expects "DD.MM.YYYY". Returns a Date, or null if missing/unparseable.
    if (!d) return null;
    const parts = d.split('.');
    if (parts.length !== 3) return null;
    const dd = Number(parts[0]), mm = Number(parts[1]), yyyy = Number(parts[2]);
    if (!dd || !mm || !yyyy) return null;
    return new Date(yyyy, mm - 1, dd);
  }

  function badgeHtml(status) {
    const s = (status || '').toLowerCase();
    if (s === 'open')      return '<span class="badge badge-open"><span class="badge-dot"></span>Open</span>';
    if (s === 'scheduled') return '<span class="badge badge-scheduled"><span class="badge-dot"></span>Scheduled</span>';
    if (s === 'closed')    return '<span class="badge badge-closed"><span class="badge-dot"></span>Closed</span>';
    return `<span class="badge">${status || '—'}</span>`;
  }

  function cell(value) {
    return value ? value : '<span class="na">—</span>';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function cardHtml(dep) {
    const count = dep.ticketCount != null ? dep.ticketCount : (dep.tickets ? dep.tickets.length : 0);
    return `<div class="deploy-card" data-status="${(dep.status || '').toLowerCase()}">
      <div class="deploy-card-head">
        <span class="deploy-id">${escapeHtml(dep.ticketNumber)}</span>
        ${badgeHtml(dep.status)}
      </div>
      <div class="deploy-title">${escapeHtml(dep.title)}</div>
      <div class="deploy-meta">
        <div><div class="meta-col-label">Created</div><div class="meta-col-value">${cell(escapeHtml(dep.createDate))}</div></div>
        <div><div class="meta-col-label">Deploy Date</div><div class="meta-col-value ${dep.deployDate ? '' : 'na'}">${cell(escapeHtml(dep.deployDate))}</div></div>
        <div><div class="meta-col-label">Close Date</div><div class="meta-col-value ${dep.closeDate ? '' : 'na'}">${cell(escapeHtml(dep.closeDate))}</div></div>
        <div><div class="meta-col-label">Tickets</div><div class="meta-col-value">${count}</div></div>
      </div>
      <div class="deploy-footer">
        <a class="view-link" href="${escapeHtml(dep.url)}" target="_blank">View report →</a>
      </div>
    </div>`;
  }

  function buildFilterBar(container, deployments, onFilter) {
    // "Active" unifies Open + Scheduled — the two statuses that still need
    // attention. Closed is its own filter since it's just historical record.
    const counts = { active: 0, all: deployments.length, closed: 0 };
    deployments.forEach((d) => {
      const s = (d.status || '').toLowerCase();
      if (s === 'closed') counts.closed++;
      else counts.active++;
    });
    const filters = [
      { key: 'active', label: 'Active' },
      { key: 'all', label: 'All' },
      { key: 'closed', label: 'Closed' },
    ];
    container.innerHTML = filters
      .map(
        (f) =>
          `<button type="button" class="filter-pill${f.key === 'active' ? ' active' : ''}" data-filter="${f.key}">${f.label} <span class="filter-count">${counts[f.key] || 0}</span></button>`
      )
      .join('');
    container.querySelectorAll('.filter-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.filter-pill').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        onFilter(btn.dataset.filter);
      });
    });
  }

  async function init() {
    const list = document.getElementById('dts-list');
    const filterBar = document.getElementById('filter-bar');
    const statsEl = document.getElementById('toolbar-stats');
    if (!list) return;

    let deployments = [];
    try {
      const res = await fetch(`./data.json?_=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        deployments = data.deployments || [];
      }
    } catch (e) {
      // No data.json yet, or fetch failed — treat as no deployments.
    }

    // Newest first. Entries with no parseable createDate sort to the end.
    deployments.sort((a, b) => {
      const da = parseDate(a.createDate);
      const db = parseDate(b.createDate);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db - da;
    });

    if (statsEl) {
      if (deployments.length) {
        const openCount = deployments.filter((d) => (d.status || '').toLowerCase() !== 'closed').length;
        statsEl.innerHTML = `<strong>${deployments.length}</strong> deployment${deployments.length === 1 ? '' : 's'}${
          openCount ? ` &middot; <strong>${openCount}</strong> active` : ''
        }`;
      } else {
        statsEl.innerHTML = '';
      }
    }

    function render(filter) {
      let filtered = deployments;
      if (filter === 'active') {
        filtered = deployments.filter((d) => (d.status || '').toLowerCase() !== 'closed');
      } else if (filter === 'closed') {
        filtered = deployments.filter((d) => (d.status || '').toLowerCase() === 'closed');
      }
      if (!filtered.length) {
        list.innerHTML = `<div class="empty-block">🚀 ${
          deployments.length ? 'No deployments match this filter' : 'No deployments yet'
        }</div>`;
        return;
      }
      list.innerHTML = filtered.map(cardHtml).join('');
    }

    if (filterBar) {
      if (deployments.length) {
        buildFilterBar(filterBar, deployments, render);
      } else {
        filterBar.innerHTML = '';
      }
    }

    render('active');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
