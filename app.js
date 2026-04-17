const STORAGE_KEY = "budgetflow-transactions";

const transactionForm = document.getElementById("transaction-form");
const descriptionInput = document.getElementById("description");
const amountInput = document.getElementById("amount");
const categoryInput = document.getElementById("category");
const typeInput = document.getElementById("type");
const formError = document.getElementById("form-error");
const balanceElement = document.getElementById("balance");
const incomeTotalElement = document.getElementById("income-total");
const expenseTotalElement = document.getElementById("expense-total");
const transactionList = document.getElementById("transaction-list");
const emptyState = document.getElementById("empty-state");
const filterButtons = document.querySelectorAll(".filter-btn");
const installButton = document.getElementById("install-button");
const installStatus = document.getElementById("install-status");

let transactions = loadTransactions();
let activeFilter = "all";
let deferredInstallPrompt = null;

initializeInstallUi();
render();
registerServiceWorker();

transactionForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const description = descriptionInput.value.trim();
  const category = categoryInput.value.trim();
  const amount = Number(amountInput.value);
  const type = typeInput.value;

  const validationMessage = validateForm({ description, category, amount, type });
  if (validationMessage) {
    formError.textContent = validationMessage;
    return;
  }

  const transaction = {
    id: crypto.randomUUID(),
    description,
    amount,
    category,
    type,
    createdAt: new Date().toISOString(),
  };

  transactions = [transaction, ...transactions];
  saveTransactions();
  transactionForm.reset();
  typeInput.value = "expense";
  formError.textContent = "";
  render();
});

transactionList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-id]");
  if (!deleteButton) {
    return;
  }

  const transactionId = deleteButton.dataset.deleteId;
  transactions = transactions.filter((transaction) => transaction.id !== transactionId);
  saveTransactions();
  render();
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderTransactions();
  });
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.disabled = false;
  installButton.textContent = "Install App";
  installStatus.textContent = "BudgetFlow is ready to install on this device.";
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installButton.disabled = true;
  installButton.textContent = "Installed";
  installStatus.textContent = "BudgetFlow is installed and ready to use offline.";
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    installStatus.textContent = "Install isn’t available yet. Open the app over localhost or HTTPS and try again.";
    return;
  }

  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;

  if (outcome === "accepted") {
    installStatus.textContent = "Installing BudgetFlow...";
  } else {
    installStatus.textContent = "Install was dismissed. You can try again anytime.";
  }

  deferredInstallPrompt = null;
  installButton.disabled = true;
});

function initializeInstallUi() {
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  installButton.classList.remove("hidden");

  if (isStandalone) {
    installButton.disabled = true;
    installButton.textContent = "Installed";
    installStatus.textContent = "BudgetFlow is installed and ready to use offline.";
    return;
  }

  installButton.disabled = true;
  installButton.textContent = "Install App";
  installStatus.textContent = window.isSecureContext
    ? "Open this app in Chrome, Edge, or another supported browser to install it."
    : "Run this app on localhost or HTTPS to enable installation.";
}

function validateForm({ description, category, amount, type }) {
  if (!description) {
    return "Please enter a description.";
  }

  if (!category) {
    return "Please enter a category.";
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return "Please enter an amount greater than zero.";
  }

  if (!["income", "expense"].includes(type)) {
    return "Please choose a valid transaction type.";
  }

  return "";
}

function loadTransactions() {
  try {
    const storedTransactions = localStorage.getItem(STORAGE_KEY);
    const parsedTransactions = storedTransactions ? JSON.parse(storedTransactions) : [];

    return Array.isArray(parsedTransactions) ? parsedTransactions : [];
  } catch {
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function render() {
  renderSummary();
  renderTransactions();
}

function renderSummary() {
  const income = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const expenses = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const balance = income - expenses;

  balanceElement.textContent = formatCurrency(balance);
  incomeTotalElement.textContent = formatCurrency(income);
  expenseTotalElement.textContent = formatCurrency(expenses);
}

function renderTransactions() {
  const filteredTransactions = transactions.filter((transaction) => {
    if (activeFilter === "all") {
      return true;
    }

    return transaction.type === activeFilter;
  });

  transactionList.innerHTML = filteredTransactions
    .map((transaction) => {
      const isIncome = transaction.type === "income";

      return `
        <li class="transaction-item ${isIncome ? "income-item" : "expense-item"}">
          <div>
            <div class="transaction-top">
              <strong>${escapeHtml(transaction.description)}</strong>
              <span class="category-pill">${escapeHtml(transaction.category)}</span>
            </div>
            <div class="transaction-meta">
              <span class="type-pill ${isIncome ? "income-pill" : "expense-pill"}">${capitalize(transaction.type)}</span>
              <p>${formatDate(transaction.createdAt)}</p>
            </div>
          </div>
          <div class="transaction-actions">
            <span class="transaction-amount ${isIncome ? "income-text" : "expense-text"}">
              ${isIncome ? "+" : "-"}${formatCurrency(transaction.amount)}
            </span>
            <button class="delete-btn" type="button" data-delete-id="${transaction.id}" aria-label="Delete ${escapeHtml(transaction.description)}">
              Delete
            </button>
          </div>
        </li>
      `;
    })
    .join("");

  emptyState.classList.toggle("hidden", filteredTransactions.length > 0);
  transactionList.classList.toggle("hidden", filteredTransactions.length === 0);
}

function formatCurrency(value) {
  return new Intl.NumberFormat(navigator.language || "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateValue) {
  return new Intl.DateTimeFormat(navigator.language || "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateValue));
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return String(value).replace(/[&<>"']/g, (character) => map[character]);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch (error) {
    console.error("Service worker registration failed:", error);
  }
}
