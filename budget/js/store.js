// store.js — שמירה/טעינה מ-localStorage. מקור אמת יחיד לנתונים.

const STORAGE_KEY = "budget_state_v1";
const CLIENT_ID_KEY = "budget_google_client_id";

function defaultState() {
  return {
    version: 1,
    updatedAt: Date.now(),
    transactions: [],
    categories: JSON.parse(JSON.stringify(window.BudgetModel.DEFAULT_CATEGORIES)),
    budgets: { monthlyTotal: null, perCategory: {} },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // מיזוג הגנתי מול ברירת מחדל כדי לשרוד גרסאות ישנות
    const base = defaultState();
    return {
      ...base,
      ...parsed,
      budgets: { ...base.budgets, ...(parsed.budgets || {}) },
      categories:
        Array.isArray(parsed.categories) && parsed.categories.length
          ? parsed.categories
          : base.categories,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    };
  } catch (e) {
    console.error("loadState failed, using default", e);
    return defaultState();
  }
}

function saveState(state) {
  state.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

// יצירת מזהה ייחודי לתנועה
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// --- פעולות על תנועות ---
function addTransaction(state, { type, amount, category, date, note }) {
  state.transactions.push({
    id: newId(),
    type,
    amount: Number(amount),
    category: type === "income" ? window.BudgetModel.INCOME_CATEGORY.id : category,
    date,
    note: note || "",
  });
  return saveState(state);
}

function updateTransaction(state, id, patch) {
  const t = state.transactions.find((x) => x.id === id);
  if (t) Object.assign(t, patch, { amount: Number(patch.amount ?? t.amount) });
  return saveState(state);
}

function deleteTransaction(state, id) {
  state.transactions = state.transactions.filter((t) => t.id !== id);
  return saveState(state);
}

// --- קטגוריות ---
function addCategory(state, { name, icon, color }) {
  const id = "cat_" + newId();
  state.categories.push({ id, name, icon: icon || "📦", color: color || "#6b7280" });
  return saveState(state);
}

function updateCategory(state, id, patch) {
  const c = state.categories.find((x) => x.id === id);
  if (c) Object.assign(c, patch);
  return saveState(state);
}

function deleteCategory(state, id) {
  state.categories = state.categories.filter((c) => c.id !== id);
  if (state.budgets.perCategory) delete state.budgets.perCategory[id];
  return saveState(state);
}

// --- תקציבים ---
function setMonthlyBudget(state, amount) {
  state.budgets.monthlyTotal = amount === "" || amount == null ? null : Number(amount);
  return saveState(state);
}

function setCategoryBudget(state, categoryId, amount) {
  if (!state.budgets.perCategory) state.budgets.perCategory = {};
  if (amount === "" || amount == null || Number(amount) <= 0) {
    delete state.budgets.perCategory[categoryId];
  } else {
    state.budgets.perCategory[categoryId] = Number(amount);
  }
  return saveState(state);
}

// --- ייצוא / ייבוא (גיבוי ידני) ---
function exportJSON(state) {
  return JSON.stringify(state, null, 2);
}

function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.transactions)) {
    throw new Error("קובץ לא תקין");
  }
  const base = defaultState();
  const merged = {
    ...base,
    ...parsed,
    budgets: { ...base.budgets, ...(parsed.budgets || {}) },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

// מיזוג last-write-wins בין מצב מקומי למצב מ-Drive
function mergeStates(localState, remoteState) {
  if (!remoteState) return localState;
  if (!localState) return remoteState;
  return (remoteState.updatedAt || 0) > (localState.updatedAt || 0)
    ? remoteState
    : localState;
}

// --- מזהה Google Client לסנכרון (נשמר מקומית בלבד) ---
function getClientId() {
  return localStorage.getItem(CLIENT_ID_KEY) || "";
}
function setClientId(id) {
  if (id) localStorage.setItem(CLIENT_ID_KEY, id.trim());
  else localStorage.removeItem(CLIENT_ID_KEY);
}

window.BudgetStore = {
  STORAGE_KEY,
  defaultState,
  loadState,
  saveState,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  addCategory,
  updateCategory,
  deleteCategory,
  setMonthlyBudget,
  setCategoryBudget,
  exportJSON,
  importJSON,
  mergeStates,
  getClientId,
  setClientId,
};
