// drive.js — סנכרון וגיבוי ל-Google Drive.
// שימוש ב-Google Identity Services (GIS) לקבלת access token, ו-Drive REST API
// לשמירת קובץ יחיד בתוך appDataFolder (תיקייה מוסתרת ייעודית לאפליקציה).
//
// חשוב: האפליקציה עובדת במלואה גם ללא חיבור. Drive הוא גיבוי/סנכרון בין מכשירים בלבד.
// המשתמש מזין Client ID משלו (Google Cloud). אין secrets בקוד.

const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const FILE_NAME = "budget-data.json";
const GIS_SRC = "https://accounts.google.com/gsi/client";

let tokenClient = null;
let accessToken = null;
let gisLoaded = false;

// טעינת סקריפט GIS פעם אחת (דורש רשת).
function loadGis() {
  if (gisLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      gisLoaded = true;
      return resolve();
    }
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      gisLoaded = true;
      resolve();
    };
    s.onerror = () => reject(new Error("טעינת Google נכשלה (אין חיבור לרשת?)"));
    document.head.appendChild(s);
  });
}

function isConfigured() {
  return !!window.BudgetStore.getClientId();
}

function isSignedIn() {
  return !!accessToken;
}

// התחברות: מבקש הרשאה ומקבל access token.
async function signIn() {
  const clientId = window.BudgetStore.getClientId();
  if (!clientId) throw new Error("חסר Google Client ID. הזן אותו בהגדרות.");
  await loadGis();

  return new Promise((resolve, reject) => {
    try {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (resp) => {
          if (resp.error) return reject(new Error(resp.error));
          accessToken = resp.access_token;
          resolve(accessToken);
        },
      });
      tokenClient.requestAccessToken({ prompt: "" });
    } catch (e) {
      reject(e);
    }
  });
}

function signOut() {
  if (accessToken && window.google && google.accounts) {
    try {
      google.accounts.oauth2.revoke(accessToken, () => {});
    } catch (_) {}
  }
  accessToken = null;
}

function authHeaders() {
  return { Authorization: `Bearer ${accessToken}` };
}

// מציאת מזהה הקובץ ב-appDataFolder (אם קיים).
async function findFileId() {
  const url =
    "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder" +
    `&q=${encodeURIComponent(`name='${FILE_NAME}'`)}&fields=files(id,name,modifiedTime)`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error("שגיאה בגישה ל-Drive: " + res.status);
  const data = await res.json();
  return data.files && data.files.length ? data.files[0].id : null;
}

// הורדת תוכן הקובץ מ-Drive -> object או null.
async function download() {
  const id = await findFileId();
  if (!id) return null;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error("הורדת הקובץ נכשלה: " + res.status);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

// העלאת מצב ל-Drive (יצירה או עדכון). שימוש ב-multipart upload.
async function upload(state) {
  const existingId = await findFileId();
  const metadata = existingId
    ? { name: FILE_NAME }
    : { name: FILE_NAME, parents: ["appDataFolder"] };

  const boundary = "-------budget" + Date.now();
  const body =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(state) +
    `\r\n--${boundary}--`;

  const method = existingId ? "PATCH" : "POST";
  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

  const res = await fetch(url, {
    method,
    headers: {
      ...authHeaders(),
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) throw new Error("שמירה ל-Drive נכשלה: " + res.status);
  return res.json();
}

// סנכרון מלא: מיזוג last-write-wins בין מקומי ל-Drive, ושמירת התוצאה בשני הצדדים.
// מקבל localState, מחזיר את המצב הממוזג (שגם נשמר מקומית).
async function sync(localState) {
  if (!isSignedIn()) await signIn();
  const remote = await download();
  const merged = window.BudgetStore.mergeStates(localState, remote);
  // שמירה מקומית
  localStorage.setItem(window.BudgetStore.STORAGE_KEY, JSON.stringify(merged));
  // כתיבה ל-Drive רק אם המקומי חדש יותר או שאין עדיין קובץ מרוחק
  if (!remote || (merged.updatedAt || 0) >= (remote.updatedAt || 0)) {
    await upload(merged);
  }
  return merged;
}

window.BudgetDrive = {
  isConfigured,
  isSignedIn,
  signIn,
  signOut,
  sync,
  download,
  upload,
};
