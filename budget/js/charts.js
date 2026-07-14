// charts.js — גרפי SVG ידניים, ללא תלות בספריות חיצוניות (עובד אופליין).

const SVGNS = "http://www.w3.org/2000/svg";
const M = () => window.BudgetModel;

function el(tag, attrs = {}, text) {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

// גרף עמודות: הכנסות מול הוצאות לאורך חודשים.
// series: [{month, expenses, income}]
function renderMonthlyBars(container, series) {
  container.innerHTML = "";
  if (!series.length) {
    container.appendChild(emptyMsg("אין נתונים להצגה"));
    return;
  }
  const W = 340, H = 200, padB = 34, padT = 12, padX = 8;
  const max = Math.max(1, ...series.map((s) => Math.max(s.expenses, s.income)));
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart-svg", role: "img" });

  const groupW = (W - padX * 2) / series.length;
  const barW = Math.min(18, groupW / 3);
  const chartH = H - padB - padT;

  series.forEach((s, i) => {
    const gx = padX + i * groupW + groupW / 2;
    const incH = (s.income / max) * chartH;
    const expH = (s.expenses / max) * chartH;
    // הכנסה (ירוק) משמאל, הוצאה (אדום) מימין
    svg.appendChild(
      el("rect", {
        x: gx - barW - 1, y: H - padB - incH, width: barW, height: Math.max(0, incH),
        rx: 3, fill: "#22c55e",
      })
    );
    svg.appendChild(
      el("rect", {
        x: gx + 1, y: H - padB - expH, width: barW, height: Math.max(0, expH),
        rx: 3, fill: "#ef4444",
      })
    );
    // תווית חודש (מספר חודש בלבד לחיסכון במקום)
    const mm = s.month.split("-")[1];
    svg.appendChild(
      el("text", { x: gx, y: H - padB + 16, "text-anchor": "middle", class: "chart-label" }, mm)
    );
  });

  container.appendChild(svg);
  container.appendChild(legend([
    { color: "#22c55e", label: "הכנסות" },
    { color: "#ef4444", label: "הוצאות" },
  ]));
}

// גרף טבעת (donut) לפילוח הוצאות לפי קטגוריה.
// items: [{categoryId, total}], state לצורך שמות/צבעים
function renderCategoryDonut(container, items, state) {
  container.innerHTML = "";
  const total = items.reduce((s, i) => s + i.total, 0);
  if (!total) {
    container.appendChild(emptyMsg("אין הוצאות בחודש זה"));
    return;
  }
  const size = 180, r = 70, cx = size / 2, cy = size / 2, stroke = 26;
  const svg = el("svg", { viewBox: `0 0 ${size} ${size}`, class: "chart-svg donut", role: "img" });
  const circ = 2 * Math.PI * r;
  let offset = 0;

  items.forEach((item) => {
    const cat = M().findCategory(state, item.categoryId);
    const frac = item.total / total;
    const seg = el("circle", {
      cx, cy, r,
      fill: "none",
      stroke: cat.color,
      "stroke-width": stroke,
      "stroke-dasharray": `${frac * circ} ${circ}`,
      "stroke-dashoffset": -offset,
      transform: `rotate(-90 ${cx} ${cy})`,
    });
    svg.appendChild(seg);
    offset += frac * circ;
  });

  // סכום במרכז
  svg.appendChild(
    el("text", { x: cx, y: cy - 2, "text-anchor": "middle", class: "donut-total" },
      M().fmtCurrency(total))
  );
  svg.appendChild(
    el("text", { x: cx, y: cy + 16, "text-anchor": "middle", class: "chart-label" }, "סה\"כ הוצאות")
  );

  container.appendChild(svg);
  container.appendChild(
    legend(items.map((i) => {
      const c = M().findCategory(state, i.categoryId);
      const pct = Math.round((i.total / total) * 100);
      return { color: c.color, label: `${c.icon} ${c.name} · ${pct}%` };
    }))
  );
}

function legend(entries) {
  const wrap = document.createElement("div");
  wrap.className = "chart-legend";
  entries.forEach((e) => {
    const item = document.createElement("span");
    item.className = "legend-item";
    const dot = document.createElement("span");
    dot.className = "legend-dot";
    dot.style.background = e.color;
    item.appendChild(dot);
    item.appendChild(document.createTextNode(e.label));
    wrap.appendChild(item);
  });
  return wrap;
}

function emptyMsg(text) {
  const d = document.createElement("div");
  d.className = "chart-empty";
  d.textContent = text;
  return d;
}

window.BudgetCharts = { renderMonthlyBars, renderCategoryDonut };
