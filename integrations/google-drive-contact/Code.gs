/**
 * alejandrogomez.me — Contact form → Google Drive (v2: Message Log database)
 *
 * Paste this whole file into the Google Apps Script project
 * "Website Contact Form", then follow SETUP.md.
 *
 * Every message sent from the website:
 *   1. is saved as a text file in the Drive folder "Website Messages"
 *   2. is added to the "Message Log" spreadsheet as a database row:
 *      auto category + priority, status, Read / Replied checkboxes,
 *      one-click Reply link, filters, colors and a Dashboard tab
 *   3. sends you an email notification (not for spam)
 *
 * Checking "Replied" or "Read" updates the Status automatically.
 */

const FOLDER_NAME = 'Website Messages';
const LOG_NAME = 'Message Log';
const SHEET_NAME = 'Messages';
const DASH_NAME = 'Dashboard';
const MIN_ROWS = 2000;

const HEADERS = ['ID', 'Received', 'Category', 'Priority', 'Status', 'Read', 'Replied',
  'Name', 'Email', 'Subject', 'Message', 'Reply', 'File', 'Notes'];
const COL = HEADERS.reduce(function (m, h, i) { m[h] = i + 1; return m; }, {});
const WIDTHS = [70, 130, 160, 80, 95, 55, 65, 140, 210, 200, 380, 70, 70, 220];

const STATUSES = ['New', 'Read', 'Replied', 'Done', 'Spam'];
const PRIORITIES = ['High', 'Medium', 'Low'];

