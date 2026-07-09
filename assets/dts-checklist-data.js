// Shared pre-deploy checklist definition — single source of truth, used by the
// DTS Dashboard (magma-d8vn3k/index.html). Derived from the org's actual DTS
// procedure (Zoho ticket #2664's custom fields).
//
// "situational" items are optional, context-dependent checks — never counted
// toward the progress total shown on the dashboard.
window.DTS_CHECKLIST_ITEMS = [
  { id: 'familiarize_scope',       phase: 'prep',        label: 'Get familiar with ticket scope / הכרת התכולה' },
  { id: 'team_meeting',            phase: 'prep',        label: 'Meeting scheduled with everyone who has tickets / זימון פגישה עם כל הצוות' },
  { id: 'check_prs',               phase: 'prep',        label: "No unapproved/unmerged PRs / בדוק שאין PR's שלא אושרו ומוזגו" },
  { id: 'check_git_branches',      phase: 'prep',        label: 'No unmerged Git branches / וודא שאין ענפים שלא מוזגו ב-GIT' },
  { id: 'prepare_sql',             phase: 'prep',        label: 'SQL script prepared / הכנת סקריפט לשינויי SQL' },
  { id: 'schedule_date_customer',  phase: 'schedule',    label: 'DTS date scheduled with customer / זימון מועד DTS מול הלקוח' },
  { id: 'status_pending_approval', phase: 'schedule',    label: 'Tickets set to Pending DTS Approval / שנה סטטוס ל-Pending DTS Approval' },
  { id: 'notify_team_on_date',     phase: 'schedule',    label: 'Team notified ON the date — not the day before / עדכון הצוות במועד' },
  { id: 'block_calendar',          phase: 'schedule',    label: '~2 hours blocked on calendar, team aware / סגירת זמן ביומן' },
  { id: 'deploy_build_test',       phase: 'deploy',      label: 'Deploy build and DTS to Test' },
  { id: 'restart_udi',             phase: 'deploy',      label: 'Restart UDI Services' },
  { id: 'restart_opc',             phase: 'deploy',      label: 'Restart OPC Services' },
  { id: 'recycle_iis',             phase: 'deploy',      label: 'Recycle IIS Pool' },
  { id: 'review_scope_again',      phase: 'deploy',      label: 'Review scope again to shorten handling time / הכרת התכולה' },
  { id: 'close_tickets',           phase: 'after',       label: 'Close tickets included in this DTS / סגור את הקריאות' },
  { id: 'update_customer_phone',   phase: 'after',       label: 'Update customer by phone on completion / עדכן לקוח טלפונית' },
  { id: 'notify_customer_test',    phase: 'after',       label: 'Tell customer to test the changes / עדכון לקוח שיש לבדוק' },
  { id: 'spot_check_items',        phase: 'situational', label: 'Spot-check items raised during DTS testing' },
  { id: 'check_udi_events',        phase: 'situational', label: 'UDI events run without errors' },
  { id: 'check_opc_items',         phase: 'situational', label: 'OPC items for updated changes/values' },
  { id: 'check_audit_log',         phase: 'situational', label: 'Audit Log has no errors' },
  { id: 'check_machine_screen',    phase: 'situational', label: 'Machine screen validity check' },
];

window.DTS_CHECKLIST_PHASE_ORDER = ['prep', 'schedule', 'deploy', 'after', 'situational'];

window.DTS_CHECKLIST_PHASE_LABELS = {
  prep:        'Prep — Before Scheduling',
  schedule:    'Scheduling & Customer Coordination',
  deploy:      'Day of Deployment',
  after:       'After Deployment',
  situational: 'Situational Checks (optional — not counted)',
};

window.DTS_CHECKLIST_REQUIRED = window.DTS_CHECKLIST_ITEMS.filter((it) => it.phase !== 'situational');
