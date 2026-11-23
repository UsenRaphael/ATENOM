// =========================================
// ATENOM - Expense Tracker
// File: static/script.js
// =========================================


// ========== ATENOM LOADING INDICATOR ==========
// The page overlay is shown by the HTML and hidden once the page finishes loading.
(function () {
  const loader = document.getElementById("atenom-loader");
  if (!loader) return;

  function showLoader() {
    loader.classList.remove("loader-hidden");
    loader.setAttribute("aria-hidden", "false");
  }

  function hideLoader() {
    loader.classList.add("loader-hidden");
    loader.setAttribute("aria-hidden", "true");
  }

  // Reusable for future async actions (fetching, saving, etc.).
  window.AtenomLoader = { show: showLoader, hide: hideLoader };

  if (document.readyState === "complete") {
    hideLoader();
  } else {
    window.addEventListener("load", hideLoader, { once: true });
  }

  // Restore the correct state when returning through the browser back/forward cache.
  window.addEventListener("pageshow", function () {
    hideLoader();
  });
})();


// ========== SETTINGS AND DATA ==========

// Supported currencies: code -> symbol
const CURRENCIES = {
  USD: "$",   EUR: "€",   GBP: "£",   NGN: "₦",
  GHS: "GH₵", KES: "KSh ", ZAR: "R",  INR: "₹",
  JPY: "¥",   CNY: "CN¥", CAD: "CA$", AUD: "A$",
  AED: "AED ", BRL: "R$"
};
let currencyCode = "USD";   // the selected currency (saved in the browser)

let incomes = [];         // money coming in: { id, name, amount, source, date }
let nextIncomeId = 1;
let ovMonth = getTodayString().slice(0, 7);   // the month the Overview shows, like "2026-11"
let chartMode = "expense";
let donutMode = "expense";
let expenses = [];        // the list that holds every expense
let nextId = 1;           // each expense gets its own number

const MAX_AMOUNT = 1000000000000;   // one trillion: the biggest amount accepted

// The email address that "Send message" (Contact page) writes to.
// PUT YOUR REAL EMAIL ADDRESS HERE. It appears on the Contact page too.
const CONTACT_EMAIL = "hello@example.com";
const MAX_CATEGORIES = 20;          // how many categories a person can create
const MAX_NAME_LENGTH = 24;         // longest category name

// Colors handed out to new categories (the person can change them)
const COLOR_CHOICES = [
  "#ff7a8a", "#ffb27a", "#ffd166", "#a8ff7a", "#3ddc97",
  "#5eead4", "#7ac1ff", "#9d8cff", "#ff7ad1", "#c4a484"
];

let editingId = null;         // id of the expense being edited (null = adding a new one)
let expPeriod = "all";        // Expenses page: which period to show
let expSort = "newest";       // Expenses page: sort order
let reportPeriod = "month";   // Reports page: which period to report on
let currentView = "overview"; // which page is showing

const REPORT_PERIODS = ["month", "30d", "3m", "6m", "year", "all"];

let searchText = "";          // what is typed in the search box
let activeCategory = "All";   // "All", or the id of the selected category

// The categories are created by the person using the app.
// Each one looks like { id: "c1abc", name: "Groceries", color: "#3ddc97" }
let categories = [];
// One budget per category, stored by category id: { c1abc: 500 }
let budgets = {};


// ========== FIND ELEMENTS ==========

const themeToggle = document.getElementById("theme-toggle");

const modal = document.getElementById("modal");
const openModalBtn = document.getElementById("open-modal-btn");
const cancelBtn = document.getElementById("cancel-btn");
const addBtn = document.getElementById("add-btn");

const nameInput = document.getElementById("name");
const amountInput = document.getElementById("amount");
const categoryInput = document.getElementById("category");
const dateInput = document.getElementById("date");
const editCategoriesBtn = document.getElementById("edit-categories-btn");

const tableBody = document.getElementById("expense-list");     // Expenses page table
const modalTitleEl = document.getElementById("modal-title");
const incMonthEl = document.getElementById("inc-month");
const cashflowEl = document.getElementById("cashflow");
const monthTotalEl = document.getElementById("month-total");

const searchInput = document.getElementById("search");
const filtersEl = document.getElementById("filters");
const expPeriodSelect = document.getElementById("exp-period");
const expSortSelect = document.getElementById("exp-sort");
const exportBtn = document.getElementById("export-btn");

// Page elements
const pageTitleEl = document.getElementById("page-title");
const pageSubtitleEl = document.getElementById("page-subtitle");
const lineChartEl = document.getElementById("line-chart");
const donutChartEl = document.getElementById("donut-chart");
const trendChartEl = document.getElementById("trend-chart");
const reportDonutEl = document.getElementById("report-donut");
const reportPeriodSelect = document.getElementById("report-period");
const toastEl = document.getElementById("toast");
const tipEl = document.getElementById("chart-tip");

// Budget elements
const budgetCard = document.getElementById("budget-card");
const budgetModal = document.getElementById("budget-modal");
const budgetFieldsEl = document.getElementById("budget-fields");
const cancelBudgetBtn = document.getElementById("cancel-budget-btn");
const saveBudgetBtn = document.getElementById("save-budget-btn");
const sidebarBudgetEl = document.getElementById("sidebar-budget");
const budgetLeftEl = document.getElementById("budget-left");
const budgetBarsEl = document.getElementById("budget-bars");

// Category editor elements
const categoryModal = document.getElementById("category-modal");
const categoryHelpEl = document.getElementById("category-help");
const categoryRowsEl = document.getElementById("category-rows");
const addCategoryRowBtn = document.getElementById("add-category-row");
const cancelCategoryBtn = document.getElementById("cancel-category-btn");
const saveCategoryBtn = document.getElementById("save-category-btn");


// ========== SAFE STORAGE ==========
// localStorage can throw (private mode, blocked storage). These never crash the app.
function storeGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function storeSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
}


// ========== THEME (LIGHT / DARK) ==========