// Category rules (English + Spanish). First match wins.
// Plain words match the whole word (plural "s" allowed); a trailing * matches the start of a word.
const CATEGORY_RULES = [
  { name: 'Spam', priority: 'Low', words: ['crypto*', 'bitcoin', 'forex', 'casino', 'viagra', 'backlink*', 'seo service*',
    'guest post*', 'rank your website', 'loan', 'investment opportunity', 'airdrop', 'onlyfans', 'telegram me'] },
  { name: 'Job / Internship', priority: 'High', words: ['job', 'position', 'role', 'hiring', 'hire', 'recruit*', 'intern',
    'internship', 'interview*', 'career*', 'opening', 'full-time', 'part-time', 'resume', 'cv', 'empleo', 'trabajo',
    'pasant*', 'práctica', 'practicas', 'prácticas', 'entrevista', 'vacante', 'puesto', 'contratar*'] },
  { name: 'Freelance / Project', priority: 'Medium', words: ['freelanc*', 'project', 'website', 'web site', 'build',
    'quote', 'budget', 'contract', 'app', 'develop*', 'dashboard', 'automat*', 'proyecto', 'presupuesto',
    'cotiza*', 'página web', 'pagina web', 'desarroll*'] },
  { name: 'Collaboration', priority: 'Medium', words: ['collab*', 'partner*', 'team up', 'research*', 'competition',
    'hackathon', 'colabor*', 'socio', 'investigación', 'competencia'] },
  { name: 'Networking / Question', priority: 'Low', words: ['question', 'advice', 'connect*', 'coffee', 'mentor*',
    'chat', 'network*', 'help', 'pregunta', 'consejo', 'conectar', 'ayuda', 'duda'] },
];
CATEGORY_RULES.forEach(function (rule) {
  rule.patterns = rule.words.map(function (w) {
    const prefix = /\*$/.test(w);
    const body = w.replace(/\*$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
    return new RegExp('(^|[^a-z0-9áéíóúñ])' + body + (prefix ? '' : 's?(?![a-z0-9áéíóúñ])'), 'i');
  });
});
const CATEGORIES = CATEGORY_RULES.map(function (r) { return r.name; }).concat(['General']);

const CATEGORY_COLORS = {
  'Job / Internship': ['#d1fae5', '#065f46'],
  'Freelance / Project': ['#dbeafe', '#1e40af'],
  'Collaboration': ['#ede9fe', '#5b21b6'],
  'Networking / Question': ['#fef3c7', '#92400e'],
  'General': ['#f1f5f9', '#334155'],
  'Spam': ['#fee2e2', '#991b1b'],
};

/* ------------------------------------------------------------------ */
/* Web app entry point                                                 */
/* ------------------------------------------------------------------ */

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const data = JSON.parse(e.postData.contents);
    const props = PropertiesService.getScriptProperties();

    if (!data.secret || data.secret !== props.getProperty('SHARED_SECRET')) {
      return json_({ ok: false, error: 'unauthorized' });
    }

    const name = String(data.name || '').slice(0, 100);
    const email = String(data.email || '').replace(/["<>\s]/g, '').slice(0, 200);
    const title = String(data.title || '').slice(0, 150);
    const message = String(data.message || '').slice(0, 800);
    const when = data.submittedAt ? new Date(data.submittedAt) : new Date();
    const tz = Session.getScriptTimeZone();

    const folder = getFolder_(props);
    const sheet = getLog_(props, folder);
    const number = Math.max(sheet.getLastRow(), 1); // header is row 1, so first message = #1
    const id = '#' + ('00000' + number).slice(-5);
    const cat = categorize_(title + ' ' + message, message);

    // 1. Text file with the full message
    const safeTitle = title.replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 60) || 'Message';
    const fileName = Utilities.formatDate(when, tz, 'yyyy-MM-dd HHmm') + ' — ' + safeTitle + ' (' + name + ').txt';
    const content =
      'Message ' + id + '\n' +
      'Received: ' + Utilities.formatDate(when, tz, 'yyyy-MM-dd HH:mm:ss') + ' (' + tz + ')\n' +
      'Category: ' + cat.name + ' (priority ' + cat.priority + ')\n' +
      'From: ' + name + ' <' + email + '>\n' +
      'Subject: ' + title + '\n' +
      '----------------------------------------\n\n' +
      message + '\n';
    const file = folder.createFile(fileName, content, MimeType.PLAIN_TEXT);

    // 2. Database row
    sheet.appendRow(buildRow_({
      id: id, when: when, category: cat.name, priority: cat.priority,
      status: cat.name === 'Spam' ? 'Spam' : 'New', read: false, replied: false,
      name: name, email: email, title: title, message: message, fileUrl: file.getUrl(), notes: '',
    }));

    // 3. Email notification (skip spam)
    if (cat.name !== 'Spam') {
      MailApp.sendEmail({
        to: Session.getEffectiveUser().getEmail(),
        replyTo: email,
        subject: '[alejandrogomez.me] ' + (cat.priority === 'High' ? '⭐ ' : '') + title,
        body:
          'New message from your website (' + id + ')\n' +
          'Category: ' + cat.name + ' — priority ' + cat.priority + '\n\n' +
          'From: ' + name + ' <' + email + '>\n' +
          'Subject: ' + title + '\n\n' +
          message + '\n\n' +
          'Message Log: ' + sheet.getParent().getUrl() + '\n' +
          'Saved file: ' + file.getUrl() + '\n' +
          'Hit Reply to answer ' + name + ' directly.',
      });
    }

    return json_({ ok: true, id: id });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server_error' });
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Run once from the editor (safe to run again any time)               */
/* ------------------------------------------------------------------ */

function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SHARED_SECRET')) {
    throw new Error('Add the SHARED_SECRET script property first (Project Settings → Script properties).');
  }
  const folder = getFolder_(props);
  const sheet = getLog_(props, folder);
  const ss = sheet.getParent();
  migrateOldRows_(sheet);
  formatLog_(sheet);
  buildDashboard_(ss);
  installEditTrigger_(ss);
  console.log('Ready. Folder: ' + folder.getUrl());
  console.log('Message Log: ' + ss.getUrl());
}

/* ------------------------------------------------------------------ */
/* Automation: checkboxes ↔ status                                     */
/* ------------------------------------------------------------------ */

function onLogEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;
  const r = e.range.getRow();
  const c = e.range.getColumn();
  if (r < 2 || e.range.getNumRows() > 1 || e.range.getNumColumns() > 1) return;

  const statusCell = sheet.getRange(r, COL.Status);
  const status = statusCell.getValue();
  const read = sheet.getRange(r, COL.Read);
  const replied = sheet.getRange(r, COL.Replied);

  if (c === COL.Replied) {
    if (replied.getValue() === true) {
      read.setValue(true);
      if (status !== 'Done') statusCell.setValue('Replied');
    } else if (status === 'Replied') {
      statusCell.setValue(read.getValue() === true ? 'Read' : 'New');
    }
  } else if (c === COL.Read) {
    if (read.getValue() === true && status === 'New') statusCell.setValue('Read');
    if (read.getValue() !== true && status === 'Read') statusCell.setValue('New');
  } else if (c === COL.Status) {
    if (status === 'Done' || status === 'Read' || status === 'Replied') read.setValue(true);
    if (status === 'Replied') replied.setValue(true);
    if (status === 'New') { read.setValue(false); replied.setValue(false); }
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function categorize_(text, message) {
  const t = String(text).toLowerCase();
  const links = (String(message).match(/https?:\/\//g) || []).length;
  if (links >= 3) return { name: 'Spam', priority: 'Low' };
  for (let i = 0; i < CATEGORY_RULES.length; i++) {
    const rule = CATEGORY_RULES[i];
    if (rule.patterns.some(function (re) { return re.test(t); })) return { name: rule.name, priority: rule.priority };
  }
  return { name: 'General', priority: 'Low' };
}

// Stops visitors from injecting spreadsheet formulas (=, +, -, @).
function safe_(v) {
  const s = String(v == null ? '' : v);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function buildRow_(o) {
  const mailto = 'mailto:' + o.email + '?subject=' + encodeURIComponent('Re: ' + o.title);
  return [
    o.id, o.when, o.category, o.priority, o.status, o.read === true, o.replied === true,
    safe_(o.name), safe_(o.email), safe_(o.title), safe_(o.message),
    o.email ? '=HYPERLINK("' + mailto.replace(/"/g, '') + '","✉ Reply")' : '',
    o.fileUrl ? '=HYPERLINK("' + String(o.fileUrl).replace(/"/g, '') + '","📄 Open")' : '',
    safe_(o.notes),
  ];
}

function getFolder_(props) {
  const id = props.getProperty('FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* recreated below */ }
  }
  const found = DriveApp.getFoldersByName(FOLDER_NAME);
  const folder = found.hasNext() ? found.next() : DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

function getLog_(props, folder) {
  const id = props.getProperty('LOG_ID');
  let ss = null;
  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(LOG_NAME);
    DriveApp.getFileById(ss.getId()).moveTo(folder);
    props.setProperty('LOG_ID', ss.getId());
  }
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.getSheets()[0];
    sheet.setName(SHEET_NAME);
  }
  if (sheet.getRange(1, 1).getValue() !== 'ID' || sheet.getLastColumn() < HEADERS.length) {
    if (sheet.getLastRow() <= 1) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    }
  }
  return sheet;
}

// Converts rows from the first version (ID, Received, Name, Email, Subject, Message, File).
function migrateOldRows_(sheet) {
  const header = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  if (header[2] !== 'Name') return; // already new format (or empty)
  const last = sheet.getLastRow();
  const old = last > 1 ? sheet.getRange(2, 1, last - 1, 7).getValues() : [];
  const rows = old.map(function (r) {
    const when = r[1] instanceof Date ? r[1] : new Date(String(r[1]).replace(' ', 'T'));
    const cat = categorize_(r[4] + ' ' + r[5], r[5]);
    return buildRow_({
      id: r[0], when: isNaN(when) ? new Date() : when, category: cat.name, priority: cat.priority,
      status: cat.name === 'Spam' ? 'Spam' : 'New', read: false, replied: false,
      name: r[2], email: r[3], title: r[4], message: r[5], fileUrl: r[6], notes: '',
    });
  });
  if (sheet.getFilter()) sheet.getFilter().remove();
  sheet.clear();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  if (rows.length) sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
}

function formatLog_(sheet) {
  const n = HEADERS.length;
  if (sheet.getMaxRows() < MIN_ROWS) sheet.insertRowsAfter(sheet.getMaxRows(), MIN_ROWS - sheet.getMaxRows());
  if (sheet.getMaxColumns() > n) sheet.deleteColumns(n + 1, sheet.getMaxColumns() - n);
  const rows = sheet.getMaxRows() - 1;

  // Header
  sheet.getRange(1, 1, 1, n).setValues([HEADERS])
    .setFontWeight('bold').setFontColor('#ffffff').setBackground('#1e3a8a')
    .setVerticalAlignment('middle').setHorizontalAlignment('center');
  sheet.setRowHeight(1, 32);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
  WIDTHS.forEach(function (w, i) { sheet.setColumnWidth(i + 1, w); });

  // Body formats
  sheet.getRange(2, COL.Received, rows, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  sheet.getRange(2, COL.ID, rows, 1).setHorizontalAlignment('center').setFontFamily('Roboto Mono');
  sheet.getRange(2, COL.Message, rows, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  sheet.getRange(2, 1, rows, n).setVerticalAlignment('middle');
  [COL.Category, COL.Priority, COL.Status, COL.Read, COL.Replied, COL.Reply, COL.File].forEach(function (c) {
    sheet.getRange(2, c, rows, 1).setHorizontalAlignment('center');
  });

  // Dropdowns + checkboxes
  const list = function (values) {
    return SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
  };
  sheet.getRange(2, COL.Category, rows, 1).setDataValidation(list(CATEGORIES));
  sheet.getRange(2, COL.Priority, rows, 1).setDataValidation(list(PRIORITIES));
  sheet.getRange(2, COL.Status, rows, 1).setDataValidation(list(STATUSES));
  const last = Math.max(sheet.getLastRow(), 1);
  if (last > 1) {
    sheet.getRange(2, COL.Read, last - 1, 2).insertCheckboxes();
  }
  sheet.getRange(2, COL.Read, rows, 2).setDataValidation(
    SpreadsheetApp.newDataValidation().requireCheckbox().setAllowInvalid(false).build());

  // Colors (first matching rule wins)
  const body = sheet.getRange(2, 1, rows, n);
  const L = function (c) { return columnLetter_(c); };
  const rules = [
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + L(COL.Status) + '2="Spam"')
      .setBackground('#fef2f2').setFontColor('#b91c1c').setStrikethrough(true).setRanges([body]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + L(COL.Status) + '2="Done"')
      .setBackground('#f8fafc').setFontColor('#94a3b8').setRanges([body]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + L(COL.Status) + '2="New"')
      .setBold(true).setRanges([sheet.getRange(2, 1, rows, COL.Status), sheet.getRange(2, COL.Name, rows, 3)]).build(),
  ];
  Object.keys(CATEGORY_COLORS).forEach(function (cat) {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(cat)
      .setBackground(CATEGORY_COLORS[cat][0]).setFontColor(CATEGORY_COLORS[cat][1])
      .setRanges([sheet.getRange(2, COL.Category, rows, 1)]).build());
  });
  [['High', '#fee2e2', '#b91c1c'], ['Medium', '#ffedd5', '#c2410c'], ['Low', '#f1f5f9', '#475569']]
    .forEach(function (p) {
      rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(p[0])
        .setBackground(p[1]).setFontColor(p[2]).setRanges([sheet.getRange(2, COL.Priority, rows, 1)]).build());
    });
  [['New', '#dbeafe', '#1d4ed8'], ['Read', '#e0f2fe', '#0369a1'], ['Replied', '#dcfce7', '#15803d'],
    ['Done', '#e2e8f0', '#475569']].forEach(function (s) {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(s[0])
      .setBackground(s[1]).setFontColor(s[2]).setRanges([sheet.getRange(2, COL.Status, rows, 1)]).build());
  });
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=ISEVEN(ROW())')
    .setBackground('#f8faff').setRanges([body]).build());
  sheet.setConditionalFormatRules(rules);

  // Filter on every column (use the ▼ in the header to filter or sort)
  if (sheet.getFilter()) sheet.getFilter().remove();
  sheet.getRange(1, 1, sheet.getMaxRows(), n).createFilter();
}

