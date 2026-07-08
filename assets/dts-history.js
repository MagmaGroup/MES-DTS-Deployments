// Shared DTS history renderer for every customer's index.html.
// Reads ./data.json (same folder as the page), sorts deployments newest-first
// by createDate, renders the table body, and wires up the status filter bar.
// Table markup expected on the page:
//   <div class="filter-bar" id="filter-bar"></div>
//   <table>...<tbody id="dts-tbody"><tr><td colspan="7" class="empty">...</td></tr></tbody></table>
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
    if (s === 'open')      return '<span class="badge badge-open">Open</span>';
    if (s === 'scheduled') return '<span class="badge badge-scheduled">Scheduled</span>';
    if (s === 'closed')    return '<span class="badge badge-closed">Closed</span>';
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

  function rowHtml(dep) {
    const count = dep.ticketCount != null ? dep.ticketCount : (dep.tickets ? dep.tickets.length : 0);
    return `<tr data-status="${(dep.status || '').toLowerCase()}">
      <td><a class="ticket-link" href="${escapeHtml(dep.url)}" target="_blank">${escapeHtml(dep.ticketNumber)}</a></td>
      <td class="title-cell">${escapeHtml(dep.title)}</td>
      <td>${badgeHtml(dep.status)}</td>
      <td>${cell(escapeHtml(dep.createDate))}</td>
      <td>${cell(escapeHtml(dep.deployDate))}</td>
      <td>${cell(escapeHtml(dep.closeDate))}</td>
      <td>${count}</td>
    </tr>`;
  }

  function buildFilterBar(container, deployments, onFilter) {
    const counts = { all: deployments.length, open: 0, scheduled: 0, closed: 0 };
    deployments.forEach((d) => {
      const s = (d.status || '').toLowerCase();
      if (counts[s] !== undefined) counts[s]++;
    });
    const filters = [
      { key: 'all', label: 'All' },
      { key: 'open', label: 'Open' },
      { key: 'scheduled', label: 'Scheduled' },
      { key: 'closed', label: 'Closed' },
    ];
    container.innerHTML = filters
      .map(
        (f) =>
          `<button type="button" class="filter-pill${f.key === 'all' ? ' active' : ''}" data-filter="${f.key}">${f.label} <span class="filter-count">${counts[f.key] || 0}</span></button>`
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
    const tbody = document.getElementById('dts-tbody');
    const filterBar = document.getElementById('filter-bar');
    if (!tbody) return;

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

    function render(filter) {
      const filtered =
        filter && filter !== 'all'
          ? deployments.filter((d) => (d.status || '').toLowerCase() === filter)
          : deployments;
      if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty">🚀 ${
          deployments.length ? 'No deployments match this filter' : 'No deployments yet'
        }</td></tr>`;
        return;
      }
      tbody.innerHTML = filtered.map(rowHtml).join('');
    }

    if (filterBar) {
      if (deployments.length) {
        buildFilterBar(filterBar, deployments, render);
      } else {
        filterBar.innerHTML = '';
      }
    }

    render('all');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
