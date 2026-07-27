// Shared EN/HE glossary for page chrome (labels, headers, captions, button
// text) across the dashboard, every customer history page, and the report
// page. This NEVER translates actual ticket content (subject, description,
// summary, test steps) — that stays exactly as submitted/generated, in
// whatever language it was written in.
//
// Usage:
//   - Static text: <span data-i18n="viewReport">View report</span>
//     (optionally data-i18n-vars='{"name":"Ytong"}' for {placeholder} substitution)
//   - Dynamic text generated in JS: DtsI18n.t('statusOpen')
//   - Listen for a language switch to re-render cached data:
//     window.addEventListener('dts-lang-changed', () => { ...re-render... })
(function () {
  const DICT = {
    en: {
      brand: 'Magma MES — Internal Use Only',
      dashboardTitle: 'DTS Dashboard',
      dashboardSubtitle: 'Live deployment status across all customers',
      editContent: 'Edit DTS Content',
      manageChecklist: 'Manage Checklist',
      statusOpen: 'Open',
      statusScheduled: 'Scheduled',
      statusClosed: 'Closed',
      dtsCount: '{n} DTS',
      noDeployments: 'No deployments yet',
      noDeploymentsFiltered: 'No deployments match this filter',
      noTickets: 'No tickets in this deployment yet',
      metaCreated: 'Created',
      metaDeploy: 'Deploy',
      metaDeployDate: 'Deploy Date',
      metaCloseDate: 'Close Date',
      metaTickets: 'Tickets',
      checklistLabel: 'Checklist',
      syncedJustNow: 'Synced just now',
      syncedMinutesAgo: 'Synced {n} minute{s} ago',
      syncedHoursAgo: 'Synced {n} hour{s} ago',
      syncedDaysAgo: 'Synced {n} day{s} ago',
      historyTitle: 'DTS Deployment History',
      historySubtitle: 'Magma MES releases for {name}',
      filterActive: 'Active',
      filterAll: 'All',
      filterClosed: 'Closed',
      deploymentsWord: 'deployment{s}',
      activeWord: 'active',
      viewReport: 'View report',
      backToHistory: 'Back to deployment history',
      assignedTo: 'Assigned to {name}',
      originalDescription: 'Original Description',
      summary: 'Summary',
      description: 'Description',
      testSteps: 'Test Steps',
      includedTickets: 'Included Tickets',
      cr: 'CR',
      locked: 'Locked',
      reportNotFound: 'Report {id} not found',
      couldNotLoad: 'Could not load account-map.json — no customers to show.',
    },
    he: {
      brand: 'מגמה MES — לשימוש פנימי בלבד',
      dashboardTitle: 'לוח בקרת DTS',
      dashboardSubtitle: 'סטטוס פריסות בזמן אמת עבור כל הלקוחות',
      editContent: 'עריכת תוכן DTS',
      manageChecklist: 'ניהול צ׳קליסט',
      statusOpen: 'פתוח',
      statusScheduled: 'מתוזמן',
      statusClosed: 'סגור',
      dtsCount: '{n} DTS',
      noDeployments: 'אין פריסות עדיין',
      noDeploymentsFiltered: 'אין פריסות התואמות למסנן זה',
      noTickets: 'אין קריאות בפריסה זו עדיין',
      metaCreated: 'נוצר',
      metaDeploy: 'פריסה',
      metaDeployDate: 'תאריך פריסה',
      metaCloseDate: 'תאריך סגירה',
      metaTickets: 'קריאות',
      checklistLabel: 'צ׳קליסט',
      syncedJustNow: 'סונכרן זה עתה',
      syncedMinutesAgo: 'סונכרן לפני {n} דקות',
      syncedHoursAgo: 'סונכרן לפני {n} שעות',
      syncedDaysAgo: 'סונכרן לפני {n} ימים',
      historyTitle: 'היסטוריית פריסות DTS',
      historySubtitle: 'גרסאות Magma MES עבור {name}',
      filterActive: 'פעיל',
      filterAll: 'הכל',
      filterClosed: 'סגור',
      deploymentsWord: 'פריסות',
      activeWord: 'פעילות',
      viewReport: 'צפייה בדוח',
      backToHistory: 'חזרה להיסטוריית הפריסות',
      assignedTo: 'שויך ל{name}',
      originalDescription: 'תיאור מקורי',
      summary: 'סיכום',
      description: 'תיאור',
      testSteps: 'שלבי בדיקה',
      includedTickets: 'קריאות כלולות',
      cr: 'בקשת שינוי',
      locked: 'נעול',
      reportNotFound: 'דוח {id} לא נמצא',
      couldNotLoad: 'טעינת account-map.json נכשלה — אין לקוחות להצגה.',
    },
  };

  const STORAGE_KEY = 'dts_lang';

  function currentLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'he' ? 'he' : 'en';
  }

  // {n} -> vars.n, plus a small "{s}" plural helper for English ("1 minute"
  // vs "2 minutes") that resolves to '' when vars.n === 1, else 's'.
  function t(key, vars) {
    const lang = currentLang();
    let str = (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key;
    const allVars = { ...vars };
    if (allVars.n !== undefined && allVars.s === undefined) {
      allVars.s = Number(allVars.n) === 1 ? '' : 's';
    }
    Object.keys(allVars).forEach((k) => {
      str = str.split(`{${k}}`).join(allVars[k]);
    });
    return str;
  }

  function applyStaticTranslations() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const varsAttr = el.getAttribute('data-i18n-vars');
      let vars;
      try {
        vars = varsAttr ? JSON.parse(varsAttr) : undefined;
      } catch {
        vars = undefined;
      }
      el.textContent = t(key, vars);
    });
  }

  function applyDirAndLang(lang) {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  }

  function updateToggleLabel(lang) {
    const btn = document.getElementById('lang-toggle');
    if (btn) btn.textContent = lang === 'he' ? 'EN' : 'עב';
  }

  function setLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
    applyDirAndLang(lang);
    applyStaticTranslations();
    updateToggleLabel(lang);
    window.dispatchEvent(new CustomEvent('dts-lang-changed', { detail: { lang } }));
  }

  // Re-runs on every call (safe to call again after re-rendering dynamic
  // content, e.g. after innerHTML is replaced and a fresh #lang-toggle
  // button exists in the DOM).
  function init() {
    const lang = currentLang();
    applyDirAndLang(lang);
    applyStaticTranslations();
    updateToggleLabel(lang);
    const btn = document.getElementById('lang-toggle');
    if (btn && !btn.dataset.dtsWired) {
      btn.dataset.dtsWired = '1';
      btn.addEventListener('click', () => setLang(currentLang() === 'he' ? 'en' : 'he'));
    }
  }

  window.DtsI18n = { t, currentLang, setLang, applyStaticTranslations, init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
