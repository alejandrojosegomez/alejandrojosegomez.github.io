/**
 * alejandrogomez.me — Contact form → Google Drive
 *
 * Paste this whole file into a new Google Apps Script project
 * (script.google.com → New project), then follow SETUP.md.
 *
 * Every message sent from the website:
 *   1. is saved as a text file in the Drive folder "Website Messages"
 *   2. is added as a row to the "Message Log" spreadsheet in that folder
 *   3. sends you an email notification (reply goes straight to the sender)
 */

const FOLDER_NAME = 'Website Messages';
const LOG_NAME = 'Message Log';

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
    const email = String(data.email || '').slice(0, 200);
    const title = String(data.title || '').slice(0, 150);
    const message = String(data.message || '').slice(0, 800);
    const when = data.submittedAt ? new Date(data.submittedAt) : new Date();
    const tz = Session.getScriptTimeZone();
    const stamp = Utilities.formatDate(when, tz, 'yyyy-MM-dd HH:mm:ss');

    const folder = getFolder_(props);
    const log = getLog_(props, folder);
    const number = log.getLastRow(); // header is row 1, so first message = #1
    const id = '#' + ('00000' + number).slice(-5);

    // 1. Text file with the full message
    const safeTitle = title.replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 60) || 'Message';
    const fileName = Utilities.formatDate(when, tz, 'yyyy-MM-dd HHmm') + ' — ' + safeTitle + ' (' + name + ').txt';
    const content =
      'Message ' + id + '\n' +
      'Received: ' + stamp + ' (' + tz + ')\n' +
      'From: ' + name + ' <' + email + '>\n' +
      'Subject: ' + title + '\n' +
      '----------------------------------------\n\n' +
      message + '\n';
    const file = folder.createFile(fileName, content, MimeType.PLAIN_TEXT);

    // 2. Row in the spreadsheet log
    log.appendRow([id, stamp, name, email, title, message, file.getUrl()]);

    // 3. Email notification to you
    MailApp.sendEmail({
      to: Session.getEffectiveUser().getEmail(),
      replyTo: email,
      subject: '[alejandrogomez.me] ' + title,
      body:
        'New message from your website (' + id + ')\n\n' +
        'From: ' + name + ' <' + email + '>\n' +
        'Subject: ' + title + '\n\n' +
        message + '\n\n' +
        'Saved in Drive: ' + file.getUrl() + '\n' +
        'Hit Reply to answer ' + name + ' directly.',
    });

    return json_({ ok: true, id: id });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server_error' });
  } finally {
    lock.releaseLock();
  }
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
  if (id) {
    try { return SpreadsheetApp.openById(id).getSheets()[0]; } catch (e) { /* recreated below */ }
  }
  const ss = SpreadsheetApp.create(LOG_NAME);
  DriveApp.getFileById(ss.getId()).moveTo(folder);
  const sheet = ss.getSheets()[0];
  sheet.appendRow(['ID', 'Received', 'Name', 'Email', 'Subject', 'Message', 'File']);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
  props.setProperty('LOG_ID', ss.getId());
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Run this once from the editor to create the folder + log and grant permissions. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  const folder = getFolder_(props);
  getLog_(props, folder);
  if (!props.getProperty('SHARED_SECRET')) {
    throw new Error('Add the SHARED_SECRET script property first (Project Settings → Script properties).');
  }
  console.log('Ready. Folder: ' + folder.getUrl());
}