function setTheme(theme) {
  if (theme !== "light" && theme !== "dark") theme = "dark";
  document.documentElement.setAttribute("data-theme", theme);
  storeSet("theme", theme);
  themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
  themeToggle.setAttribute("aria-label",
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
}

setTheme(storeGet("theme") || "dark");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let themeFadeTimer = null;

// Switches theme with a slick animation:
//  - Browsers with View Transitions: a circle of the new theme grows out of the button.
//  - Other browsers: all colors fade smoothly.
//  - "Reduce motion" on: instant switch.
function changeTheme(next) {
  const rect = themeToggle.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  // Spin the button
  themeToggle.classList.remove("spin");
  void themeToggle.offsetWidth;   // restart the animation
  themeToggle.classList.add("spin");

  if (reducedMotion.matches) {
    setTheme(next);
    return;
  }

  if (document.startViewTransition) {
    // The circle has to reach the farthest corner of the screen
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = document.startViewTransition(function () {
      setTheme(next);
    });

    transition.ready.then(function () {
      document.documentElement.animate(
        {
          clipPath: [
            "circle(0px at " + x + "px " + y + "px)",
            "circle(" + radius + "px at " + x + "px " + y + "px)"
          ]
        },
        {
          duration: 800,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          pseudoElement: "::view-transition-new(root)"
        }
      );
    }).catch(function () { /* transition was skipped: nothing to do */ });
    return;
  }

  // Fallback: fade every color
  const root = document.documentElement;
  root.classList.add("theme-fading");
  setTheme(next);
  clearTimeout(themeFadeTimer);
  themeFadeTimer = setTimeout(function () {
    root.classList.remove("theme-fading");
  }, 800);
}

themeToggle.addEventListener("click", function () {
  const current = document.documentElement.getAttribute("data-theme");
  changeTheme(current === "dark" ? "light" : "dark");
});


// ========== CURRENCY ==========

const currencySelect = document.getElementById("currency-select");

// Fill the dropdown from the CURRENCIES list
Object.keys(CURRENCIES).forEach(function (code) {
  const option = document.createElement("option");
  option.value = code;
  option.textContent = code + " (" + CURRENCIES[code].trim() + ")";
  currencySelect.appendChild(option);
});

function setCurrency(code) {
  if (!CURRENCIES[code]) code = "USD";
  currencyCode = code;
  currencySelect.value = code;
  storeSet("currency", code);
}

setCurrency(storeGet("currency") || "USD");

currencySelect.addEventListener("change", function () {
  setCurrency(currencySelect.value);
  render();   // redraw every amount with the new symbol
});


// ========== (no sidebar: navigation lives in the header and the app tabs) ==========

const mobileQuery = window.matchMedia("(max-width: 900px)");

// ========== FIT BIG NUMBERS INSIDE THEIR BOXES ==========
// Every .card-value is one line. If the number is too wide for its box,
// the font shrinks until it fits (works for amounts up to a trillion).

function fitValue(el) {
  el.style.fontSize = "";                 // start from the normal CSS size
  const available = el.clientWidth;
  const needed = el.scrollWidth;
  if (available > 0 && needed > available) {
    const base = parseFloat(getComputedStyle(el).fontSize);
    const fitted = Math.floor((base * available / needed) * 10) / 10 - 0.5;
    el.style.fontSize = Math.max(9, fitted) + "px";
  }
}

function fitAll() {
  document.querySelectorAll(".card-value").forEach(fitValue);
}

// Refit when a box changes width (window resize, menu sliding open or closed)
const valueObserver = new ResizeObserver(function (entries) {
  requestAnimationFrame(function () {
    entries.forEach(function (entry) { fitValue(entry.target); });
  });
});
document.querySelectorAll(".card-value").forEach(function (el) {
  valueObserver.observe(el);
});


// ========== HELPER FUNCTIONS ==========

// Returns today's date like "2026-11-12"
function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

// Turns 1234.5 into "$1,234.50" (and -5 into "-$5.00") using the chosen currency
function formatMoney(amount) {
  const sign = amount < 0 ? "-" : "";
  const decimals = currencyCode === "JPY" ? 0 : 2;
  const number = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  return sign + CURRENCIES[currencyCode] + number;
}

// Makes text safe to place inside HTML
function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Finds a category by its id (or returns null)
function getCategory(id) {
  return categories.find(function (category) { return category.id === id; }) || null;
}

function makeCategoryId() {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Gives a new category the first color nobody is using yet
function pickColor(list) {
  const used = list.map(function (item) { return item.color.toLowerCase(); });
  const free = COLOR_CHOICES.find(function (color) { return !used.includes(color); });
  return free || COLOR_CHOICES[list.length % COLOR_CHOICES.length];
}

function budgetOf(id) {
  return budgets[id] || 0;
}

// ----- Dates (all dates are text like "2026-11-20") -----
const MONTH_LONG = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDate(text) {
  const parts = text.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function dateToString(date) {
  return date.getFullYear() + "-" +
    String(date.getMonth() + 1).padStart(2, "0") + "-" +
    String(date.getDate()).padStart(2, "0");
}

function addDays(text, count) {
  const date = parseDate(text);
  date.setDate(date.getDate() + count);
  return dateToString(date);
}

function daysBetween(from, to) {
  return Math.round((parseDate(to) - parseDate(from)) / 86400000);
}

// Goes back a number of months (and keeps the day inside the shorter month)
function shiftMonths(text, months) {
  const date = parseDate(text);
  const target = new Date(date.getFullYear(), date.getMonth() - months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return dateToString(target);
}

function endOfMonth(text) {
  const date = parseDate(text);
  return dateToString(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function formatShortDate(text) {
  const date = parseDate(text);
  return MONTH_SHORT[date.getMonth()] + " " + date.getDate();
}

// Does a date fall inside the Expenses page "Period" choice?
function matchesExpPeriod(dateText) {
  const today = getTodayString();
  if (expPeriod === "month") return dateText.slice(0, 7) === today.slice(0, 7);
  if (expPeriod === "last-month") return dateText.slice(0, 7) === shiftMonths(today.slice(0, 8) + "01", 1).slice(0, 7);
  if (expPeriod === "30d") return dateText >= addDays(today, -29) && dateText <= today;
  if (expPeriod === "year") return dateText.slice(0, 4) === today.slice(0, 4);
  return true;
}

// Returns the expenses on the Expenses page: search + category + period, then sorted
function getVisibleExpenses() {
  const list = expenses.filter(function (expense) {
    const category = getCategory(expense.category);
    const categoryName = category ? category.name.toLowerCase() : "";
    const matchesCategory =
      activeCategory === "All" || expense.category === activeCategory;
    const matchesSearch =
      expense.name.toLowerCase().includes(searchText) ||
      categoryName.includes(searchText);
    return matchesCategory && matchesSearch && matchesExpPeriod(expense.date);
  });

  list.sort(function (a, b) {
    if (expSort === "oldest") return a.date.localeCompare(b.date) || a.id - b.id;
    if (expSort === "highest") return b.amount - a.amount;
    if (expSort === "lowest") return a.amount - b.amount;
    if (expSort === "name") return a.name.localeCompare(b.name);
    return b.date.localeCompare(a.date) || b.id - a.id;   // newest first
  });
  return list;
}

// Expenses with a date from "from" to "to" (both included)
function expensesBetween(from, to) {
  return expenses.filter(function (expense) {
    return expense.date >= from && expense.date <= to;
  });
}

function sumOf(list) {
  return list.reduce(function (sum, expense) { return sum + expense.amount; }, 0);
}

// Totals per category, biggest first: [{ name, color, value }]
function categorySlices(list) {
  const totals = {};
  list.forEach(function (expense) {
    totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
  });
  return categories
    .map(function (category) {
      return { name: category.name, color: category.color, value: totals[category.id] || 0 };
    })
    .filter(function (slice) { return slice.value > 0; })
    .sort(function (x, y) { return y.value - x.value; });
}


// ========== SAVING AND LOADING ==========

function saveCategories() {
  storeSet("categories", JSON.stringify(categories));
}

function loadCategories() {
  try {
    const saved = JSON.parse(storeGet("categories"));
    if (Array.isArray(saved)) {
      categories = saved.filter(function (item) {
        return item &&
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          /^#[0-9a-f]{6}$/i.test(item.color);
      }).slice(0, MAX_CATEGORIES);
    }
  } catch (error) {
    console.log("Could not read saved categories:", error);
  }
}

function saveExpenses() {
  storeSet("expenses", JSON.stringify(expenses));
}

// Read saved expenses when the page starts (only valid ones, only for categories that exist)
function loadExpenses() {
  try {
    const saved = JSON.parse(storeGet("expenses"));
    if (Array.isArray(saved)) {
      expenses = saved.filter(function (item) {
        return item &&
          typeof item.id === "number" &&
          typeof item.name === "string" &&
          typeof item.amount === "number" && item.amount > 0 && item.amount <= MAX_AMOUNT &&
          typeof item.category === "string" && getCategory(item.category) !== null &&
          typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date);
      });
      nextId = expenses.reduce(function (max, item) { return Math.max(max, item.id); }, 0) + 1;
    }
  } catch (error) {
    console.log("Could not read saved expenses:", error);
  }
}

// Save the budgets in the browser so they survive a refresh
function saveBudgets() {
  storeSet("budgets", JSON.stringify(budgets));
}

// Read saved budgets when the page starts (only for categories that exist)
function loadBudgets() {
  try {
    const saved = JSON.parse(storeGet("budgets"));
    if (saved && typeof saved === "object") {
      categories.forEach(function (category) {
        const value = saved[category.id];
        if (typeof value === "number" && value >= 0 && value <= MAX_AMOUNT) {
          budgets[category.id] = value;
        }
      });
    }
  } catch (error) {
    console.log("Could not read saved budgets:", error);
  }
}


// ========== RENDER: DRAW THE PAGE FROM THE DATA ==========

// The filter buttons: All, then one per category, then the Categories button
function renderFilters() {
  let html = '<button class="filter-btn' +
    (activeCategory === "All" ? " active" : "") +
    '" data-category="All">All</button>';

  categories.forEach(function (category) {
    html += '<button class="filter-btn' +
      (activeCategory === category.id ? " active" : "") +
      '" data-category="' + category.id + '">' +
      '<span class="dot" style="--cat: ' + category.color + '"></span>' +
      escapeHTML(category.name) + '</button>';
  });

  html += '<button class="filter-btn manage-btn" data-action="manage-categories">⚙ Categories</button>';
  filtersEl.innerHTML = html;
}

// One table row per expense (used by the Overview and Expenses tables)
function expenseRowsHTML(list) {
  let rows = "";
  list.forEach(function (expense) {
    const category = getCategory(expense.category);
    const tagName = category ? escapeHTML(category.name) : "Uncategorized";
    const tagColor = category ? category.color : "#8b8ba3";
    rows += `
      <tr>
        <td class="name-cell">${escapeHTML(expense.name)}</td>
        <td><span class="tag" style="--cat: ${tagColor}">${tagName}</span></td>
        <td>${expense.date}</td>
        <td>${formatMoney(expense.amount)}</td>
        <td class="actions">
          <button class="edit-btn" data-id="${expense.id}" aria-label="Edit expense">✎</button>
          <button class="delete-btn" data-id="${expense.id}" aria-label="Delete expense">✕</button>
        </td>
      </tr>
    `;
  });
  return rows;
}

function emptyRow(message) {
  return '<tr><td colspan="5" class="empty">' + message + '</td></tr>';
}

function noExpensesMessage() {
  return categories.length === 0
    ? "Start by creating your own categories with ⚙ Categories, then click + Add."
    : "No expenses yet. Click + Add to start.";
}

// Expenses page: the full list with its summary cards
function renderExpensesPage() {
  const list = getVisibleExpenses();

  if (expenses.length === 0) {
    tableBody.innerHTML = emptyRow(noExpensesMessage());
  } else if (list.length === 0) {
    tableBody.innerHTML = emptyRow("No expenses match your search or filters.");
  } else {
    tableBody.innerHTML = expenseRowsHTML(list);
  }

  const total = sumOf(list);
  const biggest = list.reduce(function (max, expense) { return Math.max(max, expense.amount); }, 0);
  document.getElementById("x-count").textContent = String(list.length);
  document.getElementById("x-total").textContent = formatMoney(total);
  document.getElementById("x-avg").textContent = list.length ? formatMoney(total / list.length) : "-";
  document.getElementById("x-max").textContent = list.length ? formatMoney(biggest) : "-";
}

function monthRange(month) {
  return [month + "-01", month + "-31"];
}

function monthName(month) {
  return MONTH_LONG[Number(month.slice(5, 7)) - 1] + " " + month.slice(0, 4);
}

function renderStats() {
  const range = monthRange(ovMonth);
  const spent = sumOf(expensesBetween(range[0], range[1]));
  const earned = incomes
    .filter(function (item) { return item.date >= range[0] && item.date <= range[1]; })
    .reduce(function (sum, item) { return sum + item.amount; }, 0);
  const flow = earned - spent;

  incMonthEl.textContent = formatMoney(earned);
  monthTotalEl.textContent = formatMoney(spent);
  cashflowEl.textContent = formatMoney(flow);
  cashflowEl.classList.toggle("negative", flow < 0);
  document.querySelectorAll(".ov-month-tag").forEach(function (el) { el.textContent = monthName(ovMonth); });
  fitAll();
}

// The budget numbers and the budget bars
function renderBudget() {
  const thisMonth = ovMonth;

  // How much was spent THIS MONTH in each category?
  const spentByCategory = {};
  categories.forEach(function (category) {
    spentByCategory[category.id] = 0;
  });

  let monthTotal = 0;
  expenses.forEach(function (expense) {
    if (expense.date.startsWith(thisMonth)) {
      if (expense.category in spentByCategory) {
        spentByCategory[expense.category] += expense.amount;
      }
      monthTotal += expense.amount;
    }
  });

  // The monthly budget is all the category budgets added together
  const monthlyBudget = categories.reduce(function (sum, category) {
    return sum + budgetOf(category.id);
  }, 0);

  // The sidebar card and the "Budget left" card
  if (monthlyBudget > 0) {
    const left = monthlyBudget - monthTotal;
    sidebarBudgetEl.textContent = formatMoney(monthlyBudget);
    budgetLeftEl.textContent = formatMoney(left);
    budgetLeftEl.classList.toggle("negative", left < 0);
  } else {
    sidebarBudgetEl.textContent = "Not set";
    budgetLeftEl.textContent = "-";
    budgetLeftEl.classList.remove("negative");
  }

  // No categories yet
  if (categories.length === 0) {
    budgetBarsEl.innerHTML =
      '<p class="empty-note">Your categories will show up here. ' +
      'Click ⚙ Categories to create your first one.</p>';
    fitAll();
    return;
  }

  // One card per category: name, spent / budget, percentage and a traffic-light bar
  let cards = "";
  categories.forEach(function (category) {
    const spent = spentByCategory[category.id];
    const budget = budgetOf(category.id);
    const name = '<span class="dot" style="--cat: ' + category.color + '"></span>' + escapeHTML(category.name);
    const percent = budget > 0 ? (spent / budget) * 100 : 0;
    let barClass = "";
    if (percent >= 100) barClass = "danger"; else if (percent >= 75) barClass = "warn";

    cards += `
      <button type="button" class="cat-card" data-action="edit-budgets" aria-label="Edit budget for ${escapeAttr(category.name)}">
        <span class="cc-name">${name}</span>
        <span class="cc-nums"><b>${formatMoney(spent)}</b><span>${budget > 0 ? "of " + formatMoney(budget) : "No budget set"}</span></span>
        <span class="cc-bar"><span class="bar-fill ${barClass}" style="width: ${Math.min(percent, 100)}%"></span></span>
        <span class="cc-pct">${budget > 0 ? Math.round(percent) + "%" : "—"}</span>
      </button>
    `;
  });
  budgetBarsEl.innerHTML = cards;
  fitAll();
}

// One function that redraws everything
function render() {
  renderFilters();
  renderExpensesPage();
  renderGroups();
  renderMonthlyStats();
  renderStats();
  renderBudget();
  renderOverviewCharts();
  renderReports();
  fitAll();
  drawCharts(true);
}


// ========== CHART TOOLS (drawn with plain SVG, no library needed) ==========

function escapeAttr(text) {
  return String(text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// 1234567 -> "$1.23M"  (short labels for chart axes)
function formatCompact(amount) {
  const units = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const unit of units) {
    if (Math.abs(amount) >= unit[0]) {
      return CURRENCIES[currencyCode] + parseFloat((amount / unit[0]).toFixed(2)) + unit[1];
    }
  }
  return CURRENCIES[currencyCode] + parseFloat(amount.toFixed(2));
}

// Picks a tidy top value and step for the vertical axis (1, 2, 2.5, 5 x 10^n)
function niceScale(max, tickCount) {
  const rough = max / tickCount;
  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const fraction = rough / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  const step = nice * power;
  return { step: step, max: step * Math.ceil(max / step - 1e-9) };
}

// A smooth line through the points that never dips below or above them (monotone cubic)
function smoothPath(points) {
  const n = points.length;
  if (n === 1) return "M" + points[0].x + "," + points[0].y;

  const dx = [], slope = [], tangent = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1].x - points[i].x;
    slope[i] = (points[i + 1].y - points[i].y) / dx[i];
  }
  tangent[0] = slope[0];
  tangent[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    tangent[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
    } else {
      const a = tangent[i] / slope[i];
      const b = tangent[i + 1] / slope[i];
      const size = a * a + b * b;
      if (size > 9) {
        const factor = 3 / Math.sqrt(size);
        tangent[i] = factor * a * slope[i];
        tangent[i + 1] = factor * b * slope[i];
      }
    }
  }

  let path = "M" + points[0].x + "," + points[0].y;
  for (let i = 0; i < n - 1; i++) {
    path += " C" + (points[i].x + dx[i] / 3) + "," + (points[i].y + tangent[i] * dx[i] / 3) +
      " " + (points[i + 1].x - dx[i] / 3) + "," + (points[i + 1].y - tangent[i + 1] * dx[i] / 3) +
      " " + points[i + 1].x + "," + points[i + 1].y;
  }
  return path;
}

// Turns expenses into one total per day (up to 62 days) or per month (longer ranges)
function buildBuckets(start, end, list) {
  const span = daysBetween(start, end) + 1;
  const buckets = [];

  if (span <= 62) {
    for (let i = 0; i < span; i++) {
      const day = addDays(start, i);
      buckets.push({ label: formatShortDate(day), tip: formatShortDate(day) + ", " + day.slice(0, 4), total: 0 });
    }
    list.forEach(function (expense) {
      const index = daysBetween(start, expense.date);
      if (buckets[index]) buckets[index].total += expense.amount;
    });
    return { buckets: buckets, unit: "daily" };
  }

  const first = parseDate(start);
  const last = parseDate(end);
  const lookup = {};
  let year = first.getFullYear();
  let month = first.getMonth();
  while (year < last.getFullYear() || (year === last.getFullYear() && month <= last.getMonth())) {
    lookup[year + "-" + String(month + 1).padStart(2, "0")] = buckets.length;
    buckets.push({ label: MONTH_SHORT[month], year: year, tip: MONTH_SHORT[month] + " " + year, total: 0 });
    month++;
    if (month > 11) { month = 0; year++; }
  }
  list.forEach(function (expense) {
    const index = lookup[expense.date.slice(0, 7)];
    if (index !== undefined) buckets[index].total += expense.amount;
  });
  if (buckets[0].year !== buckets[buckets.length - 1].year) {
    buckets.forEach(function (bucket) { bucket.label += " '" + String(bucket.year).slice(2); });
  }
  return { buckets: buckets, unit: "monthly" };
}

// Shared by the line and bar charts: sizes, axis ticks, grid
function chartFrame(width, height, buckets) {
  const max = Math.max.apply(null, buckets.map(function (bucket) { return bucket.total; }));
  const scale = niceScale(max, 4);
  const ticks = [];
  for (let i = 0; i * scale.step <= scale.max * 1.0001; i++) ticks.push(i * scale.step);

  const labelChars = Math.max.apply(null, ticks.map(function (tick) { return formatCompact(tick).length; }));
  const frame = {
    padLeft: labelChars * 6.4 + 14, padRight: 14, padTop: 12, padBottom: 28,
    scale: scale, ticks: ticks
  };
  frame.plotWidth = width - frame.padLeft - frame.padRight;
  frame.plotHeight = height - frame.padTop - frame.padBottom;
  frame.y = function (value) {
    return frame.padTop + frame.plotHeight - (value / scale.max) * frame.plotHeight;
  };

  let svg = "";
  ticks.forEach(function (tick) {
    const y = frame.y(tick);
    svg += '<line class="chart-grid" x1="' + frame.padLeft + '" x2="' + (width - frame.padRight) +
      '" y1="' + y + '" y2="' + y + '"/>' +
      '<text class="chart-label" x="' + (frame.padLeft - 8) + '" y="' + (y + 4) +
      '" text-anchor="end">' + escapeHTML(formatCompact(tick)) + '</text>';
  });
  frame.gridSVG = svg;
  return frame;
}

function drawLineChart(el, buckets, animate) {
  const width = el.clientWidth;
  const height = 290;
  el.dataset.w = width;
  el.classList.toggle("chart-animate", animate);

  if (Math.max.apply(null, buckets.map(function (bucket) { return bucket.total; })) <= 0) {
    el.innerHTML = '<p class="chart-empty">' + (el.dataset.empty || "No spending in this period yet.") + '</p>';
    return;
  }

  const frame = chartFrame(width, height, buckets);
  const n = buckets.length;
  const x = function (i) {
    return frame.padLeft + (n === 1 ? frame.plotWidth / 2 : (frame.plotWidth * i) / (n - 1));
  };
  const points = buckets.map(function (bucket, i) { return { x: x(i), y: frame.y(bucket.total) }; });
  const baseline = frame.padTop + frame.plotHeight;
  const line = smoothPath(points);
  const area = line + " L" + x(n - 1) + "," + baseline + " L" + x(0) + "," + baseline + " Z";
  const gradientId = "grad-" + el.id;

  let svg = '<svg class="chart-svg" width="' + width + '" height="' + height +
    '" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Spending over time">' +
    '<defs><linearGradient id="' + gradientId + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" style="stop-color: var(--accent); stop-opacity: 0.4"/>' +
    '<stop offset="1" style="stop-color: var(--accent); stop-opacity: 0"/></linearGradient></defs>';
  svg += frame.gridSVG;
  svg += '<path class="chart-area" d="' + area + '" fill="url(#' + gradientId + ')"/>';
  svg += '<path class="chart-line" pathLength="1" d="' + line + '"/>';

  const labelStep = Math.ceil(n / Math.max(2, Math.floor(frame.plotWidth / 62)));
  buckets.forEach(function (bucket, i) {
    if (i % labelStep === 0) {
      svg += '<text class="chart-label" x="' + x(i) + '" y="' + (height - 8) +
        '" text-anchor="middle">' + escapeHTML(bucket.label) + '</text>';
    }
    svg += '<g class="pt" data-tip="' + escapeAttr(bucket.tip + " · " + formatMoney(bucket.total)) + '">' +
      '<circle class="pt-hit" cx="' + points[i].x + '" cy="' + points[i].y + '" r="10"/>' +
      '<circle class="pt-dot" cx="' + points[i].x + '" cy="' + points[i].y + '" r="4"/></g>';
  });

  el.innerHTML = svg + '</svg>';
}

function drawBarChart(el, buckets, animate) {
  const width = el.clientWidth;
  const height = 260;
  el.dataset.w = width;
  el.classList.toggle("chart-animate", animate);

  if (Math.max.apply(null, buckets.map(function (bucket) { return bucket.total; })) <= 0) {
    el.innerHTML = '<p class="chart-empty">No spending in this period yet.</p>';
    return;
  }

  const frame = chartFrame(width, height, buckets);
  const n = buckets.length;
  const band = frame.plotWidth / n;
  const barWidth = Math.min(46, band * 0.64);
  const gradientId = "bars-" + el.id;

  let svg = '<svg class="chart-svg" width="' + width + '" height="' + height +
    '" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Spending trend">' +
    '<defs><linearGradient id="' + gradientId + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" style="stop-color: var(--accent)"/>' +
    '<stop offset="1" style="stop-color: rgb(var(--accent2-rgb))"/></linearGradient></defs>';
  svg += frame.gridSVG;

  const labelStep = Math.ceil(n / Math.max(2, Math.floor(frame.plotWidth / 60)));
  buckets.forEach(function (bucket, i) {
    const left = frame.padLeft + band * i;
    const barHeight = bucket.total > 0
      ? Math.max(2, (bucket.total / frame.scale.max) * frame.plotHeight) : 0;
    const delay = Math.min(i * 28, 600);

    svg += '<g class="band" style="--d: ' + delay + '" data-tip="' +
      escapeAttr(bucket.tip + " · " + formatMoney(bucket.total)) + '">' +
      '<rect fill="transparent" x="' + left + '" y="' + frame.padTop + '" width="' + band +
      '" height="' + frame.plotHeight + '"/>';
    if (barHeight > 0) {
      svg += '<rect class="bar" fill="url(#' + gradientId + ')" rx="' + Math.min(5, barWidth / 2) +
        '" x="' + (left + (band - barWidth) / 2) + '" y="' + (frame.padTop + frame.plotHeight - barHeight) +
        '" width="' + barWidth + '" height="' + barHeight + '"/>';
    }
    svg += '</g>';

    if (i % labelStep === 0) {
      svg += '<text class="chart-label" x="' + (left + band / 2) + '" y="' + (height - 8) +
        '" text-anchor="middle">' + escapeHTML(bucket.label) + '</text>';
    }
  });

  el.innerHTML = svg + '</svg>';
}

// Donut + legend as HTML. slices = [{ name, color, value }]
function donutHTML(slices, emptyMessage) {
  const total = slices.reduce(function (sum, slice) { return sum + slice.value; }, 0);
  if (total <= 0) {
    return '<p class="chart-empty">' + (emptyMessage || 'No spending to show yet.') + '</p>';
  }

  const gap = slices.length > 1 ? 0.8 : 0;
  let offset = 0;
  let circles = "";
  let legend = "";

  slices.forEach(function (slice, i) {
    const percent = (slice.value / total) * 100;
    const length = Math.max(percent - gap, 0.01);
    const tip = slice.name + " · " + formatMoney(slice.value) + " · " + percent.toFixed(1) + "%";

    circles += '<circle class="slice" style="--d: ' + Math.min(i * 80, 480) + '" cx="60" cy="60" r="40" fill="none" ' +
      'stroke="' + slice.color + '" stroke-width="18" pathLength="100" ' +
      'stroke-dasharray="' + length + ' ' + (100 - length) + '" stroke-dashoffset="' + (-offset) + '" ' +
      'transform="rotate(-90 60 60)" data-tip="' + escapeAttr(tip) + '"/>';
    offset += percent;

    legend += '<div><span class="legend-name"><span class="dot" style="--cat: ' + slice.color + '"></span>' +
      escapeHTML(slice.name) + '</span><span class="legend-val">' +
      escapeHTML(formatMoney(slice.value)) + ' · ' + percent.toFixed(1) + '%</span></div>';
  });

  const centerText = formatCompact(total);
  const fontSize = Math.min(13, 56 / (centerText.length * 0.62));

  return '<div class="donut-wrap"><svg class="donut-svg" viewBox="0 0 120 120" role="img" aria-label="Spending by category">' +
    circles +
    '<text class="donut-total" x="60" y="61" text-anchor="middle" style="font-size: ' + fontSize + 'px">' +
    escapeHTML(centerText) + '</text>' +
    '<text class="donut-sub" x="60" y="71" text-anchor="middle">total</text></svg>' +
    '<div class="legend">' + legend + '</div></div>';
}


// ========== OVERVIEW CHARTS ==========

let overviewBuckets = [];

function incomeSlices(list) {
  const totals = {};
  list.forEach(function (item) { totals[item.source] = (totals[item.source] || 0) + item.amount; });
  return Object.keys(totals)
    .map(function (source) { return { name: source, color: sourceColor(source), value: totals[source] }; })
    .sort(function (x, y) { return y.value - x.value; });
}

function renderOverviewCharts() {
  // Line: the twelve months of the year being viewed
  const year = ovMonth.slice(0, 4);
  const buckets = MONTH_SHORT.map(function (label, i) {
    return { label: label, tip: label + " " + year, total: 0 };
  });
  const source = chartMode === "expense" ? expenses : incomes;
  source.forEach(function (item) {
    if (item.date.slice(0, 4) === year) buckets[Number(item.date.slice(5, 7)) - 1].total += item.amount;
  });
  overviewBuckets = buckets;
  lineChartEl.dataset.mode = chartMode;
  lineChartEl.dataset.empty = chartMode === "expense" ? "No spending in " + year + " yet." : "No income in " + year + " yet.";
  lineChartEl.dataset.w = "";

  // Donut: this month's categories (expenses) or sources (income)
  const range = monthRange(ovMonth);
  donutChartEl.dataset.mode = donutMode;
  if (donutMode === "expense") {
    donutChartEl.innerHTML = donutHTML(categorySlices(expensesBetween(range[0], range[1])), "No spending in " + monthName(ovMonth) + ".");
  } else {
    const list = incomes.filter(function (item) { return item.date >= range[0] && item.date <= range[1]; });
    donutChartEl.innerHTML = donutHTML(incomeSlices(list), "No income in " + monthName(ovMonth) + ".");
  }
}


// ========== REPORTS PAGE ==========

// Works out the dates for the chosen period (and the period before it, for comparing)
function getReportRange(period) {
  const today = getTodayString();
  const monthStart = today.slice(0, 8) + "01";
  let start;
  let end;

  if (period === "month") {
    start = monthStart; end = endOfMonth(today);
  } else if (period === "30d") {
    start = addDays(today, -29); end = today;
  } else if (period === "3m") {
    start = shiftMonths(monthStart, 2); end = endOfMonth(today);
  } else if (period === "6m") {
    start = shiftMonths(monthStart, 5); end = endOfMonth(today);
  } else if (period === "year") {
    start = today.slice(0, 4) + "-01-01"; end = today.slice(0, 4) + "-12-31";
  } else {
    start = today; end = today;
    expenses.forEach(function (expense) {
      if (expense.date < start) start = expense.date;
      if (expense.date > end) end = expense.date;
    });
  }

  const elapsedEnd = end < today ? end : today;   // days that have actually happened
  let previous = null;
  const monthsBack = { month: 1, "3m": 3, "6m": 6, year: 12 }[period];
  if (monthsBack) {
    previous = [shiftMonths(start, monthsBack), shiftMonths(elapsedEnd, monthsBack)];
  } else if (period === "30d") {
    previous = [addDays(start, -30), addDays(start, -1)];
  }

  return { start: start, end: end, elapsedEnd: elapsedEnd, previous: previous };
}

let trendBuckets = [];

function renderReports() {
  const range = getReportRange(reportPeriod);
  const list = expensesBetween(range.start, range.end);
  const total = sumOf(list);
  const days = Math.max(1, daysBetween(range.start, range.elapsedEnd) + 1);

  let biggest = null;
  list.forEach(function (expense) {
    if (biggest === null || expense.amount > biggest.amount) biggest = expense;
  });

  document.getElementById("report-range").textContent =
    formatShortDate(range.start) + ", " + range.start.slice(0, 4) + "  –  " +
    formatShortDate(range.end) + ", " + range.end.slice(0, 4);
  document.getElementById("r-total").textContent = formatMoney(total);
  document.getElementById("r-avg").textContent = formatMoney(total / days);
  document.getElementById("r-max").textContent = biggest ? formatMoney(biggest.amount) : "-";
  document.getElementById("r-max-name").textContent = biggest ? biggest.name : "";
  document.getElementById("r-count").textContent = String(list.length);

  const slices = categorySlices(list);
  document.getElementById("r-cats").textContent =
    slices.length + (slices.length === 1 ? " category used" : " categories used");

  // Compare with the period before
  const deltaEl = document.getElementById("r-delta");
  deltaEl.className = "card-sub";
  if (!range.previous) {
    deltaEl.textContent = "";
  } else {
    const before = sumOf(expensesBetween(range.previous[0], range.previous[1]));
    if (before <= 0) {
      deltaEl.textContent = "Nothing to compare with yet";
    } else {
      const change = ((total - before) / before) * 100;
      if (Math.abs(change) < 0.05) {
        deltaEl.textContent = "Same as the previous period";
      } else {
        deltaEl.textContent = (change > 0 ? "▲ " : "▼ ") +
          Math.abs(change).toFixed(Math.abs(change) >= 10 ? 0 : 1) + "% vs previous period";
        deltaEl.classList.add(change > 0 ? "delta-up" : "delta-down");
      }
    }
  }

  // Trend chart data (drawn by drawCharts) and its caption
  const built = buildBuckets(range.start, range.end, list);
  trendBuckets = built.buckets;
  document.getElementById("trend-sub").textContent = built.unit;

  // Donut
  reportDonutEl.innerHTML = donutHTML(slices);

  // Category ranking
  const rankEl = document.getElementById("rank-list");
  if (slices.length === 0) {
    rankEl.innerHTML = '<p class="chart-empty">No spending in this period yet.</p>';
  } else {
    let rows = "";
    slices.forEach(function (slice) {
      rows += `
        <div class="bar-row">
          <div class="bar-label">
            <span><span class="dot" style="--cat: ${slice.color}"></span>${escapeHTML(slice.name)}</span>
            <span>${formatMoney(slice.value)} · ${((slice.value / total) * 100).toFixed(1)}%</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill rank-fill" style="width: ${(slice.value / slices[0].value) * 100}%; background: ${slice.color}"></div>
          </div>
        </div>
      `;
    });
    rankEl.innerHTML = rows;
  }

  // Biggest expenses
  const topEl = document.getElementById("top-expenses");
  const top = list.slice().sort(function (x, y) { return y.amount - x.amount; }).slice(0, 5);
  if (top.length === 0) {
    topEl.innerHTML = '<p class="chart-empty">No spending in this period yet.</p>';
  } else {
    let rows = "";
    top.forEach(function (expense, i) {
      const category = getCategory(expense.category);
      rows += `
        <div class="top-row">
          <span class="top-rank">${i + 1}</span>
          <div class="top-info">
            <span class="top-name">${escapeHTML(expense.name)}</span>
            <span class="top-meta">
              <span class="tag" style="--cat: ${category ? category.color : "#8b8ba3"}">${category ? escapeHTML(category.name) : "Uncategorized"}</span>
              ${expense.date}
            </span>
          </div>
          <span class="top-amt">${formatMoney(expense.amount)}</span>
        </div>
      `;
    });
    topEl.innerHTML = rows;
  }

  renderBudgetReport();
}

// Budget vs actual for the current month, one row per category that has a budget
function renderBudgetReport() {
  const el = document.getElementById("budget-report");
  const month = getTodayString().slice(0, 7);
  const withBudget = categories.filter(function (category) { return budgetOf(category.id) > 0; });

  if (withBudget.length === 0) {
    el.innerHTML = '<p class="empty-note">No budgets set yet. Click the Monthly budget card in the menu to set one for each category.</p>';
    return;
  }

  let totalBudget = 0;
  let totalSpent = 0;
  let rows = "";
  withBudget.forEach(function (category) {
    const budget = budgetOf(category.id);
    const spent = sumOf(expenses.filter(function (expense) {
      return expense.category === category.id && expense.date.startsWith(month);
    }));
    const left = budget - spent;
    const percent = (spent / budget) * 100;
    const barClass = percent >= 100 ? "danger" : percent >= 75 ? "warn" : "";
    totalBudget += budget;
    totalSpent += spent;

    rows += `
      <tr>
        <td><span class="dot" style="--cat: ${category.color}"></span>${escapeHTML(category.name)}</td>
        <td>${formatMoney(budget)}</td>
        <td>${formatMoney(spent)}</td>
        <td class="${left < 0 ? "negative" : ""}">${formatMoney(left)}</td>
        <td>
          <div class="bar-track"><div class="bar-fill ${barClass} rank-fill" style="width: ${Math.min(percent, 100)}%"></div></div>${percent.toFixed(0)}%
        </td>
      </tr>
    `;
  });

  const totalLeft = totalBudget - totalSpent;
  rows += `
    <tr class="total-row">
      <td>Total</td>
      <td>${formatMoney(totalBudget)}</td>
      <td>${formatMoney(totalSpent)}</td>
      <td class="${totalLeft < 0 ? "negative" : ""}">${formatMoney(totalLeft)}</td>
      <td>${((totalSpent / totalBudget) * 100).toFixed(0)}%</td>
    </tr>
  `;

  el.innerHTML = `
    <div class="table-scroll">
      <table class="budget-table">
        <thead><tr><th>Category</th><th>Budget</th><th>Spent</th><th>Left</th><th>Used</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}


// ========== DRAWING THE SIZED CHARTS ==========
// The line and bar charts need to know their width, so they are drawn when their page
// is showing, and redrawn (without the intro animation) when the width changes.

function drawCharts(animate, onlyIfResized) {
  const jobs = [
    [lineChartEl, overviewBuckets, drawLineChart],
    [trendChartEl, trendBuckets, drawBarChart]
  ];
  jobs.forEach(function (job) {
    const el = job[0];
    const width = el.clientWidth;
    if (width === 0) return;                                   // its page is hidden
    if (onlyIfResized && Number(el.dataset.w) === width) return;
    job[2](el, job[1], animate);
  });
}

new ResizeObserver(function () {
  requestAnimationFrame(function () { drawCharts(false, true); });
}).observe(document.querySelector(".content"));

[lineChartEl, trendChartEl].forEach(function (el) {
  new ResizeObserver(function () {
    requestAnimationFrame(function () { drawCharts(false, true); });
  }).observe(el);
});


// ========== CHART TOOLTIP ==========

document.addEventListener("mouseover", function (event) {
  const target = event.target.closest ? event.target.closest("[data-tip]") : null;
  if (target === null) return;
  tipEl.textContent = target.dataset.tip;
  tipEl.classList.add("show");
});

document.addEventListener("mousemove", function (event) {
  if (!tipEl.classList.contains("show")) return;
  const width = tipEl.offsetWidth;
  const left = Math.min(event.clientX + 14, window.innerWidth - width - 8);
  const top = event.clientY > 70 ? event.clientY - tipEl.offsetHeight - 12 : event.clientY + 18;
  tipEl.style.left = Math.max(8, left) + "px";
  tipEl.style.top = top + "px";
});

document.addEventListener("mouseout", function (event) {
  const target = event.target.closest ? event.target.closest("[data-tip]") : null;
  if (target !== null) tipEl.classList.remove("show");
});


// ========== PAGES (OVERVIEW / EXPENSES / REPORTS) ==========

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

// site: true = a page of the website (Home, Resources, About, FAQ, Contact) rather than the app
const PAGES = {
  home:      { site: true, title: function () { return "Home"; }, subtitle: "" },
  resources: { site: true, title: function () { return "Resources"; }, subtitle: "" },
  about:     { site: true, title: function () { return "About"; }, subtitle: "" },
  faq:       { site: true, title: function () { return "FAQ"; }, subtitle: "" },
  contact:   { site: true, title: function () { return "Contact"; }, subtitle: "" },
  overview:  { title: function () { return greeting() + " 👋"; }, subtitle: "Here is where your money went." },
  expenses:  { title: function () { return "Expenses"; }, subtitle: "Search, filter, sort, edit and export." },
  reports:   { title: function () { return "Reports"; }, subtitle: "Where your money goes, and how it changes." }
};

let pendingScroll = null;   // an element id to glide to once the next page has appeared

const APP_VIEWS = ["overview", "expenses", "reports"];

// Overview, Expenses and Reports are ONE page of three sections; the other pages show on their own
function showView(name) {
  if (!PAGES[name]) name = defaultView();
  const isApp = APP_VIEWS.indexOf(name) !== -1;
  const wasApp = APP_VIEWS.indexOf(currentView) !== -1 && !document.body.classList.contains("site-mode");
  currentView = name;

  document.querySelectorAll(".view").forEach(function (view) {
    const show = isApp ? APP_VIEWS.indexOf(view.dataset.view) !== -1 : view.dataset.view === name;
    view.classList.toggle("hidden", !show);
  });
  document.querySelectorAll(".nav-link, .nav-plain").forEach(function (link) {
    link.classList.toggle("active", link.dataset.view === name);
  });
  document.querySelectorAll(".mobile-nav a").forEach(function (link) {
    link.classList.toggle("active", link.dataset.view === name);
  });
  document.querySelectorAll(".nav-item[data-views]").forEach(function (item) {
    item.classList.toggle("active", item.dataset.views.split(" ").indexOf(name) !== -1);
  });
  closeMegas();
  // Website pages hide the app tabs and the app's search bar
  document.body.classList.toggle("site-mode", Boolean(PAGES[name].site));

  pageTitleEl.textContent = PAGES[name].title();
  pageSubtitleEl.textContent = PAGES[name].subtitle;

  const sectionId = isApp && name !== "overview" ? "view-" + name : null;
  if (isApp && wasApp) {
    // Already on the dashboard: glide to the section
    requestAnimationFrame(function () { scrollToId(sectionId || "view-overview"); });
  } else {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }

  // Charts can only be measured once their page is showing
  requestAnimationFrame(function () {
    fitAll();
    drawCharts(true);
    prepareReveals();
    if (isApp && !wasApp && sectionId) scrollToId(sectionId, true);
    if (pendingScroll) {
      const id = pendingScroll;
      pendingScroll = null;
      scrollToId(id);
    }
  });
}

// With no address, people who already track expenses land in the app; everyone else sees the website
function defaultView() {
  return expenses.length > 0 || incomes.length > 0 ? "overview" : "home";
}

function viewFromHash() {
  return window.location.hash.replace("#", "");
}

window.addEventListener("hashchange", function () {
  showView(viewFromHash());
});


// ========== LOG IN / SIGN UP (placeholders until accounts exist) ==========

document.addEventListener("click", function (event) {
  const button = event.target.closest('[data-action="auth"]');
  if (button === null) return;
  const what = button.dataset.auth === "login" ? "Log in" : "Sign up";
  showToast(what + " is coming soon. For now, everything is saved on this device.");
});


// ========== FAQ ACCORDION ==========

document.querySelectorAll(".faq-q").forEach(function (question) {
  question.addEventListener("click", function () {
    const item = question.closest(".faq-item");
    const open = item.classList.toggle("open");
    question.setAttribute("aria-expanded", String(open));
  });
});


// ========== CONTACT FORM ==========
// There is no server yet, so "Send message" opens the person's own email app, already filled in.

function buildMailto(name, email, topic, message) {
  const subject = "[ATENOM] " + topic + " from " + name;
  const body = message + "\n\n---\nFrom: " + name + " <" + email + ">";
  return "mailto:" + CONTACT_EMAIL +
    "?subject=" + encodeURIComponent(subject) +
    "&body=" + encodeURIComponent(body);
}

document.querySelectorAll("[data-contact-email]").forEach(function (link) {
  link.textContent = CONTACT_EMAIL;
  link.href = "mailto:" + CONTACT_EMAIL;
});

document.getElementById("contact-send").addEventListener("click", function () {
  const name = document.getElementById("contact-name").value.trim();
  const email = document.getElementById("contact-from").value.trim();
  const topic = document.getElementById("contact-topic").value;
  const message = document.getElementById("contact-message").value.trim();

  if (name === "") { showToast("Please enter your name."); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast("Please enter a valid email address."); return; }
  if (message === "") { showToast("Please write a message."); return; }

  showToast("Opening your email app…");
  window.location.href = buildMailto(name, email, topic, message);
});

document.querySelectorAll("[data-year]").forEach(function (el) {
  el.textContent = String(new Date().getFullYear());
});


// ========== TOAST (small message bar) ==========

let toastTimer = null;

function hideToast() {
  toastEl.classList.remove("show");
}

function showToast(message, actionLabel, action) {
  toastEl.replaceChildren();
  const text = document.createElement("span");
  text.textContent = message;
  toastEl.append(text);

  if (actionLabel) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = actionLabel;
    button.addEventListener("click", function () {
      action();
      hideToast();
    });
    toastEl.append(button);
  }

  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 6000);
}


// ========== EXPORT TO CSV ==========

// Wraps a value for CSV. A leading = + - @ is neutralised so spreadsheets never run it as a formula.
function csvCell(value) {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function exportCSV() {
  const list = getVisibleExpenses();
  if (list.length === 0) {
    showToast("There are no expenses to export yet.");
    return;
  }

  const lines = ["Date,Name,Category,Amount,Currency"];
  list.forEach(function (expense) {
    const category = getCategory(expense.category);
    lines.push([
      csvCell(expense.date),
      csvCell(expense.name),
      csvCell(category ? category.name : ""),
      expense.amount,
      currencyCode
    ].join(","));
  });

  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "atenom-expenses-" + getTodayString() + ".csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

  showToast("Exported " + list.length + (list.length === 1 ? " expense" : " expenses") + " to CSV");
}

exportBtn.addEventListener("click", exportCSV);


// ========== SEARCH ==========

searchInput.addEventListener("input", function () {
  searchText = searchInput.value.trim().toLowerCase();
  // Searching jumps down to the Expenses section (once, when you start typing)
  if (searchText !== "" && !searchInput.dataset.jumped) {
    searchInput.dataset.jumped = "1";
    scrollToId("view-expenses");
  }
  if (searchText === "") delete searchInput.dataset.jumped;
  renderExpensesPage();
});


// ========== CATEGORY FILTER BUTTONS ==========
// The buttons are rebuilt by renderFilters(), so one listener on the row handles all of them.

filtersEl.addEventListener("click", function (event) {
  const button = event.target.closest(".filter-btn[data-category]");
  if (button === null) return;

  activeCategory = button.dataset.category;
  renderFilters();
  renderExpensesPage();
});

expPeriodSelect.addEventListener("change", function () {
  expPeriod = expPeriodSelect.value;
  renderExpensesPage();
});

expSortSelect.addEventListener("change", function () {
  expSort = expSortSelect.value;
  renderExpensesPage();
});

reportPeriodSelect.addEventListener("change", function () {
  reportPeriod = REPORT_PERIODS.includes(reportPeriodSelect.value) ? reportPeriodSelect.value : "month";
  storeSet("reportPeriod", reportPeriod);
  renderReports();
  drawCharts(true);
});

// Any button marked data-action="manage-categories" opens the category editor
document.addEventListener("click", function (event) {
  if (event.target.closest('[data-action="manage-categories"]')) {
    openCategoryModal();
  }
});


// ========== POPUP: ADD AN EXPENSE ==========

// Fills the category dropdown from the person's own categories
function fillCategorySelect(selectedId) {
  categoryInput.innerHTML = "";
  categories.forEach(function (category) {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    categoryInput.appendChild(option);
  });
  if (selectedId && getCategory(selectedId)) {
    categoryInput.value = selectedId;
  }
}

function isOpen(popup) {
  return !popup.classList.contains("hidden");
}

// Opens the popup to add an expense, or to edit one when an expense is passed in
function openModal(expense) {
  // An expense needs a category, so make the first one right now
  if (!expense && categories.length === 0) {
    openCategoryModal({
      message: "Create your first category (like Groceries, Rent or Data), then add your expense.",
      then: function () { openModal(); }
    });
    return;
  }

  editingId = expense ? expense.id : null;
  modalTitleEl.textContent = expense ? "Edit expense" : "Add an expense";
  addBtn.textContent = expense ? "Save changes" : "Save expense";

  if (expense) {
    nameInput.value = expense.name;
    amountInput.value = expense.amount;
    fillCategorySelect(expense.category);
    dateInput.value = expense.date;
  } else {
    nameInput.value = "";
    amountInput.value = "";
    fillCategorySelect(activeCategory !== "All" ? activeCategory : categories[0].id);
    dateInput.value = getTodayString();
  }

  modal.classList.remove("hidden");
  nameInput.focus();
}

function closeModal() {
  modal.classList.add("hidden");
  editingId = null;
}

openModalBtn.addEventListener("click", function () { openModal(); });
cancelBtn.addEventListener("click", closeModal);
editCategoriesBtn.addEventListener("click", function () {
  openCategoryModal();
});

modal.addEventListener("click", function (event) {
  if (event.target === modal) {
    closeModal();
  }
});


// ========== POPUP: YOUR CATEGORIES ==========

const DEFAULT_CATEGORY_HELP =
  "Create the categories you spend on. Rename, recolor or delete them any time.";

let draftCategories = [];      // a working copy, only applied when you press Save
let afterCategorySave = null;  // something to do after saving (like opening Add expense)

// Builds one editable row: color, name, delete
function buildCategoryRow(draft, isNew) {
  const row = document.createElement("div");
  row.className = "cat-row" + (isNew ? " new" : "");
  row.dataset.id = draft.id;

  const color = document.createElement("input");
  color.type = "color";
  color.value = draft.color;
  color.setAttribute("aria-label", "Category color");

  const name = document.createElement("input");
  name.type = "text";
  name.value = draft.name;
  name.maxLength = MAX_NAME_LENGTH;
  name.placeholder = "e.g. Groceries";
  name.setAttribute("aria-label", "Category name");

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "delete-btn cat-del";
  remove.textContent = "✕";
  remove.setAttribute("aria-label", "Delete category");

  row.append(color, name, remove);
  return row;
}

function renderCategoryRows(newId) {
  categoryRowsEl.replaceChildren();
  draftCategories.forEach(function (draft) {
    categoryRowsEl.appendChild(buildCategoryRow(draft, draft.id === newId));
  });

  if (newId) {
    const input = categoryRowsEl.querySelector('[data-id="' + newId + '"] input[type="text"]');
    categoryRowsEl.scrollTop = categoryRowsEl.scrollHeight;
    if (input) input.focus();
  }
}

function openCategoryModal(options) {
  options = options || {};
  draftCategories = categories.map(function (category) {
    return { id: category.id, name: category.name, color: category.color, isNew: false };
  });
  afterCategorySave = options.then || null;
  categoryHelpEl.textContent = options.message || DEFAULT_CATEGORY_HELP;

  // First time: start with one empty row, ready to type in
  let focusId = null;
  if (draftCategories.length === 0) {
    focusId = makeCategoryId();
    draftCategories.push({ id: focusId, name: "", color: pickColor([]), isNew: true });
  }

  renderCategoryRows(focusId);
  categoryModal.classList.remove("hidden");
  if (!focusId) {
    const first = categoryRowsEl.querySelector('input[type="text"]');
    if (first) first.focus();
  }
}

function closeCategoryModal() {
  categoryModal.classList.add("hidden");
  afterCategorySave = null;
}

addCategoryRowBtn.addEventListener("click", function () {
  if (draftCategories.length >= MAX_CATEGORIES) {
    alert("You can have up to " + MAX_CATEGORIES + " categories.");
    return;
  }
  const draft = {
    id: makeCategoryId(),
    name: "",
    color: pickColor(draftCategories),
    isNew: true
  };
  draftCategories.push(draft);
  renderCategoryRows(draft.id);
});

// Typing a name or picking a color updates the working copy
categoryRowsEl.addEventListener("input", function (event) {
  const row = event.target.closest(".cat-row");
  if (row === null) return;
  const draft = draftCategories.find(function (item) { return item.id === row.dataset.id; });
  if (!draft) return;

  if (event.target.type === "color") {
    draft.color = event.target.value;
  } else {
    draft.name = event.target.value;
  }
});

// Delete button on a row
categoryRowsEl.addEventListener("click", function (event) {
  const button = event.target.closest(".cat-del");
  if (button === null) return;

  const row = button.closest(".cat-row");
  const id = row.dataset.id;
  const draft = draftCategories.find(function (item) { return item.id === id; });

  // Warn if expenses use this category (they are removed when you press Save)
  const used = expenses.filter(function (expense) { return expense.category === id; }).length;
  if (used > 0) {
    const label = draft && draft.name ? '"' + draft.name + '"' : "This category";
    const ok = confirm(
      label + " has " + used + (used === 1 ? " expense" : " expenses") +
      ". They will be removed too when you press Save. Continue?"
    );
    if (!ok) return;
  }

  draftCategories = draftCategories.filter(function (item) { return item.id !== id; });
  row.classList.add("removing");
  setTimeout(function () { row.remove(); }, 280);
});

saveCategoryBtn.addEventListener("click", function () {
  const cleaned = [];
  const seen = new Set();
  let newestId = null;

  for (const draft of draftCategories) {
    const name = draft.name.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);

    if (name === "") {
      if (draft.isNew) continue;   // an empty new row is just ignored
      alert("A category name can't be empty.");
      return;
    }

    const key = name.toLowerCase();
    if (seen.has(key)) {
      alert('You have two categories called "' + name + '". Give each its own name.');
      return;
    }
    seen.add(key);

    cleaned.push({ id: draft.id, name: name, color: draft.color });
    if (draft.isNew) newestId = draft.id;
  }

  // Anything attached to a deleted category goes with it
  const keepIds = new Set(cleaned.map(function (category) { return category.id; }));
  expenses = expenses.filter(function (expense) { return keepIds.has(expense.category); });
  Object.keys(budgets).forEach(function (id) {
    if (!keepIds.has(id)) delete budgets[id];
  });

  categories = cleaned;
  if (activeCategory !== "All" && !keepIds.has(activeCategory)) {
    activeCategory = "All";
  }

  saveCategories();
  saveBudgets();
  saveExpenses();

  const callback = afterCategorySave;
  const addPopupWasOpen = isOpen(modal);
  const selectedBefore = categoryInput.value;
  closeCategoryModal();
  render();

  // If "Add expense" is open behind this popup, refresh its dropdown
  // (and pick the category that was just created)
  if (addPopupWasOpen) {
    fillCategorySelect(newestId || selectedBefore);
  }

  if (callback && categories.length > 0) {
    callback();
  }
});

cancelCategoryBtn.addEventListener("click", closeCategoryModal);


// ========== POPUP: EDIT BUDGETS ==========

function openBudgetModal() {
  // Budgets belong to categories, so make some first
  if (categories.length === 0) {
    openCategoryModal({
      message: "Create a category first, then you can set a monthly budget for it.",
      then: openBudgetModal
    });
    return;
  }

  // One box per category, filled with the current budget (blank if it is 0)
  budgetFieldsEl.innerHTML = "";
  categories.forEach(function (category) {
    const label = document.createElement("label");
    label.htmlFor = "budget-" + category.id;
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.setProperty("--cat", category.color);
    label.append(dot, category.name);

    const input = document.createElement("input");
    input.type = "number";
    input.id = "budget-" + category.id;
    input.dataset.id = category.id;
    input.min = "0";
    input.max = String(MAX_AMOUNT);
    input.placeholder = "0";
    input.value = budgetOf(category.id) > 0 ? budgetOf(category.id) : "";

    const field = document.createElement("div");
    field.className = "budget-field";
    field.append(label, input);
    budgetFieldsEl.append(field);
  });

  budgetModal.classList.remove("hidden");
  const first = budgetFieldsEl.querySelector("input");
  if (first) first.focus();
}

function closeBudgetModal() {
  budgetModal.classList.add("hidden");
}

// Open by clicking the card, or by pressing Enter / Space when it is focused
budgetCard.addEventListener("click", openBudgetModal);
budgetCard.addEventListener("keydown", function (event) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openBudgetModal();
  }
});

cancelBudgetBtn.addEventListener("click", closeBudgetModal);

budgetModal.addEventListener("click", function (event) {
  if (event.target === budgetModal) {
    closeBudgetModal();
  }
});

saveBudgetBtn.addEventListener("click", function () {
  const newBudgets = {};
  let allValid = true;

  budgetFieldsEl.querySelectorAll("input").forEach(function (input) {
    const value = input.value === "" ? 0 : Number(input.value);

    if (isNaN(value) || value < 0 || value > MAX_AMOUNT) {
      allValid = false;
    }
    newBudgets[input.dataset.id] = value;
  });

  if (!allValid) {
    alert("Each budget must be between 0 and 1,000,000,000,000.");
    return;
  }

  budgets = newBudgets;
  saveBudgets();
  renderBudget();
  closeBudgetModal();
});


// ========== ESCAPE KEY CLOSES POPUPS ==========

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    // The categories popup can sit on top of another popup: close just that one first
    if (isOpen(categoryModal)) {
      closeCategoryModal();
      return;
    }
    closeModal();
    closeBudgetModal();
  }
});


// ========== SAVE (OR EDIT) AN EXPENSE ==========

addBtn.addEventListener("click", function () {
  // 1. Read the form
  const name = nameInput.value.trim();
  const amount = Number(amountInput.value);
  const category = categoryInput.value;
  const date = dateInput.value || getTodayString();

  // 2. Check it
  if (name === "") {
    alert("Please enter a name.");
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    alert("The amount must be greater than 0.");
    return;
  }
  if (amount > MAX_AMOUNT) {
    alert("The amount can't be more than 1,000,000,000,000.");
    return;
  }
  if (!getCategory(category)) {
    alert("Please choose a category.");
    return;
  }

  // 3. Update the expense being edited, or add a new one to the top of the list
  if (editingId !== null) {
    const target = expenses.find(function (expense) { return expense.id === editingId; });
    if (target) {
      target.name = name;
      target.amount = amount;
      target.category = category;
      target.date = date;
    }
  } else {
    expenses.unshift({
      id: nextId,
      name: name,
      amount: amount,
      category: category,
      date: date
    });
    nextId = nextId + 1;
  }

  // 4. Save, redraw the page and close the popup
  saveExpenses();
  render();
  closeModal();
});


// ========== EDIT OR DELETE AN EXPENSE (both tables) ==========

function handleExpenseAction(event) {
  const editButton = event.target.closest(".edit-btn");
  if (editButton !== null) {
    const id = Number(editButton.dataset.id);
    const expense = expenses.find(function (item) { return item.id === id; });
    if (expense) openModal(expense);
    return;
  }

  const deleteButton = event.target.closest(".delete-btn");
  if (deleteButton === null) {
    return;   // the click was not on a button
  }

  const id = Number(deleteButton.dataset.id);
  const index = expenses.findIndex(function (item) { return item.id === id; });
  if (index === -1) return;

  const removed = expenses.splice(index, 1)[0];
  saveExpenses();
  render();

  // Deleting is never final: the toast offers an Undo
  const shortName = removed.name.length > 28 ? removed.name.slice(0, 28) + "…" : removed.name;
  showToast('Deleted "' + shortName + '"', "Undo", function () {
    expenses.splice(Math.min(index, expenses.length), 0, removed);
    saveExpenses();
    render();
  });
}

tableBody.addEventListener("click", handleExpenseAction);
document.getElementById("exp-groups").addEventListener("click", handleExpenseAction);


// ========== INCOME ==========

const SOURCE_COLORS = ["#4f9dff", "#3ddc97", "#ffc857", "#b07cff", "#ff8c42", "#ff5c8a", "#5fd4e8", "#c3d95b"];

// The same source name always gets the same color
function sourceColor(source) {
  let hash = 0;
  for (let i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  return SOURCE_COLORS[hash % SOURCE_COLORS.length];
}

function saveIncomes() {
  storeSet("incomes", JSON.stringify(incomes));
}

function loadIncomes() {
  try {
    const saved = JSON.parse(storeGet("incomes"));
    if (Array.isArray(saved)) {
      incomes = saved.filter(function (item) {
        return item &&
          typeof item.id === "number" &&
          typeof item.name === "string" &&
          typeof item.source === "string" &&
          typeof item.amount === "number" && item.amount > 0 && item.amount <= MAX_AMOUNT &&
          typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date);
      });
      nextIncomeId = incomes.reduce(function (max, item) { return Math.max(max, item.id); }, 0) + 1;
    }
  } catch (error) {
    console.log("Could not read saved income:", error);
  }
}

// Builds the "grouped by month" lists for expenses and income (built with the DOM, so names are never run as HTML)
function groupedList(container, list, makeRow, emptyText) {
  container.textContent = "";
  if (list.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }
  const sorted = list.slice().sort(function (x, y) { return x.date < y.date ? 1 : x.date > y.date ? -1 : y.id - x.id; });
  const months = {};
  const order = [];
  sorted.forEach(function (item) {
    const key = item.date.slice(0, 7);
    if (!months[key]) { months[key] = []; order.push(key); }
    months[key].push(item);
  });
  order.forEach(function (key) {
    const head = document.createElement("div");
    head.className = "g-head";
    const title = document.createElement("span");
    title.textContent = MONTH_SHORT[Number(key.slice(5, 7)) - 1] + " " + key.slice(0, 4);
    const total = document.createElement("span");
    total.className = "g-total";
    total.textContent = formatMoney(sumOf(months[key]));
    head.append(title, total);
    container.appendChild(head);
    months[key].forEach(function (item) { container.appendChild(makeRow(item)); });
  });
}

function groupRow(item, tagText, tagColor, editClass, deleteClass, label) {
  const row = document.createElement("div");
  row.className = "g-row";

  const name = document.createElement("span");
  name.className = "g-name";
  name.textContent = item.name;

  const tag = document.createElement("span");
  tag.className = "tag";
  tag.style.setProperty("--cat", tagColor);
  tag.textContent = tagText;

  const amount = document.createElement("span");
  amount.className = "g-amt";
  amount.textContent = formatMoney(item.amount);

  const date = document.createElement("span");
  date.className = "g-date";
  date.textContent = formatShortDate(item.date);

  const actions = document.createElement("span");
  actions.className = "g-actions";
  const edit = document.createElement("button");
  edit.className = editClass;
  edit.dataset.id = String(item.id);
  edit.setAttribute("aria-label", "Edit " + label);
  edit.textContent = "✎";
  const del = document.createElement("button");
  del.className = deleteClass;
  del.dataset.id = String(item.id);
  del.setAttribute("aria-label", "Delete " + label);
  del.textContent = "✕";
  actions.append(edit, del);

  row.append(name, tag, amount, date, actions);
  return row;
}

function renderGroups() {
  groupedList(document.getElementById("exp-groups"), expenses, function (expense) {
    const category = getCategory(expense.category);
    return groupRow(expense, category ? category.name : "Uncategorized", category ? category.color : "#8b8ba3",
      "edit-btn", "delete-btn", "expense");
  }, noExpensesMessage());

  groupedList(document.getElementById("inc-groups"), incomes, function (item) {
    return groupRow(item, item.source, sourceColor(item.source), "inc-edit", "inc-del", "income");
  }, "No income yet. Click + Add to record your salary or other money in.");

  const list = document.getElementById("inc-sources");
  list.textContent = "";
  Array.from(new Set(incomes.map(function (item) { return item.source; }))).forEach(function (source) {
    const option = document.createElement("option");
    option.value = source;
    list.appendChild(option);
  });
}

// ----- Monthly stats: one card per month, with year arrows and quarter tabs -----
let msYear = Number(getTodayString().slice(0, 4));
let msQuarter = "all";

function renderMonthlyStats() {
  const grid = document.getElementById("ms-grid");
  document.getElementById("ms-year").textContent = String(msYear);
  grid.textContent = "";

  const first = msQuarter === "all" ? 0 : (Number(msQuarter) - 1) * 3;
  const last = msQuarter === "all" ? 11 : first + 2;

  for (let m = first; m <= last; m++) {
    const key = msYear + "-" + String(m + 1).padStart(2, "0");
    const range = monthRange(key);
    const spent = sumOf(expensesBetween(range[0], range[1]));
    const earned = incomes
      .filter(function (item) { return item.date >= range[0] && item.date <= range[1]; })
      .reduce(function (sum, item) { return sum + item.amount; }, 0);
    const flow = earned - spent;

    let percent = 0;
    let label = "0%";
    let cls = "";
    if (earned > 0) {
      percent = Math.min(100, (spent / earned) * 100);
      label = Math.round((spent / earned) * 100) + "%";
      cls = percent >= 100 ? "danger" : percent >= 75 ? "warn" : "";
    } else if (spent > 0) {
      percent = 100;
      label = "No income";
      cls = "danger";
    }

    const card = document.createElement("button");
    card.type = "button";
    card.className = "mstat" + (key === ovMonth ? " current" : "");
    card.dataset.month = key;
    card.innerHTML =
      '<span class="mstat-title">' + MONTH_LONG[m] + ' ' + msYear + '</span>' +
      '<span class="mstat-line inc">Income: ' + escapeHTML(formatMoney(earned)) + '</span>' +
      '<span class="mstat-line exp">Expense: ' + escapeHTML(formatMoney(spent)) + '</span>' +
      '<span class="mstat-line flow' + (flow < 0 ? ' negative' : '') + '">Cashflow: ' + escapeHTML(formatMoney(flow)) + '</span>' +
      '<span class="mstat-bar"><span class="mstat-pct">' + label + '</span><span class="bar-track"><span class="bar-fill ' + cls + '" style="width: ' + percent + '%"></span></span></span>';
    grid.appendChild(card);
  }
}

document.getElementById("ms-grid").addEventListener("click", function (event) {
  const card = event.target.closest(".mstat");
  if (card === null) return;
  setOverviewMonth(card.dataset.month);
  window.scrollTo({ top: 0, behavior: reduceMotion.matches ? "instant" : "smooth" });
});

document.getElementById("ms-tabs").addEventListener("click", function (event) {
  const tab = event.target.closest(".seg-btn");
  if (tab === null) return;
  msQuarter = tab.dataset.q;
  document.querySelectorAll("#ms-tabs .seg-btn").forEach(function (b) { b.classList.toggle("active", b === tab); });
  renderMonthlyStats();
});

document.getElementById("ms-prev").addEventListener("click", function () { msYear--; renderMonthlyStats(); });
document.getElementById("ms-next").addEventListener("click", function () { msYear++; renderMonthlyStats(); });

// ----- Month picker, chart toggles, quick actions -----
const ovMonthInput = document.getElementById("ov-month");
ovMonthInput.value = ovMonth;

function setOverviewMonth(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) return;
  ovMonth = month;
  ovMonthInput.value = month;
  msYear = Number(month.slice(0, 4));
  render();
}

ovMonthInput.addEventListener("change", function () { setOverviewMonth(ovMonthInput.value); });

document.querySelectorAll(".seg[data-seg]").forEach(function (seg) {
  seg.addEventListener("click", function (event) {
    const button = event.target.closest(".seg-btn");
    if (button === null) return;
    seg.querySelectorAll(".seg-btn").forEach(function (b) { b.classList.toggle("active", b === button); });
    if (seg.dataset.seg === "chart") chartMode = button.dataset.mode; else donutMode = button.dataset.mode;
    renderOverviewCharts();
    drawCharts(true);
  });
});

document.getElementById("qa-expense").addEventListener("click", function () { openModal(); });
document.getElementById("qa-income").addEventListener("click", function () { openIncomeModal(); });
document.getElementById("inc-add-btn").addEventListener("click", function () { openIncomeModal(); });

document.addEventListener("click", function (event) {
  if (event.target.closest('[data-action="edit-budgets"]')) openBudgetModal();
});

// ----- The income popup -----
const incomeModal = document.getElementById("income-modal");
const incNameInput = document.getElementById("inc-name");
const incAmountInput = document.getElementById("inc-amount");
const incSourceInput = document.getElementById("inc-source");
const incDateInput = document.getElementById("inc-date");
let editingIncomeId = null;

function openIncomeModal(item) {
  editingIncomeId = item ? item.id : null;
  document.getElementById("income-modal-title").textContent = item ? "Edit income" : "Add income";
  document.getElementById("inc-save").textContent = item ? "Save changes" : "Save income";
  incNameInput.value = item ? item.name : "";
  incAmountInput.value = item ? item.amount : "";
  incSourceInput.value = item ? item.source : "";
  incDateInput.value = item ? item.date : getTodayString();
  incomeModal.classList.remove("hidden");
  incNameInput.focus();
}

function closeIncomeModal() {
  incomeModal.classList.add("hidden");
  editingIncomeId = null;
}

document.getElementById("inc-cancel").addEventListener("click", closeIncomeModal);
incomeModal.addEventListener("click", function (event) { if (event.target === incomeModal) closeIncomeModal(); });
document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeIncomeModal(); });

document.getElementById("inc-save").addEventListener("click", function () {
  const name = incNameInput.value.trim();
  const amount = Number(incAmountInput.value);
  const source = incSourceInput.value.trim() || "Income";
  const date = incDateInput.value || getTodayString();

  if (name === "") { alert("Please enter a name."); return; }
  if (isNaN(amount) || amount <= 0) { alert("The amount must be greater than 0."); return; }
  if (amount > MAX_AMOUNT) { alert("The amount can't be more than 1,000,000,000,000."); return; }

  if (editingIncomeId !== null) {
    const target = incomes.find(function (item) { return item.id === editingIncomeId; });
    if (target) { target.name = name; target.amount = amount; target.source = source; target.date = date; }
  } else {
    incomes.unshift({ id: nextIncomeId, name: name, amount: amount, source: source, date: date });
    nextIncomeId++;
  }
  saveIncomes();
  closeIncomeModal();
  render();
  showToast("Income saved.");
});

document.getElementById("inc-groups").addEventListener("click", function (event) {
  const edit = event.target.closest(".inc-edit");
  if (edit !== null) {
    const item = incomes.find(function (entry) { return entry.id === Number(edit.dataset.id); });
    if (item) openIncomeModal(item);
    return;
  }
  const del = event.target.closest(".inc-del");
  if (del === null) return;
  const index = incomes.findIndex(function (entry) { return entry.id === Number(del.dataset.id); });
  if (index === -1) return;
  const removed = incomes.splice(index, 1)[0];
  saveIncomes();
  render();
  const shortName = removed.name.length > 28 ? removed.name.slice(0, 28) + "…" : removed.name;
  showToast('Deleted "' + shortName + '"', "Undo", function () {
    incomes.splice(Math.min(index, incomes.length), 0, removed);
    saveIncomes();
    render();
  });
});


// ========== START ==========

loadCategories();   // the person's own categories first
loadExpenses();     // then their expenses (only ones that still have a category)
loadIncomes();      // and the money that came in
loadBudgets();      // then their budgets

const savedPeriod = storeGet("reportPeriod");
if (REPORT_PERIODS.includes(savedPeriod)) reportPeriod = savedPeriod;
reportPeriodSelect.value = reportPeriod;

render();
// ========== WEBSITE: MEGA MENUS, SCROLL LINKS, MOTION ==========

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const siteHeader = document.getElementById("site-header");

function scrollToId(id, instant) {
  const el = document.getElementById(id);
  if (el === null) return;
  const tabs = document.querySelector(".app-tabs");
  const tabsHeight = tabs && tabs.offsetHeight ? tabs.offsetHeight + 20 : 0;
  const top = id === "view-overview"
    ? 0
    : el.getBoundingClientRect().top + window.scrollY - siteHeader.offsetHeight - tabsHeight - 8;
  window.scrollTo({ top: Math.max(0, top), behavior: instant || reduceMotion.matches ? "instant" : "smooth" });
}

// Links such as "Custom categories" go to a page AND glide to a spot on it
document.addEventListener("click", function (event) {
  const link = event.target.closest("[data-scroll]");
  if (link === null) return;
  event.preventDefault();
  const target = (link.getAttribute("href") || "").replace("#", "");
  closeMegas();
  if (!target || target === currentView) {
    scrollToId(link.dataset.scroll);
  } else {
    pendingScroll = link.dataset.scroll;
    window.location.hash = target;
  }
});

// ----- Mega menus: hover (with a short delay), click, Escape, click outside -----
const megaItems = Array.from(document.querySelectorAll(".nav-item[data-menu]"));
let megaTimer = null;

function closeMegas(except) {
  megaItems.forEach(function (item) {
    if (item === except) return;
    item.classList.remove("open");
    item.querySelector(".nav-trigger").setAttribute("aria-expanded", "false");
  });
}

function openMega(item) {
  clearTimeout(megaTimer);
  closeMegas(item);
  const menu = item.querySelector(".mega");
  // Keep the panel inside the window
  menu.style.setProperty("--shift", "0px");
  const rect = menu.getBoundingClientRect();
  const overflow = rect.right - (window.innerWidth - 16);
  if (overflow > 0) menu.style.setProperty("--shift", -overflow + "px");
  item.classList.add("open");
  item.querySelector(".nav-trigger").setAttribute("aria-expanded", "true");
}

megaItems.forEach(function (item) {
  const trigger = item.querySelector(".nav-trigger");
  item.addEventListener("pointerenter", function (e) {
    if (e.pointerType === "touch") return;
    clearTimeout(megaTimer);
    megaTimer = setTimeout(function () { openMega(item); }, 120);
  });
  item.addEventListener("pointerleave", function (e) {
    if (e.pointerType === "touch") return;
    clearTimeout(megaTimer);
    megaTimer = setTimeout(function () { closeMegas(); }, 180);
  });
  trigger.addEventListener("click", function () {
    if (item.classList.contains("open")) closeMegas(); else openMega(item);
  });
  item.addEventListener("focusout", function (e) {
    if (!item.contains(e.relatedTarget)) closeMegas();
  });
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeMegas();
});
document.addEventListener("click", function (e) {
  if (!e.target.closest(".nav-item")) closeMegas();
  // Any link inside a menu closes it
  if (e.target.closest(".mega a")) closeMegas();
});

// ----- Dashboard tabs light up for the section you are reading -----
let spyTicking = false;
function updateSectionTabs() {
  spyTicking = false;
  if (document.body.classList.contains("site-mode")) return;
  const tabs = document.querySelector(".app-tabs");
  const line = siteHeader.offsetHeight + (tabs ? tabs.offsetHeight : 0) + 80;
  let active = "overview";
  APP_VIEWS.forEach(function (name) {
    const section = document.getElementById("view-" + name);
    if (section && section.getBoundingClientRect().top <= line) active = name;
  });
  document.querySelectorAll(".app-tabs .nav-link").forEach(function (link) {
    link.classList.toggle("active", link.dataset.view === active);
  });
}
window.addEventListener("scroll", function () {
  if (spyTicking) return;
  spyTicking = true;
  requestAnimationFrame(updateSectionTabs);
}, { passive: true });

// ----- Header gets a soft shadow once the page has scrolled -----
let headerTicking = false;
window.addEventListener("scroll", function () {
  if (headerTicking) return;
  headerTicking = true;
  requestAnimationFrame(function () {
    siteHeader.classList.toggle("scrolled", window.scrollY > 8);
    headerTicking = false;
  });
}, { passive: true });

// ----- Scrolling marquee: two rows of example categories -----
function buildMarquee(id, items) {
  const row = document.getElementById(id);
  if (row === null) return;
  const track = document.createElement("div");
  track.className = "marquee-track";
  // The list is written twice, and the track slides exactly half its width, so the loop never jumps
  for (let copy = 0; copy < 2; copy++) {
    items.forEach(function (item) {
      const chip = document.createElement("span");
      chip.className = "m-chip";
      chip.textContent = item;
      track.appendChild(chip);
    });
  }
  row.appendChild(track);
}

buildMarquee("marquee-a", ["🛒 Groceries", "⛽ Fuel", "📱 Data & airtime", "🏠 Rent", "💡 Electricity", "🎓 School fees",
  "⛪ Church giving", "🚕 Transport", "💊 Pharmacy", "🍽️ Eating out", "🎬 Movies", "👕 Clothing"]);
buildMarquee("marquee-b", ["💇 Hair & grooming", "🐕 Pet food", "🎁 Gifts", "🔧 Repairs", "📚 Books", "🏋️ Gym",
  "✈️ Travel", "💧 Water", "🧾 Subscriptions", "👶 Childcare", "🪴 Garden", "☕ Coffee"]);

// ----- Scroll reveal, count-up numbers, and "only animate what is on screen" -----
const revealObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("in");
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

const liveObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    entry.target.classList.toggle("is-live", entry.isIntersecting);
  });
}, { rootMargin: "80px 0px" });

document.querySelectorAll("[data-live]").forEach(function (el) { liveObserver.observe(el); });

function runCount(el) {
  const to = Number(el.dataset.to);
  if (reduceMotion.matches) { el.textContent = String(to); return; }
  const start = performance.now();
  const duration = 1600;
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    el.textContent = String(Math.round(to * (1 - Math.pow(1 - t, 4))));
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

const countObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (!entry.isIntersecting) return;
    runCount(entry.target);
    countObserver.unobserve(entry.target);
  });
}, { threshold: 0.6 });

// Each time a page opens, its reveals play again
function prepareReveals() {
  const view = document.querySelector(".view:not(.hidden)");
  if (view === null) return;
  view.querySelectorAll(".reveal, .steps-row").forEach(function (el) {
    el.classList.remove("in");
    revealObserver.observe(el);
  });
  view.querySelectorAll(".count").forEach(function (el) {
    el.textContent = "0";
    countObserver.observe(el);
  });
}

// ----- Pointer effects: card spotlight, hero tilt, background parallax -----
document.addEventListener("pointermove", function (e) {
  const card = e.target.closest && e.target.closest(".spot");
  if (card === null || card === undefined) return;
  const r = card.getBoundingClientRect();
  card.style.setProperty("--mx", (e.clientX - r.left) + "px");
  card.style.setProperty("--my", (e.clientY - r.top) + "px");
}, { passive: true });

(function setupTilt() {
  const wrap = document.querySelector("[data-tilt]");
  if (wrap === null) return;
  const mock = wrap.querySelector(".mock");
  let raf = 0;
  wrap.addEventListener("pointermove", function (e) {
    if (reduceMotion.matches || e.pointerType === "touch") return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () {
      const r = wrap.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      mock.style.setProperty("--ry", (x * 10).toFixed(2) + "deg");
      mock.style.setProperty("--rx", (-y * 8).toFixed(2) + "deg");
    });
  });
  wrap.addEventListener("pointerleave", function () {
    cancelAnimationFrame(raf);
    mock.style.setProperty("--rx", "0deg");
    mock.style.setProperty("--ry", "0deg");
  });
})();

(function setupParallax() {
  const layers = Array.from(document.querySelectorAll(".orb-p[data-depth]"));
  let ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking || reduceMotion.matches || currentView !== "home") return;
    ticking = true;
    requestAnimationFrame(function () {
      const y = Math.min(window.scrollY, 1000);
      layers.forEach(function (layer) {
        layer.style.transform = "translate3d(0," + (y * Number(layer.dataset.depth)).toFixed(1) + "px,0)";
      });
      ticking = false;
    });
  }, { passive: true });
})();

// ----- Resources: search and guide accordions -----
const guideCards = Array.from(document.querySelectorAll("#guide-grid .guide"));
const guideSearch = document.getElementById("res-search");
const guideEmpty = document.getElementById("guide-empty");

function filterGuides(query) {
  const q = query.trim().toLowerCase();
  let shown = 0;
  guideCards.forEach(function (card) {
    const hay = ((card.dataset.text || "") + " " + card.textContent).toLowerCase();
    const match = q === "" || hay.indexOf(q) !== -1;
    card.classList.toggle("is-hidden", !match);
    if (match) shown++;
  });
  guideEmpty.hidden = shown !== 0;
}

guideSearch.addEventListener("input", function () { filterGuides(guideSearch.value); });
guideSearch.addEventListener("keydown", function (e) {
  if (e.key === "Enter") { filterGuides(guideSearch.value); scrollToId("guides"); }
});

document.querySelectorAll(".hint-chip[data-q]").forEach(function (chip) {
  chip.addEventListener("click", function () {
    guideSearch.value = chip.dataset.q;
    filterGuides(chip.dataset.q);
    scrollToId("guides");
  });
});

guideCards.forEach(function (card) {
  const q = card.querySelector(".guide-q");
  q.addEventListener("click", function () {
    const open = card.classList.toggle("open");
    q.setAttribute("aria-expanded", String(open));
  });
});


showView(viewFromHash());