function buildDashboard_(ss) {
  let d = ss.getSheetByName(DASH_NAME);
  if (d) {
    d.getCharts().forEach(function (c) { d.removeChart(c); });
    d.clear();
  } else {
    d = ss.insertSheet(DASH_NAME, 0);
  }
  const M = "'" + SHEET_NAME + "'!";
  const col = function (name) { return M + columnLetter_(COL[name]) + '2:' + columnLetter_(COL[name]); };

  d.getRange('A1').setValue('📬 Website Messages — Dashboard').setFontSize(16).setFontWeight('bold');
  d.getRange('A2').setFormula('="Updated live · total messages: "&COUNTA(' + col('ID') + ')').setFontColor('#64748b');

  const kpis = [
    ['Total', '=COUNTA(' + col('ID') + ')'],
    ['New (unread)', '=COUNTIF(' + col('Status') + ',"New")'],
    ['Waiting for reply', '=COUNTIFS(' + col('Replied') + ',FALSE,' + col('Status') + ',"<>Spam",' + col('Status') + ',"<>Done",' + col('ID') + ',"<>")'],
    ['High priority open', '=COUNTIFS(' + col('Priority') + ',"High",' + col('Status') + ',"<>Done",' + col('Status') + ',"<>Spam")'],
    ['Last 7 days', '=COUNTIF(' + col('Received') + ',">="&(TODAY()-7))'],
    ['Spam blocked', '=COUNTIF(' + col('Status') + ',"Spam")'],
  ];
  d.getRange('A4:B4').setValues([['Overview', '']]).setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
  kpis.forEach(function (k, i) {
    d.getRange(5 + i, 1).setValue(k[0]);
    d.getRange(5 + i, 2).setFormula(k[1]).setFontWeight('bold').setHorizontalAlignment('center');
  });

  d.getRange('D4:E4').setValues([['Status', 'Count']]).setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
  STATUSES.forEach(function (s, i) {
    d.getRange(5 + i, 4).setValue(s);
    d.getRange(5 + i, 5).setFormula('=COUNTIF(' + col('Status') + ',"' + s + '")').setHorizontalAlignment('center');
  });

  d.getRange('G4:H4').setValues([['Category', 'Count']]).setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
  CATEGORIES.forEach(function (c, i) {
    d.getRange(5 + i, 7).setValue(c).setBackground(CATEGORY_COLORS[c][0]).setFontColor(CATEGORY_COLORS[c][1]);
    d.getRange(5 + i, 8).setFormula('=COUNTIF(' + col('Category') + ',"' + c + '")').setHorizontalAlignment('center');
  });

  d.setColumnWidth(1, 170); d.setColumnWidth(2, 80); d.setColumnWidth(3, 30);
  d.setColumnWidth(4, 110); d.setColumnWidth(5, 70); d.setColumnWidth(6, 30);
  d.setColumnWidth(7, 170); d.setColumnWidth(8, 70);
  d.setHiddenGridlines(true);

  const chart = d.newChart().asPieChart()
    .addRange(d.getRange(5, 7, CATEGORIES.length, 2))
    .setTitle('Messages by category')
    .setOption('pieHole', 0.45)
    .setOption('colors', CATEGORIES.map(function (c) { return CATEGORY_COLORS[c][1]; }))
    .setPosition(13, 1, 0, 0)
    .build();
  d.insertChart(chart);
}

function installEditTrigger_(ss) {
  const exists = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'onLogEdit' && t.getTriggerSourceId() === ss.getId();
  });
  if (!exists) ScriptApp.newTrigger('onLogEdit').forSpreadsheet(ss).onEdit().create();
}

function columnLetter_(c) {
  let s = '';
  while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); }
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
