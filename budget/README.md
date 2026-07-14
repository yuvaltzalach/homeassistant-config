# אפליקציית תקציב חודשי (PWA)

אפליקציית ווב להתקנה למובייל לניהול תקציב חודשי: הזנת הוצאות והכנסות, מעקב לפי
קטגוריות, תקציב יעד עם התראות, מאזן חודשי וגרפים. הנתונים נשמרים **מקומית במכשיר**
(עובד גם אופליין), עם אפשרות **סנכרון/גיבוי ל-Google Drive**.

## תכולה
- `index.html` — שלד האפליקציה.
- `css/styles.css` — עיצוב RTL, mobile-first, מצב כהה/בהיר.
- `js/model.js` — מודל וחישובים (טהורים).
- `js/store.js` — שמירה/טעינה ב-localStorage.
- `js/charts.js` — גרפי SVG (ללא תלות חיצונית).
- `js/drive.js` — סנכרון Google Drive.
- `js/app.js` — לוגיקת ה-UI.
- `manifest.webmanifest`, `sw.js`, `icons/` — קבצי PWA (התקנה + אופליין).

## הרצה מקומית (לבדיקה)
מתוך תיקיית `budget/`:
```bash
python3 -m http.server 8000
```
ואז לפתוח `http://localhost:8000` בדפדפן.

## אחסון ב-GitHub Pages
1. ב-GitHub: **Settings → Pages**, ובחר לשרת מהענף `master` (root).
2. לאחר מיזוג, האפליקציה תהיה זמינה בכתובת:
   `https://<username>.github.io/homeassistant-config/budget/`
3. במובייל: פתח את הכתובת בדפדפן → תפריט → **הוסף למסך הבית** (Add to Home Screen).

## התקנה למסך הבית (PWA)
- **אנדרואיד (Chrome):** תפריט ⋮ → "התקן אפליקציה" / "הוסף למסך הבית".
- **iOS (Safari):** כפתור שיתוף → "הוסף למסך הבית".

## סנכרון Google Drive (אופציונלי)
הנתונים נשמרים בקובץ יחיד בתיקיית ה-`appDataFolder` המוסתרת של האפליקציה ב-Drive שלך
(לא מלכלך את ה-Drive הרגיל). כדי להפעיל צריך ליצור **OAuth Client ID** משלך פעם אחת:

1. היכנס ל-[Google Cloud Console](https://console.cloud.google.com/) וצור פרויקט.
2. **APIs & Services → Library** → הפעל את **Google Drive API**.
3. **APIs & Services → OAuth consent screen** → הגדר אפליקציה (External), הוסף את
   עצמך כ-Test user.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - סוג: **Web application**.
   - **Authorized JavaScript origins**: הוסף את מקור האתר, למשל
     `https://<username>.github.io` (ולבדיקה מקומית גם `http://localhost:8000`).
5. העתק את ה-**Client ID** (מסתיים ב-`.apps.googleusercontent.com`).
6. באפליקציה: **הגדרות → סנכרון Google Drive** → הדבק את ה-Client ID → **שמור מזהה** →
   **סנכרן עכשיו** ואשר את ההרשאה.

ה-Client ID נשמר מקומית בדפדפן בלבד ואינו נשמר ב-repository.

## גיבוי ידני (ללא Drive)
בטאב **הגדרות → גיבוי מקומי** אפשר **לייצא** קובץ JSON (למשל להעלות ידנית ל-Drive)
ו**לייבא** אותו חזרה בכל מכשיר.

## פרטיות
כל הנתונים הכספיים נשמרים במכשיר שלך (ובאופן אופציונלי ב-Drive הפרטי שלך). שום נתון
לא נשלח לשרת של הפרויקט — האפליקציה היא קבצים סטטיים בלבד.
