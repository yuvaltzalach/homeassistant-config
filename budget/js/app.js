// app.js — קישור בין ה-UI, המודל, האחסון, הגרפים והסנכרון.
(function () {
  const Model = window.BudgetModel;
  const Store = window.BudgetStore;
  const Charts = window.BudgetCharts;
  const Drive = window.BudgetDrive;

  let state = Store.loadState();
  let currentMonth = Model.currentMonthKey();
  let txFilter = "all";
  let editingTxId = null;
  let editingCatId = null;
  let modalType = "expense";

  const $ = (id) => document.getElementById(id);

  // ---------- כלי עזר ----------
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add("hidden"), 2600);
  }

  function persistAndRender() {
    Store.saveState(state);
    renderAll();
  }

  // ---------- רינדור ----------
  function renderAll() {
    $("monthTitle").textContent = Model.monthLabel(currentMonth);
    renderSummary();
    renderBudgetSummary();
    renderCategoryBreakdown();
    renderTxList();
    renderCharts();
    renderBudgetTab();
    renderSettingsCategories();
    renderDriveStatus();
  }

  function renderSummary() {
    const inc = Model.totalIncome(state, currentMonth);
    const exp = Model.totalExpenses(state, currentMonth);
    const bal = inc - exp;
    $("sumIncome").textContent = Model.fmtCurrency(inc);
    $("sumExpense").textContent = Model.fmtCurrency(exp);
    $("sumBalance").textContent = Model.fmtCurrency(bal);
    const card = $("balanceCard");
    card.classList.toggle("negative", bal < 0);
    const cum = Model.cumulativeBalance(state, currentMonth);
    $("cumBalance").textContent = "מאזן מצטבר: " + Model.fmtCurrency(cum);
  }

  function renderBudgetSummary() {
    const box = $("budgetSummary");
    box.innerHTML = "";
    const st = Model.totalBudgetStatus(state, currentMonth);
    if (st.budget == null) {
      box.innerHTML =
        '<div class="budget-hint">לא הוגדר תקציב חודשי. הגדר אותו בטאב "תקציב".</div>';
      return;
    }
    box.appendChild(progressCard("תקציב חודשי", st));
    // תקציבי קטגוריה שחצו/מתקרבים
    Model.categoryBudgetStatuses(state, currentMonth)
      .filter((c) => c.level !== "ok")
      .forEach((c) => {
        const cat = Model.findCategory(state, c.categoryId);
        box.appendChild(progressCard(`${cat.icon} ${cat.name}`, c));
      });
  }

  function progressCard(title, st) {
    const wrap = document.createElement("div");
    wrap.className = "progress-card level-" + st.level;
    const pct = Math.min(100, Math.round(st.ratio * 100));
    wrap.innerHTML = `
      <div class="progress-head">
        <span>${title}</span>
        <span>${Model.fmtCurrency(st.spent)} / ${Model.fmtCurrency(st.budget)}</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="progress-pct">${Math.round(st.ratio * 100)}%</div>`;
    return wrap;
  }

  function renderCategoryBreakdown() {
    const list = $("categoryList");
    list.innerHTML = "";
    const items = Model.expensesByCategory(state, currentMonth);
    if (!items.length) {
      list.innerHTML = '<div class="empty">אין הוצאות בחודש זה</div>';
      return;
    }
    const total = items.reduce((s, i) => s + i.total, 0);
    items.forEach((item) => {
      const cat = Model.findCategory(state, item.categoryId);
      const pct = Math.round((item.total / total) * 100);
      const row = document.createElement("div");
      row.className = "cat-row";
      row.innerHTML = `
        <span class="cat-icon" style="background:${cat.color}22;color:${cat.color}">${cat.icon}</span>
        <span class="cat-name">${cat.name}</span>
        <span class="cat-bar"><span style="width:${pct}%;background:${cat.color}"></span></span>
        <span class="cat-amount">${Model.fmtCurrency(item.total)}</span>`;
      list.appendChild(row);
    });
  }

  function renderTxList() {
    const list = $("txList");
    list.innerHTML = "";
    let items = Model.txForMonth(state, currentMonth);
    if (txFilter !== "all") items = items.filter((t) => t.type === txFilter);
    items = items.sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!items.length) {
      list.innerHTML = '<div class="empty">אין תנועות להצגה</div>';
      return;
    }
    items.forEach((t) => {
      const cat = Model.findCategory(state, t.category);
      const row = document.createElement("div");
      row.className = "tx-item " + t.type;
      row.innerHTML = `
        <span class="cat-icon" style="background:${cat.color}22;color:${cat.color}">${cat.icon}</span>
        <span class="tx-main">
          <span class="tx-cat">${cat.name}${t.note ? " · " + escapeHtml(t.note) : ""}</span>
          <span class="tx-date">${t.date}</span>
        </span>
        <span class="tx-amount ${t.type}">${t.type === "income" ? "+" : "−"}${Model.fmtCurrency(t.amount)}</span>
        <button class="tx-del" aria-label="מחק">🗑️</button>`;
      row.querySelector(".tx-del").addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm("למחוק תנועה זו?")) {
          state = Store.deleteTransaction(state, t.id);
          renderAll();
          toast("נמחק");
        }
      });
      row.addEventListener("click", () => openTxModal(t));
      list.appendChild(row);
    });
  }

  function renderCharts() {
    Charts.renderMonthlyBars($("chartMonthly"), Model.monthlySeries(state, currentMonth, 6));
    Charts.renderCategoryDonut(
      $("chartCategory"),
      Model.expensesByCategory(state, currentMonth),
      state
    );
  }

  function renderBudgetTab() {
    $("monthlyBudget").value =
      state.budgets.monthlyTotal != null ? state.budgets.monthlyTotal : "";
    const box = $("categoryBudgets");
    box.innerHTML = "";
    state.categories.forEach((cat) => {
      const val = (state.budgets.perCategory || {})[cat.id] || "";
      const row = document.createElement("div");
      row.className = "cat-budget-row";
      row.innerHTML = `
        <span class="cat-icon" style="background:${cat.color}22;color:${cat.color}">${cat.icon}</span>
        <span class="cat-name">${cat.name}</span>
        <input type="number" inputmode="decimal" data-cat="${cat.id}" value="${val}" placeholder="₪" />`;
      const input = row.querySelector("input");
      input.addEventListener("change", () => {
        state = Store.setCategoryBudget(state, cat.id, input.value);
        renderBudgetSummary();
        toast("תקציב עודכן");
      });
      box.appendChild(row);
    });
  }

  function renderSettingsCategories() {
    const box = $("settingsCategories");
    box.innerHTML = "";
    state.categories.forEach((cat) => {
      const row = document.createElement("div");
      row.className = "settings-cat-row";
      row.innerHTML = `
        <span class="cat-icon" style="background:${cat.color}22;color:${cat.color}">${cat.icon}</span>
        <span class="cat-name">${cat.name}</span>
        <button class="mini-btn edit" aria-label="ערוך">✏️</button>
        <button class="mini-btn del" aria-label="מחק">🗑️</button>`;
      row.querySelector(".edit").addEventListener("click", () => openCatModal(cat));
      row.querySelector(".del").addEventListener("click", () => {
        if (confirm(`למחוק את הקטגוריה "${cat.name}"? תנועות קיימות יישארו.`)) {
          state = Store.deleteCategory(state, cat.id);
          renderAll();
        }
      });
      box.appendChild(row);
    });
  }

  function renderDriveStatus() {
    const el = $("driveStatus");
    $("clientIdInput").value = Store.getClientId();
    if (!Drive.isConfigured()) {
      el.textContent = "לא מוגדר (הזן Client ID)";
      el.className = "drive-status";
    } else if (Drive.isSignedIn()) {
      el.textContent = "מחובר ✓";
      el.className = "drive-status ok";
    } else {
      el.textContent = "מוגדר — לחץ סנכרן להתחברות";
      el.className = "drive-status";
    }
  }

  // ---------- התראות תקציב ----------
  function checkBudgetAlert() {
    const st = Model.totalBudgetStatus(state, currentMonth);
    if (st.budget == null) return;
    if (st.level === "over") {
      notify("חריגה מהתקציב!", `הוצאת ${Model.fmtCurrency(st.spent)} מתוך ${Model.fmtCurrency(st.budget)}`);
    } else if (st.level === "warn") {
      notify("מתקרב לתקציב", `${Math.round(st.ratio * 100)}% מהתקציב החודשי נוצל`);
    }
  }

  function notify(title, body) {
    toast(title + " · " + body);
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { body, icon: "icons/icon-192.png" });
      } catch (_) {}
    }
  }

  // ---------- חלון תנועה ----------
  function fillCategorySelect() {
    const sel = $("txCategory");
    sel.innerHTML = "";
    state.categories.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.icon} ${c.name}`;
      sel.appendChild(opt);
    });
  }

  function setModalType(type) {
    modalType = type;
    document.querySelectorAll(".type-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.type === type)
    );
    $("txCategoryField").style.display = type === "income" ? "none" : "";
  }

  function openTxModal(tx) {
    editingTxId = tx ? tx.id : null;
    $("txModalTitle").textContent = tx ? "עריכת תנועה" : "הוספת תנועה";
    fillCategorySelect();
    setModalType(tx ? tx.type : "expense");
    $("txAmount").value = tx ? tx.amount : "";
    $("txCategory").value = tx && tx.type === "expense" ? tx.category : state.categories[0].id;
    $("txDate").value = tx ? tx.date : Model.todayStr();
    $("txNote").value = tx ? tx.note : "";
    $("txModal").classList.remove("hidden");
    $("txAmount").focus();
  }

  function closeTxModal() {
    $("txModal").classList.add("hidden");
    editingTxId = null;
  }

  function saveTx() {
    const amount = parseFloat($("txAmount").value);
    if (!amount || amount <= 0) {
      toast("הזן סכום תקין");
      return;
    }
    const data = {
      type: modalType,
      amount,
      category: modalType === "income" ? Model.INCOME_CATEGORY.id : $("txCategory").value,
      date: $("txDate").value || Model.todayStr(),
      note: $("txNote").value.trim(),
    };
    if (editingTxId) {
      state = Store.updateTransaction(state, editingTxId, data);
      toast("עודכן");
    } else {
      state = Store.addTransaction(state, data);
      toast("נוסף");
    }
    // מעבר לחודש של התנועה שנוספה כדי שתהיה גלויה
    currentMonth = Model.monthKey(data.date);
    closeTxModal();
    renderAll();
    if (modalType === "expense") checkBudgetAlert();
  }

  // ---------- חלון קטגוריה ----------
  function openCatModal(cat) {
    editingCatId = cat ? cat.id : null;
    $("catModalTitle").textContent = cat ? "עריכת קטגוריה" : "קטגוריה חדשה";
    $("catName").value = cat ? cat.name : "";
    $("catIcon").value = cat ? cat.icon : "📦";
    $("catColor").value = cat ? cat.color : "#6b7280";
    $("catModal").classList.remove("hidden");
  }

  function closeCatModal() {
    $("catModal").classList.add("hidden");
    editingCatId = null;
  }

  function saveCat() {
    const name = $("catName").value.trim();
    if (!name) {
      toast("הזן שם קטגוריה");
      return;
    }
    const data = { name, icon: $("catIcon").value.trim() || "📦", color: $("catColor").value };
    if (editingCatId) state = Store.updateCategory(state, editingCatId, data);
    else state = Store.addCategory(state, data);
    closeCatModal();
    renderAll();
    toast("נשמר");
  }

  // ---------- סנכרון Drive ----------
  async function doSync() {
    if (!Drive.isConfigured()) {
      toast("הזן קודם Google Client ID");
      return;
    }
    try {
      $("driveStatus").textContent = "מסנכרן...";
      state = await Drive.sync(state);
      renderAll();
      toast("סונכרן עם Drive ✓");
    } catch (e) {
      console.error(e);
      $("driveStatus").textContent = "שגיאה: " + e.message;
      toast("סנכרון נכשל: " + e.message);
    }
  }

  // ---------- ניווט ----------
  function switchTab(name) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.add("hidden"));
    $("tab-" + name).classList.remove("hidden");
    document.querySelectorAll(".nav-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === name)
    );
    window.scrollTo(0, 0);
  }

  // ---------- קישור אירועים ----------
  function bindEvents() {
    $("prevMonth").addEventListener("click", () => {
      currentMonth = Model.shiftMonth(currentMonth, -1);
      renderAll();
    });
    $("nextMonth").addEventListener("click", () => {
      currentMonth = Model.shiftMonth(currentMonth, 1);
      renderAll();
    });

    document.querySelectorAll(".nav-btn").forEach((b) =>
      b.addEventListener("click", () => switchTab(b.dataset.tab))
    );

    $("fab").addEventListener("click", () => openTxModal(null));
    $("txCancel").addEventListener("click", closeTxModal);
    $("txSave").addEventListener("click", saveTx);
    document.querySelectorAll(".type-btn").forEach((b) =>
      b.addEventListener("click", () => setModalType(b.dataset.type))
    );

    $("catCancel").addEventListener("click", closeCatModal);
    $("catSave").addEventListener("click", saveCat);
    $("addCategoryBtn").addEventListener("click", () => openCatModal(null));

    document.querySelectorAll(".tx-filter .chip").forEach((c) =>
      c.addEventListener("click", () => {
        txFilter = c.dataset.filter;
        document.querySelectorAll(".tx-filter .chip").forEach((x) =>
          x.classList.toggle("active", x === c)
        );
        renderTxList();
      })
    );

    $("monthlyBudget").addEventListener("change", (e) => {
      state = Store.setMonthlyBudget(state, e.target.value);
      renderBudgetSummary();
      toast("תקציב חודשי עודכן");
    });

    // הגדרות: Drive
    $("saveClientIdBtn").addEventListener("click", () => {
      Store.setClientId($("clientIdInput").value);
      renderDriveStatus();
      toast("מזהה נשמר");
    });
    $("syncBtn").addEventListener("click", doSync);

    // גיבוי מקומי
    $("exportBtn").addEventListener("click", exportData);
    $("importBtn").addEventListener("click", () => $("importFile").click());
    $("importFile").addEventListener("change", importData);

    // התראות
    $("notifyBtn").addEventListener("click", () => {
      if (!("Notification" in window)) return toast("הדפדפן לא תומך בהתראות");
      Notification.requestPermission().then((p) =>
        toast(p === "granted" ? "התראות מאושרות ✓" : "התראות לא אושרו")
      );
    });

    // סגירת חלונות בלחיצה על הרקע
    document.querySelectorAll(".modal").forEach((m) =>
      m.addEventListener("click", (e) => {
        if (e.target === m) m.classList.add("hidden");
      })
    );
  }

  function exportData() {
    const blob = new Blob([Store.exportJSON(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-backup-${Model.todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("קובץ יוצא");
  }

  function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        state = Store.importJSON(reader.result);
        renderAll();
        toast("יובא בהצלחה ✓");
      } catch (err) {
        toast("ייבוא נכשל: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  // ---------- אתחול ----------
  function init() {
    bindEvents();
    renderAll();
    // רישום Service Worker ל-PWA / אופליין
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch((e) =>
        console.warn("SW registration failed", e)
      );
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
