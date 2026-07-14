// model.js — מודל נתונים וחישובים טהורים (ללא תלות ב-DOM)
// כל הפונקציות כאן ניתנות לבדיקה בקלות ואינן נוגעות ב-UI.

const DEFAULT_CATEGORIES = [
  { id: "food", name: "אוכל", icon: "🍽️", color: "#ef4444" },
  { id: "transport", name: "דלק/תחבורה", icon: "⛽", color: "#f59e0b" },
  { id: "shopping", name: "קניות", icon: "🛍️", color: "#8b5cf6" },
  { id: "bills", name: "חשבונות", icon: "🧾", color: "#3b82f6" },
  { id: "fun", name: "בילויים", icon: "🎉", color: "#ec4899" },
  { id: "health", name: "בריאות", icon: "🩺", color: "#10b981" },
  { id: "other", name: "אחר", icon: "📦", color: "#6b7280" },
];

const INCOME_CATEGORY = { id: "income", name: "הכנסה", icon: "💰", color: "#22c55e" };

// מזהה חודש בפורמט "YYYY-MM"
function monthKey(dateStr) {
  return String(dateStr).slice(0, 7);
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// שם חודש קריא בעברית, למשל "יולי 2026"
const HE_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];
function monthLabel(mKey) {
  const [y, m] = mKey.split("-");
  return `${HE_MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

// מעבר חודש: delta של +1 / -1 על מפתח "YYYY-MM"
function shiftMonth(mKey, delta) {
  const [y, m] = mKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtCurrency(n) {
  const val = Number(n) || 0;
  return "₪" + val.toLocaleString("he-IL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// --- חישובים על מצב האפליקציה ---

// כל התנועות של חודש נתון
function txForMonth(state, mKey) {
  return state.transactions.filter((t) => monthKey(t.date) === mKey);
}

// סך הוצאות בחודש
function totalExpenses(state, mKey) {
  return txForMonth(state, mKey)
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
}

// סך הכנסות בחודש
function totalIncome(state, mKey) {
  return txForMonth(state, mKey)
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
}

// מאזן חודשי = הכנסות − הוצאות
function monthlyBalance(state, mKey) {
  return totalIncome(state, mKey) - totalExpenses(state, mKey);
}

// מאזן מצטבר עד וכולל החודש הנבחר
function cumulativeBalance(state, mKey) {
  return state.transactions
    .filter((t) => monthKey(t.date) <= mKey)
    .reduce(
      (sum, t) => sum + (t.type === "income" ? 1 : -1) * (Number(t.amount) || 0),
      0
    );
}

// הוצאות מקובצות לפי קטגוריה בחודש נתון -> [{categoryId, total}]
function expensesByCategory(state, mKey) {
  const map = {};
  txForMonth(state, mKey)
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      map[t.category] = (map[t.category] || 0) + (Number(t.amount) || 0);
    });
  return Object.entries(map)
    .map(([categoryId, total]) => ({ categoryId, total }))
    .sort((a, b) => b.total - a.total);
}

// רשימת החודשים שיש בהם תנועות, ממויין (למגמה/השוואה)
function monthsWithData(state) {
  const set = new Set(state.transactions.map((t) => monthKey(t.date)));
  return Array.from(set).sort();
}

// סדרת ההוצאות/הכנסות ל-N החודשים האחרונים עד mKey (כולל) -> [{month, expenses, income}]
function monthlySeries(state, mKey, count = 6) {
  const series = [];
  let cur = mKey;
  for (let i = 0; i < count; i++) {
    series.unshift({
      month: cur,
      expenses: totalExpenses(state, cur),
      income: totalIncome(state, cur),
    });
    cur = shiftMonth(cur, -1);
  }
  return series;
}

// מציאת קטגוריה לפי id (כולל קטגוריית הכנסה)
function findCategory(state, id) {
  if (id === INCOME_CATEGORY.id) return INCOME_CATEGORY;
  return (
    state.categories.find((c) => c.id === id) || {
      id,
      name: id || "ללא קטגוריה",
      icon: "❔",
      color: "#9ca3af",
    }
  );
}

// מצב תקציב חודשי כולל -> {budget, spent, ratio, level}
// level: "ok" | "warn" (>=90%) | "over" (>=100%)
function totalBudgetStatus(state, mKey) {
  const budget = state.budgets && state.budgets.monthlyTotal;
  const spent = totalExpenses(state, mKey);
  if (!budget || budget <= 0) return { budget: null, spent, ratio: 0, level: "none" };
  const ratio = spent / budget;
  const level = ratio >= 1 ? "over" : ratio >= 0.9 ? "warn" : "ok";
  return { budget, spent, ratio, level };
}

// מצב תקציב פר-קטגוריה -> [{categoryId, budget, spent, ratio, level}]
function categoryBudgetStatuses(state, mKey) {
  const per = (state.budgets && state.budgets.perCategory) || {};
  const spentMap = {};
  expensesByCategory(state, mKey).forEach((e) => (spentMap[e.categoryId] = e.total));
  return Object.entries(per)
    .filter(([, b]) => Number(b) > 0)
    .map(([categoryId, budget]) => {
      const spent = spentMap[categoryId] || 0;
      const ratio = spent / budget;
      const level = ratio >= 1 ? "over" : ratio >= 0.9 ? "warn" : "ok";
      return { categoryId, budget: Number(budget), spent, ratio, level };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

// חשיפה גלובלית (ללא מודולים כדי שיעבוד ישירות מ-file/Pages)
window.BudgetModel = {
  DEFAULT_CATEGORIES,
  INCOME_CATEGORY,
  monthKey,
  currentMonthKey,
  todayStr,
  monthLabel,
  shiftMonth,
  fmtCurrency,
  txForMonth,
  totalExpenses,
  totalIncome,
  monthlyBalance,
  cumulativeBalance,
  expensesByCategory,
  monthsWithData,
  monthlySeries,
  findCategory,
  totalBudgetStatus,
  categoryBudgetStatuses,
};
