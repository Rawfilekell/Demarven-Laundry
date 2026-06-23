
"use strict";

/*CONSTANTS */
const API_BASE = "/api/v1";

const ROLES = { ADMIN: "admin", STAFF: "staff", CUSTOMER: "customer" };

const ORDER_STATUSES = [
  "Pending",
  "Picked Up",
  "At Facility",
  "Being Cleaned",
  "Ready for Delivery",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];

const STATUS_CLASSES = {
  Pending: "status-pending",
  "Picked Up": "status-picked-up",
  "At Facility": "status-cleaning",
  "Being Cleaned": "status-cleaning",
  "Ready for Delivery": "status-ready",
  "Out for Delivery": "status-delivering",
  Delivered: "status-delivered",
  Cancelled: "status-cancelled",
};

/* ============================================================
   API CLIENT
   ============================================================ */
const ApiClient = {
  _token() {
    try { return JSON.parse(localStorage.getItem("DM_user") || "{}").token || null; }
    catch { return null; }
  },

  async request(method, path, body = null) {
    const headers = { "Content-Type": "application/json" };
    const token = this._token();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${path}`, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || "Request failed");
    }
    return res.json();
  },

  get(path)        { return this.request("GET",    path); },
  post(path, body) { return this.request("POST",   path, body); },
  patch(path, body){ return this.request("PATCH",  path, body); },
  put(path, body)  { return this.request("PUT",    path, body); },
  delete(path)     { return this.request("DELETE", path); },
};

/* ============================================================
   API SERVICE LAYER
   ============================================================ */
class AuthService {
  static async login(email, password) {
    return ApiClient.post("/auth/login", { email, password });
  }
  static async register(data) {
    return ApiClient.post("/auth/register", data);
  }
  static async forgotPassword(email) {
    return ApiClient.post("/auth/forgot-password", { email });
  }
  static async verifyOtp(email, otp) {
    return ApiClient.post("/auth/verify-otp", { email, otp });
  }
  static async resetPassword(token, password) {
    return ApiClient.post("/auth/reset-password", { token, password });
  }
  static getCurrentUser() {
    try { return JSON.parse(localStorage.getItem("DM_user")); }
    catch { return null; }
  }
  static isAuthenticated() { return !!this.getCurrentUser(); }
  static isAdmin() {
    const u = this.getCurrentUser();
    return u && u.role === "admin";
  }
  static logout() {
    localStorage.removeItem("DM_user");
    Router.navigate("/login");
  }
}

class OrderService {
  static async createOrder(data)               { return ApiClient.post("/orders", data); }
  static async trackOrder(code)                { return ApiClient.get(`/orders/track/${code}`); }
  static async getOrders(params = {})          { return ApiClient.get(`/orders?${new URLSearchParams(params)}`); }
  static async getOrder(id)                    { return ApiClient.get(`/orders/${id}`); }
  static async updateOrderStatus(id, status)   { return ApiClient.patch(`/orders/${id}/status`, { status }); }
  static async assignStaff(id, staffId)        { return ApiClient.patch(`/orders/${id}/assign`, { staffId }); }
}

class PickupService {
  static async bookPickup(data) { return ApiClient.post("/pickups", data); }
  static async getPickups()     { return ApiClient.get("/pickups"); }
}

class CustomerService {
  static async getCustomers(params = {}) { return ApiClient.get(`/customers?${new URLSearchParams(params)}`); }
  static async getCustomer(id)           { return ApiClient.get(`/customers/${id}`); }
  static async updateCustomer(id, data)  { return ApiClient.put(`/customers/${id}`, data); }
}

class StaffService {
  static async getStaff(params = {})    { return ApiClient.get(`/staff?${new URLSearchParams(params)}`); }
  static async createStaff(data)        { return ApiClient.post("/staff", data); }
  static async updateStaff(id, data)    { return ApiClient.put(`/staff/${id}`, data); }
  static async toggleStaff(id, enabled) { return ApiClient.patch(`/staff/${id}/status`, { enabled }); }
  static async assignOrders(id, refs)   { return ApiClient.post(`/staff/${id}/assign`, { orderRefs: refs }); }
}

class PricingService {
  static async getPricing()            { return ApiClient.get("/pricing"); }
  static async createItem(data)        { return ApiClient.post("/pricing", data); }
  static async updateItem(id, data)    { return ApiClient.put(`/pricing/${id}`, data); }
  static async toggleItem(id, enabled) { return ApiClient.patch(`/pricing/${id}/status`, { enabled }); }
}

class AnalyticsService {
  static async getKPIs(period = "7d")    { return ApiClient.get(`/analytics/kpis?period=${period}`); }
  static async getRevenue(period = "7d") { return ApiClient.get(`/analytics/revenue?period=${period}`); }
  static async getServiceMix()           { return ApiClient.get("/analytics/service-mix"); }
  static async getCustomerGrowth()       { return ApiClient.get("/analytics/customer-growth"); }
}

class TransactionService {
  static async getTransactions(params = {}) { return ApiClient.get(`/transactions?${new URLSearchParams(params)}`); }
  static async getTransaction(id)           { return ApiClient.get(`/transactions/${id}`); }
}

class NotificationService {
  static async getNotifications() { return ApiClient.get("/notifications"); }
  static async markRead(id)       { return ApiClient.patch(`/notifications/${id}/read`, {}); }
  static async markAllRead()      { return ApiClient.patch("/notifications/read-all", {}); }
}

/* ============================================================
   NOTIFICATION TOAST
   ============================================================ */
const Notify = {
  container: null,
  init() { this.container = document.getElementById("notification-container"); },
  show(type, title, message, duration = 4000) {
    const icons = {
      success: "fa-check-circle",
      error:   "fa-exclamation-circle",
      info:    "fa-info-circle",
      warning: "fa-exclamation-triangle",
    };
    const el = document.createElement("div");
    el.className = `notification ${type}`;
    el.innerHTML = `
      <i class="fas ${icons[type] || icons.info} notification-icon"></i>
      <div class="notification-text">
        <strong>${title}</strong>
        ${message ? `<span>${message}</span>` : ""}
      </div>
      <button class="notification-close" onclick="this.parentElement.remove()">
        <i class="fas fa-times"></i>
      </button>`;
    this.container.appendChild(el);
    setTimeout(() => {
      el.classList.add("removing");
      setTimeout(() => el.remove(), 220);
    }, duration);
  },
  success(title, msg) { this.show("success", title, msg); },
  error(title, msg)   { this.show("error",   title, msg); },
  info(title, msg)    { this.show("info",    title, msg); },
};

/* ============================================================
   PAGE LOADING BAR  — uses existing #page-loading-bar element
   ============================================================ */
const PageBar = {
  el: null,
  init() {
    this.el = document.getElementById("page-loading-bar");
  },
  start() {
    if (!this.el) return;
    this.el.style.width = "0";
    this.el.className = "page-loading-bar loading";
  },
  done() {
    if (!this.el) return;
    this.el.className = "page-loading-bar done";
    setTimeout(() => {
      this.el.style.width = "0";
      this.el.className = "page-loading-bar";
    }, 600);
  },
};

/* ============================================================
   SPA ROUTER
   ============================================================ */
const routes = {
  "/":                   "page-home",
  "/pricing":            "page-pricing",
  "/book-pickup":        "page-book-pickup",
  "/create-order":       "page-create-order",
  "/track-order":        "page-track-order",
  "/login":              "page-login",
  "/register":           "page-register",
  "/forgot-password":    "page-forgot-password",
  "/customer-dashboard": "page-customer-dashboard",
  "/admin-dashboard":    "page-admin-dashboard",
  "/staff-dashboard":    "page-staff-dashboard",
  "/transactions":       "page-transactions",
  "/checkout":           "page-checkout",
  "/receipt":            "page-receipt",
};

const NO_FOOTER_PAGES = [
  "/customer-dashboard",
  "/admin-dashboard",
  "/staff-dashboard",
];

const Router = {
  current: "/",
  navigate(path) { window.location.hash = "#" + path; },
  resolve() {
    const hash = window.location.hash.replace("#", "") || "/";
    const path = hash.split("?")[0];
    this.current = path;
    const pageId = routes[path] || "page-404";

    PageBar.start();

    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    const target = document.getElementById(pageId);
    if (target) { target.classList.add("active"); window.scrollTo(0, 0); }

    document.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.toggle("active", link.getAttribute("data-route") === path);
    });

    document.getElementById("nav-links")?.classList.remove("open");
    document.getElementById("hamburger")?.classList.remove("open");

    const footer = document.getElementById("main-footer");
    if (footer) footer.style.display = NO_FOOTER_PAGES.includes(path) ? "none" : "";

    PageControllers.init(path);
    setTimeout(() => PageBar.done(), 400);
  },
};

/* ============================================================
   PAGE CONTROLLERS
   ============================================================ */
const PageControllers = {
  map: {
    "/pricing":            () => PricingPage.init(),
    "/book-pickup":        () => BookPickupPage.init(),
    "/create-order":       () => CreateOrderPage.init(),
    "/track-order":        () => TrackOrderPage.init(),
    "/login":              () => LoginPage.init(),
    "/register":           () => RegisterPage.init(),
    "/forgot-password":    () => ForgotPasswordPage.init(),
    "/customer-dashboard": () => CustomerDashboard.init(),
    "/admin-dashboard":    () => AdminDashboard.init(),
    "/staff-dashboard":    () => StaffDashboard.init(),
    "/transactions":       () => TransactionsPage.init(),
    "/checkout":           () => CheckoutPage.init(),
    "/receipt":            () => ReceiptPage.init(),
  },
  init(path) { this.map[path]?.(); },
};

/* ============================================================
   SERVICES PAGE
   ============================================================ */
const ServicesPage = {
  SERVICES: [],

  async init() {
    const page = document.getElementById("page-services");
    if (!page || page.dataset.built) return;
    page.dataset.built = "1";

    const container = page.querySelector(".services-full-grid");
    if (!container) return;

    container.innerHTML = this._skeletons(4);

    try {
      // TODO: const { services } = await ApiClient.get("/services");
      // this.SERVICES = services;

      if (!this.SERVICES.length) {
        container.innerHTML = `
          <div class="dash-empty-state" style="display:flex;grid-column:1/-1">
            <i class="fas fa-concierge-bell"></i>
            <h3>Services coming soon</h3>
            <p>Our service catalogue is being updated.</p>
          </div>`;
        return;
      }

      container.innerHTML = this.SERVICES.map((s) => `
        <div class="svc-full-card">
          ${s.badge ? `<span class="svc-badge">${s.badge}</span>` : ""}
          <div class="svc-full-img">
            ${s.img
              ? `<img src="${s.img}" alt="${s.title}" loading="lazy" />`
              : `<div style="width:100%;height:100%;background:var(--off-white);display:flex;align-items:center;justify-content:center">
                   <i class="fas ${s.icon}" style="font-size:3rem;color:var(--border)"></i>
                 </div>`}
          </div>
          <div class="svc-full-body">
            <div class="svc-full-header">
              <div class="svc-full-icon"><i class="fas ${s.icon}"></i></div>
              <div>
                <h3>${s.title}</h3>
                <div class="svc-meta">
                  ${s.turnaround ? `<span><i class="fas fa-clock"></i> ${s.turnaround} turnaround</span>` : ""}
                  ${s.from      ? `<span><i class="fas fa-tag"></i> From ${s.from}</span>` : ""}
                </div>
              </div>
            </div>
            ${s.desc ? `<p>${s.desc}</p>` : ""}
            ${s.features?.length ? `
              <div class="svc-features">
                ${s.features.map((f) => `<span class="svc-feat-tag"><i class="fas fa-check"></i> ${f}</span>`).join("")}
              </div>` : ""}
            <a href="#/create-order" class="btn btn-primary svc-cta" data-route="/create-order">
              Order This Service
            </a>
          </div>
        </div>`).join("");

    } catch (err) {
      container.innerHTML = this._errorState("Could not load services. Please try again.");
    }
  },

  _skeletons(n) {
    return Array(n).fill(`
      <div class="svc-full-card">
        <div class="svc-full-img skeleton"></div>
        <div class="svc-full-body">
          <div class="skeleton skeleton-text w-60" style="height:18px;margin-bottom:.75rem"></div>
          <div class="skeleton skeleton-text w-80"></div>
          <div class="skeleton skeleton-text w-80"></div>
          <div class="skeleton skeleton-text w-40"></div>
        </div>
      </div>`).join("");
  },

  _errorState(msg) {
    return `<div class="error-state" style="grid-column:1/-1">
      <i class="fas fa-exclamation-circle"></i>
      <h3>Something went wrong</h3>
      <p>${msg}</p>
    </div>`;
  },
};

/* ============================================================
   PRICING PAGE
   ============================================================ */
const PricingPage = {
  _items: [],
  _calcItems: [],

  async init() {
    const page = document.getElementById("page-pricing");
    if (!page || page.dataset.built) return;
    page.dataset.built = "1";
    this._calcItems = [];

    // Table is hardcoded in HTML — skip API call and just render calculator
    this._renderCalculator(page);
    return;

    const tableBody = page.querySelector(".pricing-table-body");
    if (tableBody) tableBody.innerHTML = this._tableLoadingRows(5);

    try {
      // TODO: const { items } = await ApiClient.get("/pricing");
      // this._items = items;

      if (!this._items.length) {
        if (tableBody) {
          tableBody.innerHTML = `<tr><td colspan="4">
            <div class="dash-empty-state" style="display:flex">
              <i class="fas fa-tags"></i>
              <p>No pricing items available yet.</p>
            </div>
          </td></tr>`;
        }
      } else {
        this._renderTable(page);
      }

    } catch {
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="4">
          <div class="error-state"><i class="fas fa-exclamation-circle"></i>
          <p>Could not load pricing data.</p></div>
        </td></tr>`;
      }
    }

    this._renderCalculator(page);
  },

  _fmt(n) { return n ? "₦" + n.toLocaleString() : "—"; },

  _tableLoadingRows(n) {
    return Array(n).fill(`<tr>
      ${Array(4).fill('<td><div class="skeleton skeleton-text"></div></td>').join("")}
    </tr>`).join("");
  },

  _renderTable(page) {
    const body = page.querySelector(".pricing-table-body");
    if (!body) return;
    const groups = {};
    this._items.forEach((item) => {
      (groups[item.category] = groups[item.category] || []).push(item);
    });
    body.innerHTML = Object.entries(groups).map(([cat, items]) => `
      <tr class="price-cat-row"><td colspan="4"><strong>${cat}</strong></td></tr>
      ${items.map((i) => `
        <tr>
          <td>${i.name}</td>
          <td>${this._fmt(i.basic)}</td>
          <td>${this._fmt(i.standard)}</td>
          <td>${this._fmt(i.premium)}</td>
        </tr>`).join("")}`).join("");
  },

  _renderCalculator(page) {
    const wrap = page.querySelector(".price-calc-items");
    if (!wrap) return;

    const selectable = this._items.filter((i) => i.basic || i.standard || i.premium);
    const optionsHtml = selectable.length
      ? selectable.map((item, i) =>
          `<option value="${i}" data-b="${item.basic || 0}" data-s="${item.standard || 0}" data-p="${item.premium || 0}">
            ${item.category} — ${item.name}
          </option>`).join("")
      : `<option disabled>No items available</option>`;

    wrap.innerHTML = `
      <div class="calc-add-row">
        <select id="calc-item-select" class="calc-select">
          <option value="">Select an item...</option>
          ${optionsHtml}
        </select>
        <select id="calc-tier-select" class="calc-select">
          <option value="basic">Basic</option>
          <option value="standard" selected>Standard</option>
          <option value="premium">Premium</option>
        </select>
        <input type="number" id="calc-qty" min="1" max="50" value="1" class="calc-qty-input" />
        <button class="btn btn-primary" id="calc-add-btn"><i class="fas fa-plus"></i> Add</button>
      </div>
      <div id="calc-list" class="calc-list">
        <p class="calc-empty">No items added yet.</p>
      </div>
      <div class="calc-total-row">
        <span>Estimated Total</span>
        <span id="calc-total" class="calc-total">₦0</span>
      </div>
      <p class="calc-note">
        <i class="fas fa-info-circle"></i>
        This is an estimate. Final price confirmed after item inspection.
        Free pickup &amp; delivery on orders over ₦5,000.
      </p>
      <a href="#/create-order" class="btn btn-primary btn-block" style="margin-top:1rem">
        Place This Order
      </a>`;

    wrap.querySelector("#calc-add-btn").addEventListener("click", () => {
      const sel  = wrap.querySelector("#calc-item-select");
      const tier = wrap.querySelector("#calc-tier-select").value;
      const qty  = parseInt(wrap.querySelector("#calc-qty").value) || 1;
      if (!sel.value) { Notify.error("Select an item", "Please choose an item to add."); return; }
      const opt   = sel.selectedOptions[0];
      const price = { basic: +opt.dataset.b, standard: +opt.dataset.s, premium: +opt.dataset.p }[tier];
      if (!price) { Notify.error("Not available", `This item is not available in the ${tier} tier.`); return; }
      this._calcItems.push({ name: opt.text, tier, qty, price, total: price * qty });
      this._updateCalcList(wrap);
    });
  },

  _updateCalcList(wrap) {
    const list    = wrap.querySelector("#calc-list");
    const totalEl = wrap.querySelector("#calc-total");
    if (!list || !totalEl) return;
    if (!this._calcItems.length) {
      list.innerHTML  = '<p class="calc-empty">No items added yet.</p>';
      totalEl.textContent = "₦0";
      return;
    }
    list.innerHTML = this._calcItems.map((item, i) => `
      <div class="calc-item-row">
        <div class="calc-item-info">
          <span class="calc-item-name">${item.name}</span>
          <span class="calc-item-meta">${item.tier} × ${item.qty}</span>
        </div>
        <div class="calc-item-price">₦${item.total.toLocaleString()}</div>
        <button class="calc-remove" data-index="${i}"><i class="fas fa-times"></i></button>
      </div>`).join("");
    list.querySelectorAll(".calc-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        this._calcItems.splice(+btn.dataset.index, 1);
        this._updateCalcList(wrap);
      });
    });
    const total = this._calcItems.reduce((s, i) => s + i.total, 0);
    totalEl.textContent = "₦" + total.toLocaleString();
  },
};

/* ============================================================
   BOOK PICKUP PAGE
   ============================================================ */
const BookPickupPage = {
  init() {
    const page = document.getElementById("page-book-pickup");
    if (!page || page.dataset.built) return;
    page.dataset.built = "1";

    const form = page.querySelector("#pickup-form");
    if (!form) return;

    const dateInput = form.querySelector("#pickup-date");
    if (dateInput) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateInput.min = tomorrow.toISOString().split("T")[0];
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector('[type="submit"]');
      const data = {
        name:         form.querySelector("#pickup-name")?.value,
        phone:        form.querySelector("#pickup-phone")?.value,
        email:        form.querySelector("#pickup-email")?.value,
        address:      form.querySelector("#pickup-address")?.value,
        area:         form.querySelector("#pickup-area")?.value,
        date:         form.querySelector("#pickup-date")?.value,
        slot:         form.querySelector("#pickup-slot")?.value,
        instructions: form.querySelector("#pickup-instructions")?.value,
      };
      btn.disabled  = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Booking...';
      try {
        await PickupService.bookPickup(data);
        Notify.success("Pickup Booked!", `We'll be at your door on ${data.date} (${data.slot}).`);
        form.reset();
        const successBox = page.querySelector(".pickup-success");
        if (successBox) { successBox.style.display = "flex"; form.style.display = "none"; }
      } catch (err) {
        Notify.error("Booking Failed", err.message || "Please try again or call us directly.");
      } finally {
        btn.disabled  = false;
        btn.innerHTML = '<i class="fas fa-calendar-check"></i> Confirm Pickup';
      }
    });
  },
};

/* ============================================================
   CREATE ORDER PAGE
   ============================================================ */
const CreateOrderPage = {
  SERVICE_ITEMS: [],
  TIER_COLORS: { basic: "#27AE60", standard: "#FF4B7D", premium: "#FFB830" },
  _cart: [],

  async init() {
    const page = document.getElementById("page-create-order");
    if (!page || page.dataset.built) return;
    page.dataset.built = "1";
    this._cart = [];

    const grid = page.querySelector(".order-items-grid");
    if (grid) grid.innerHTML = this._itemSkeletons(8);

    try {
      // TODO: const { items } = await ApiClient.get("/pricing?type=orderable");
      // this.SERVICE_ITEMS = items;

      if (!this.SERVICE_ITEMS.length) {
        if (grid) grid.innerHTML = `
          <div class="dash-empty-state" style="display:flex;grid-column:1/-1">
            <i class="fas fa-box-open"></i>
            <h3>No items available</h3>
            <p>The service catalogue is being set up.</p>
          </div>`;
      } else {
        this._renderItemGrid(page);
      }
    } catch {
      if (grid) grid.innerHTML = `
        <div class="error-state" style="grid-column:1/-1">
          <i class="fas fa-exclamation-circle"></i>
          <p>Could not load items. Please refresh.</p>
        </div>`;
    }

    this._bindOrderForm(page);
  },

  _itemSkeletons(n) {
    return Array(n).fill(`
      <div class="order-item-card">
        <div class="skeleton" style="width:36px;height:36px;border-radius:6px"></div>
        <div style="flex:1">
          <div class="skeleton skeleton-text w-80"></div>
          <div class="skeleton skeleton-text w-40"></div>
        </div>
      </div>`).join("");
  },

  _renderItemGrid(page) {
    const grid = page.querySelector(".order-items-grid");
    if (!grid) return;
    grid.innerHTML = this.SERVICE_ITEMS.map((item) => `
      <div class="order-item-card" data-id="${item.id}">
        <div class="order-item-icon"><i class="fas ${item.icon || "fa-tshirt"}"></i></div>
        <div class="order-item-info">
          <span class="order-item-name">${item.name}</span>
          <span class="order-item-price">₦${(item.price || 0).toLocaleString()}</span>
          <span class="order-item-tier" style="color:${this.TIER_COLORS[item.tier] || "#888"}">${item.tier || ""}</span>
        </div>
        <div class="order-item-qty-ctrl">
          <button class="qty-btn qty-minus" data-id="${item.id}">−</button>
          <span class="qty-display" id="qty-${item.id}">0</span>
          <button class="qty-btn qty-plus"  data-id="${item.id}">+</button>
        </div>
      </div>`).join("");

    grid.addEventListener("click", (e) => {
      const btn = e.target.closest(".qty-btn");
      if (!btn) return;
      const id   = btn.dataset.id;
      const item = this.SERVICE_ITEMS.find((i) => i.id === id);
      if (!item) return;
      const entry = this._cart.find((c) => c.id === id);
      if (btn.classList.contains("qty-plus")) {
        entry ? entry.qty++ : this._cart.push({ ...item, qty: 1 });
      } else if (entry && entry.qty > 0) {
        entry.qty--;
        if (entry.qty === 0) this._cart = this._cart.filter((c) => c.id !== id);
      }
      const qty     = this._cart.find((c) => c.id === id)?.qty || 0;
      const display = document.getElementById(`qty-${id}`);
      if (display) display.textContent = qty;
      grid.querySelector(`[data-id="${id}"]`)?.classList.toggle("order-item-active", qty > 0);
      this._updateSummary(page);
    });
  },

  _updateSummary(page) {
    const summary = page.querySelector(".order-summary-list");
    const totalEl = page.querySelector(".order-summary-total-amount");
    if (!summary) return;
    const active = this._cart.filter((c) => c.qty > 0);
    if (!active.length) {
      summary.innerHTML = '<p class="order-empty-cart">No items added yet. Select items above.</p>';
      if (totalEl) totalEl.textContent = "₦0";
      return;
    }
    const total = active.reduce((s, i) => s + i.price * i.qty, 0);
    summary.innerHTML = active.map((item) => `
      <div class="order-summary-row">
        <span>${item.name} × ${item.qty}</span>
        <span>₦${(item.price * item.qty).toLocaleString()}</span>
      </div>`).join("");
    if (totalEl) totalEl.textContent = "₦" + total.toLocaleString();
  },

  _bindOrderForm(page) {
    const form = page.querySelector("#order-form");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const active = this._cart.filter((c) => c.qty > 0);
      if (!active.length) { Notify.error("No items selected", "Please add at least one item."); return; }

      const btn = form.querySelector('[type="submit"]');
      btn.disabled  = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing Order...';
      try {
        const payload = {
          items:       active.map((i) => ({ itemId: i.id, name: i.name, qty: i.qty, price: i.price })),
          name:        form.querySelector("#order-name")?.value,
          phone:       form.querySelector("#order-phone")?.value,
          email:       form.querySelector("#order-email")?.value,
          address:     form.querySelector("#order-address")?.value,
          area:        form.querySelector("#order-area")?.value,
          serviceType: form.querySelector("#order-service-type")?.value,
          pickupDate:  form.querySelector("#order-pickup-date")?.value,
          notes:       form.querySelector("#order-notes")?.value,
        };
        const { ref } = await OrderService.createOrder(payload);
        Notify.success("Order Placed!", `Reference: ${ref}. Track your order anytime.`);
        const confirmPanel = page.querySelector(".order-confirmation-panel");
        if (confirmPanel) {
          confirmPanel.querySelector(".order-ref-code").textContent = ref;
          confirmPanel.style.display = "block";
          page.querySelector(".order-form-section").style.display = "none";
        }
      } catch (err) {
        Notify.error("Failed", err.message || "Could not place your order. Please try again.");
      } finally {
        btn.disabled  = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Place Order';
      }
    });
  },
};

/* ============================================================
   TRACK ORDER PAGE
   ============================================================ */
const TrackOrderPage = {
  pendingCode: null,

  init() {
    const page = document.getElementById("page-track-order");
    if (!page) return;

    if (!page.dataset.built) {
      page.dataset.built = "1";
      const form = page.querySelector("#track-form");
      if (form) {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const code     = form.querySelector("#track-code").value.trim();
          if (!code) return;
          const btn      = form.querySelector('[type="submit"]');
          const resultEl = page.querySelector(".track-result");
          const emptyEl  = page.querySelector(".track-empty");
          btn.disabled  = true;
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
          resultEl && (resultEl.style.display = "none");
          emptyEl  && (emptyEl.style.display  = "none");
          try {
            const order = await OrderService.trackOrder(code);
            if (order) {
              this._renderResult(page, order);
              resultEl && (resultEl.style.display = "block");
            } else {
              emptyEl && (emptyEl.style.display = "flex");
            }
          } catch {
            emptyEl && (emptyEl.style.display = "flex");
          } finally {
            btn.disabled  = false;
            btn.innerHTML = '<i class="fas fa-search"></i> Track Order';
          }
        });
      }
    }

    if (this.pendingCode) {
      const code = this.pendingCode;
      this.pendingCode = null;
      const input = page.querySelector("#track-code");
      if (input) input.value = code;
      const form = page.querySelector("#track-form");
      if (form) {
        form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    }
  },

  _renderResult(page, order) {
    const panel = page.querySelector(".track-result");
    if (!panel) return;

    const idEl  = panel.querySelector(".track-order-id");
    const etaEl = panel.querySelector(".track-eta");
    if (idEl)  idEl.textContent  = order.code  || "—";
    if (etaEl) etaEl.textContent = order.eta ? "ETA: " + order.eta : "ETA unavailable";

    const stepsEl = panel.querySelector(".track-steps");
    if (stepsEl && Array.isArray(order.steps)) {
      stepsEl.innerHTML = order.steps.map((step, i) => {
        const done   = i < order.activeStep;
        const active = i === order.activeStep;
        return `
          <div class="track-step ${done ? "done" : ""} ${active ? "active" : ""}">
            <div class="track-step-dot">
              <i class="fas ${done ? "fa-check" : active ? "fa-circle-notch fa-spin" : "fa-circle"}"></i>
            </div>
            <div class="track-step-label">${step}</div>
          </div>
          ${i < order.steps.length - 1 ? '<div class="track-step-line"></div>' : ""}`;
      }).join("");
    }

    const itemsEl = panel.querySelector(".track-items-list");
    if (itemsEl) {
      itemsEl.innerHTML = Array.isArray(order.items) && order.items.length
        ? order.items.map((i) => `<li><i class="fas fa-tshirt"></i> ${i}</li>`).join("")
        : `<li><i class="fas fa-info-circle"></i> No item details available</li>`;
    }

    const riderEl = panel.querySelector(".track-rider");
    if (riderEl) {
      if (order.rider) {
        riderEl.innerHTML = `
          <div class="track-rider-info">
            <div class="track-rider-avatar"><i class="fas fa-user"></i></div>
            <div>
              <strong>${order.rider}</strong>
              <span>Your delivery rider</span>
            </div>
          </div>
          ${order.riderPhone
            ? `<a href="tel:${order.riderPhone}" class="btn btn-outline btn-sm">
                 <i class="fas fa-phone"></i> Call
               </a>`
            : ""}`;
      } else {
        riderEl.innerHTML = `<span style="font-size:.85rem;color:var(--light-text)">Rider not yet assigned</span>`;
      }
    }
  },
};

/* ============================================================
   AUTH PAGES
   ============================================================ */
const LoginPage = {
  init() {
    const page = document.getElementById("page-login");
    const form = page?.querySelector("#login-form");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn   = form.querySelector('[type="submit"]');
      const email = form.querySelector("#login-email")?.value;
      const pw    = form.querySelector("#login-password")?.value;
      btn.disabled  = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
      try {
        const { user, token } = await AuthService.login(email, pw);
        localStorage.setItem("DM_user", JSON.stringify({ ...user, token }));
        Notify.success("Welcome back!", "Redirecting to your dashboard...");
        const dest = user.role === "admin"
          ? "/admin-dashboard"
          : user.role === "staff"
          ? "/staff-dashboard"
          : "/customer-dashboard";
        setTimeout(() => Router.navigate(dest), 1200);
      } catch (err) {
        Notify.error("Login Failed", err.message || "Invalid email or password.");
      } finally {
        btn.disabled  = false;
        btn.innerHTML = "Sign In";
      }
    });
  },
};

const RegisterPage = {
  init() {
    const page = document.getElementById("page-register");
    const form = page?.querySelector("#register-form");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pwd     = form.querySelector("#reg-password")?.value;
      const confirm = form.querySelector("#reg-confirm")?.value;
      if (pwd !== confirm) { Notify.error("Passwords don't match", "Please re-enter your password."); return; }
      if (pwd.length < 8)  { Notify.error("Password too short", "Minimum 8 characters required."); return; }

      const btn = form.querySelector('[type="submit"]');
      btn.disabled  = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
      try {
        const firstName = form.querySelector("#reg-first-name")?.value;
        const lastName  = form.querySelector("#reg-last-name")?.value;
        const data = {
          name:     `${firstName} ${lastName}`.trim(),
          email:    form.querySelector("#reg-email")?.value,
          phone:    form.querySelector("#reg-phone")?.value,
          password: pwd,
        };
        const { user, token } = await AuthService.register(data);
        localStorage.setItem("DM_user", JSON.stringify({ ...user, token }));
        Notify.success("Account Created!", "Welcome to Demarven. Redirecting...");
        setTimeout(() => Router.navigate("/customer-dashboard"), 1200);
      } catch (err) {
        Notify.error("Registration Failed", err.message || "Please check your details and try again.");
      } finally {
        btn.disabled  = false;
        btn.innerHTML = "Create Account";
      }
    });
  },
};

/* ============================================================
   FORGOT PASSWORD  (3-step OTP flow)
   ============================================================ */
const ForgotPasswordPage = {
  _step:  1,
  _email: "",

  init() {
    const page = document.getElementById("page-forgot-password");
    if (!page || page.dataset.built) return;
    page.dataset.built = "1";
    this._step  = 1;
    this._email = "";
    this._render(page);
  },

  _stepsHTML(active) {
    return `<div class="auth-steps">
      ${[1, 2, 3].map((i) =>
        `<div class="auth-step-dot ${i < active ? "done" : ""} ${i === active ? "active" : ""}"></div>`
      ).join("")}
    </div>`;
  },

  _logo() {
    return `<div class="auth-logo">
      <span class="logo-mark">DM</span>
      <span class="logo-text">Demarven<strong>Laundry</strong></span>
    </div>`;
  },

  _render(page) {
    let card = page.querySelector(".auth-card");
    if (!card) {
      const wrap = page.querySelector(".auth-page") || page;
      card = document.createElement("div");
      card.className = "auth-card";
      wrap.appendChild(card);
    }

    if (this._step === 1) {
      card.innerHTML = `
        ${this._stepsHTML(1)}
        ${this._logo()}
        <h2>Forgot Password</h2>
        <p>Enter your email and we'll send a reset code</p>
        <form id="forgot-form" novalidate>
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" id="forgot-email" placeholder="you@example.com" required />
          </div>
          <button type="submit" class="btn btn-primary btn-block">
            Send Reset Code <i class="fas fa-arrow-right"></i>
          </button>
        </form>
        <p class="auth-switch" style="margin-top:1rem">
          <a href="#/login" data-route="/login" class="auth-link">
            <i class="fas fa-arrow-left"></i> Back to Login
          </a>
        </p>`;
      card.querySelector("#forgot-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = card.querySelector("#forgot-email").value.trim();
        if (!email) return;
        const btn = e.target.querySelector("[type=submit]");
        btn.disabled  = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        try {
          await AuthService.forgotPassword(email);
          this._email = email;
          Notify.success("Code Sent!", `A 6-digit code was sent to ${email}`);
          this._step = 2;
          this._render(page);
        } catch (err) {
          Notify.error("Failed", err.message || "Could not send reset code. Please try again.");
          btn.disabled  = false;
          btn.innerHTML = 'Send Reset Code <i class="fas fa-arrow-right"></i>';
        }
      });

    } else if (this._step === 2) {
      card.innerHTML = `
        ${this._stepsHTML(2)}
        <button class="auth-card-back" id="DM-back"><i class="fas fa-arrow-left"></i> Back</button>
        ${this._logo()}
        <h2>Enter OTP</h2>
        <p>We sent a 6-digit code to your email. It expires in 10 minutes.</p>
        <div class="otp-input-row">
          ${[0,1,2,3,4,5].map((i) =>
            `<input class="otp-input" maxlength="1" type="text" inputmode="numeric" id="otp-${i}" />`
          ).join("")}
        </div>
        <button class="btn btn-primary btn-block" id="verify-otp-btn">Verify Code</button>
        <p class="auth-resend">
          Didn't receive it?
          <span class="auth-resend-link" id="resend-link">Resend Code</span>
        </p>`;

      const inputs = card.querySelectorAll(".otp-input");
      inputs.forEach((inp, i) => {
        inp.addEventListener("input", () => { if (inp.value && i < inputs.length - 1) inputs[i + 1].focus(); });
        inp.addEventListener("keydown", (e) => { if (e.key === "Backspace" && !inp.value && i > 0) inputs[i - 1].focus(); });
      });
      card.querySelector("#DM-back").addEventListener("click", () => { this._step = 1; this._render(page); });
      card.querySelector("#resend-link").addEventListener("click", async () => {
        try {
          await AuthService.forgotPassword(this._email);
          Notify.info("Code Resent", "A new code has been sent to your email.");
        } catch { Notify.error("Failed", "Could not resend. Please try again."); }
      });
      card.querySelector("#verify-otp-btn").addEventListener("click", async () => {
        const code = Array.from(inputs).map((i) => i.value).join("");
        if (code.length < 6) { Notify.error("Incomplete", "Please enter all 6 digits."); return; }
        const btn = card.querySelector("#verify-otp-btn");
        btn.disabled  = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
        try {
          await AuthService.verifyOtp(this._email, code);
          this._step = 3;
          this._render(page);
        } catch (err) {
          Notify.error("Invalid Code", err.message || "The code entered is incorrect or expired.");
          btn.disabled  = false;
          btn.innerHTML = "Verify Code";
        }
      });

    } else {
      card.innerHTML = `
        ${this._stepsHTML(3)}
        ${this._logo()}
        <h2>New Password</h2>
        <p>Choose a strong new password for your account</p>
        <form id="reset-form" novalidate>
          <div class="form-group">
            <label>New Password</label>
            <div class="input-with-icon">
              <input type="password" id="new-pw" placeholder="Min. 8 characters" required />
              <button type="button" class="toggle-pw" data-target="new-pw">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>
          <div class="form-group">
            <label>Confirm Password</label>
            <input type="password" id="confirm-pw" placeholder="Repeat password" required />
          </div>
          <button type="submit" class="btn btn-primary btn-block">
            <i class="fas fa-lock"></i> Reset Password
          </button>
        </form>`;
      bindPasswordToggles(card);
      card.querySelector("#reset-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const pw      = card.querySelector("#new-pw").value;
        const confirm = card.querySelector("#confirm-pw").value;
        if (pw !== confirm) { Notify.error("Mismatch", "Passwords do not match."); return; }
        if (pw.length < 8) { Notify.error("Too short", "Password must be at least 8 characters."); return; }
        const btn = e.target.querySelector("[type=submit]");
        btn.disabled  = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';
        try {
          await AuthService.resetPassword(this._email, pw);
          card.innerHTML = `
            <div class="auth-success-icon">🔐</div>
            <h2 style="text-align:center;margin-bottom:.5rem">Password Reset!</h2>
            <p style="text-align:center;color:var(--mid);margin-bottom:1.5rem">
              Your password has been updated. You can now sign in.
            </p>
            <a href="#/login" class="btn btn-primary btn-block" data-route="/login">
              <i class="fas fa-sign-in-alt"></i> Go to Login
            </a>`;
        } catch (err) {
          Notify.error("Reset Failed", err.message || "Could not reset password. Please start over.");
          btn.disabled  = false;
          btn.innerHTML = '<i class="fas fa-lock"></i> Reset Password';
        }
      });
    }
  },
};

/* ============================================================
   CUSTOMER DASHBOARD
   ============================================================ */
const CustomerDashboard = {
  async init() {
    const page = document.getElementById("page-customer-dashboard");
    if (!page || page.dataset.built) return;
    page.dataset.built = "1";
    this._bindTabs(page);
    await this._loadDashboard(page);
  },

  _bindTabs(page) {
    page.querySelectorAll(".dash-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        page.querySelectorAll(".dash-tab").forEach((t) => t.classList.remove("active"));
        page.querySelectorAll(".dash-panel").forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        page.querySelector(`#dash-${tab.dataset.tab}`)?.classList.add("active");
      });
    });
  },

  async _loadDashboard(page) {
    const statsEl = page.querySelector(".dash-stats");
    if (statsEl) statsEl.innerHTML = Array(4).fill(
      '<div class="dash-stat-card loading-pulse" style="min-height:88px"></div>'
    ).join("");

    const STAT_DEFS = [
      { icon: "fa-shopping-bag",  label: "Total Orders",  key: "totalOrders",  color: "" },
      { icon: "fa-clock",         label: "Active Orders", key: "activeOrders", color: "coral" },
      { icon: "fa-check-circle",  label: "Completed",     key: "completed",    color: "success" },
      { icon: "fa-coins",         label: "Total Spent",   key: "totalSpent",   color: "yellow", prefix: "₦" },
    ];

    const colorMap = {
      coral:   "background:var(--coral-light);color:var(--coral)",
      success: "background:#e8f5e9;color:var(--success)",
      yellow:  "background:#fff8e1;color:var(--yellow-dark)",
      "":      "",
    };

    let stats = { totalOrders: null, activeOrders: null, completed: null, totalSpent: null };
    try {
      stats = await ApiClient.get("/customer/stats");
    } catch { /* stats stay null — UI shows "—" */ }

    if (statsEl) {
      statsEl.innerHTML = STAT_DEFS.map((s) => {
        const raw = stats[s.key];
        const val = raw === null || raw === undefined
          ? "—"
          : (s.prefix || "") + (typeof raw === "number" ? raw.toLocaleString() : raw);
        return `
          <div class="dash-stat-card">
            <div class="dash-stat-icon" style="${colorMap[s.color]}">
              <i class="fas ${s.icon}"></i>
            </div>
            <div class="dash-stat-body">
              <span class="dash-stat-val">${val}</span>
              <span class="dash-stat-label">${s.label}</span>
            </div>
          </div>`;
      }).join("");
    }

    const ordersPanel = page.querySelector("#dash-orders");
    if (ordersPanel) {
      try {
        const { orders } = await ApiClient.get("/orders");
        if (!orders || orders.length === 0) {
          ordersPanel.querySelector(".dash-empty-state")?.style.setProperty("display", "flex");
        } else {
          this._renderOrdersTable(ordersPanel, orders);
        }
      } catch {
        ordersPanel.innerHTML = `<div class="error-state" style="display:flex;flex-direction:column;align-items:center;padding:2rem">
          <i class="fas fa-exclamation-circle"></i>
          <p>Could not load orders. Please refresh.</p>
        </div>`;
      }
    }
  },

  _renderOrdersTable(container, orders) {
    const existing = container.querySelector(".dash-recent");
    const tableWrap = existing || document.createElement("div");
    tableWrap.className = "dash-recent";
    tableWrap.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Ref</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th><th></th></tr></thead>
          <tbody>
            ${orders.map((o) => `
              <tr>
                <td style="font-family:monospace;color:var(--coral)">${o.ref || o.id}</td>
                <td>${Array.isArray(o.items) ? o.items.length + " item(s)" : "—"}</td>
                <td style="font-weight:700">₦${(o.total || 0).toLocaleString()}</td>
                <td>${statusBadge(o.status)}</td>
                <td>${o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-GB") : "—"}</td>
                <td>
                  <a href="#/track-order" class="btn btn-ghost btn-sm" data-route="/track-order">
                    <i class="fas fa-search"></i>
                  </a>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
    if (!existing) container.appendChild(tableWrap);
  },
};

/* ============================================================
   ADMIN DASHBOARD
   ============================================================ */
const AdminDashboard = {
  async init() {
    const page = document.getElementById("page-admin-dashboard");
    if (!page || page.dataset.built) return;
    page.dataset.built = "1";
    this._bindNav(page);
    await this._loadOverview(page);
  },

  _bindNav(page) {
    page.querySelectorAll(".admin-nav-item").forEach((item) => {
      item.addEventListener("click", () => {
        page.querySelectorAll(".admin-nav-item").forEach((i) => i.classList.remove("active"));
        page.querySelectorAll(".admin-section").forEach((s)  => s.classList.remove("active"));
        item.classList.add("active");
        const sec = page.querySelector(`#admin-${item.dataset.section}`);
        if (sec) { sec.classList.add("active"); this._loadSection(item.dataset.section, sec); }
      });
    });
  },

  async _loadOverview(page) {
    const metricsGrid = page.querySelector(".admin-metrics-grid");
    if (metricsGrid) metricsGrid.innerHTML = Array(6).fill(
      '<div class="admin-metric-card loading-pulse" style="min-height:88px"></div>'
    ).join("");

    const METRIC_DEFS = [
      { icon: "fa-shopping-bag",    label: "Orders Today",       key: "ordersToday",      color: "" },
      { icon: "fa-users",           label: "Active Customers",   key: "activeCustomers",  color: "coral" },
      { icon: "fa-money-bill-wave", label: "Revenue Today",      key: "revenueToday",     color: "success", prefix: "₦" },
      { icon: "fa-truck",           label: "Out for Delivery",   key: "outForDelivery",   color: "yellow" },
      { icon: "fa-clock",           label: "Pending Pickups",    key: "pendingPickups",   color: "" },
      { icon: "fa-star",            label: "Avg Rating",         key: "avgRating",        color: "coral" },
    ];

    const colorMap = {
      coral:   "background:var(--coral-light);color:var(--coral)",
      success: "background:#e8f5e9;color:var(--success)",
      yellow:  "background:#fff8e1;color:var(--yellow-dark)",
      "":      "",
    };

    let metrics = {};
    try { metrics = await ApiClient.get("/admin/metrics"); }
    catch { /* metrics stay empty — UI shows "—" */ }

    if (metricsGrid) {
      metricsGrid.innerHTML = METRIC_DEFS.map((c) => {
        const raw = metrics[c.key];
        const val = raw === null || raw === undefined
          ? "—"
          : (c.prefix || "") + (typeof raw === "number" ? raw.toLocaleString() : raw);
        return `
          <div class="admin-metric-card">
            <div class="admin-metric-icon" style="${colorMap[c.color]}">
              <i class="fas ${c.icon}"></i>
            </div>
            <div class="admin-metric-body">
              <span class="admin-metric-val">${val}</span>
              <span class="admin-metric-label">${c.label}</span>
            </div>
          </div>`;
      }).join("");
    }

    await this._loadOrdersTable(page);
    await this._loadCustomersTable(page);
  },

  async _loadOrdersTable(page) {
    const tbody = page.querySelector(".admin-orders-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7"><div class="loading-pulse" style="height:40px;border-radius:8px"></div></td></tr>`;
    try {
      const { orders } = await ApiClient.get("/orders");
      if (!orders || orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="admin-table-empty">
          <div class="dash-empty-state" style="display:flex">
            <i class="fas fa-inbox"></i>
            <p>No orders yet. Orders will appear here as they come in.</p>
          </div></td></tr>`;
        return;
      }
      tbody.innerHTML = orders.map((o) => `
        <tr>
          <td style="font-family:monospace;color:var(--coral)">${o.ref || o.id}</td>
          <td>${o.customer?.name || o.customerName || "—"}</td>
          <td>${Array.isArray(o.items) ? o.items.length + " item(s)" : "—"}</td>
          <td>${statusBadge(o.status)}</td>
          <td>${o.staff || "Unassigned"}</td>
          <td style="font-weight:700">₦${(o.total || 0).toLocaleString()}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="OrderDrawer.open(${JSON.stringify(o).replace(/"/g, "&quot;")})">
              <i class="fas fa-eye"></i>
            </button>
          </td>
        </tr>`).join("");
    } catch {
      tbody.innerHTML = `<tr><td colspan="7" class="admin-table-empty">
        <div class="error-state" style="display:flex;flex-direction:column;align-items:center;padding:1.5rem">
          <i class="fas fa-exclamation-circle"></i>
          <p>Could not load orders.</p>
        </div></td></tr>`;
    }
  },

  async _loadCustomersTable(page) {
    const tbody = page.querySelector(".admin-customers-tbody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5"><div class="loading-pulse" style="height:40px;border-radius:8px"></div></td></tr>`;
    try {
      const { customers } = await ApiClient.get("/customers?limit=10");
      if (!customers || customers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="admin-table-empty">
          <div class="dash-empty-state" style="display:flex">
            <i class="fas fa-users"></i><p>No customers yet.</p>
          </div></td></tr>`;
        return;
      }
      tbody.innerHTML = customers.map((c) => `
        <tr>
          <td>${c.name}</td>
          <td>${c.email}</td>
          <td>${c.phone || "—"}</td>
          <td>${c.orders ?? "—"}</td>
          <td>₦${(c.totalSpent || 0).toLocaleString()}</td>
        </tr>`).join("");
    } catch {
      tbody.innerHTML = `<tr><td colspan="5" class="admin-table-empty">
        <div class="error-state" style="display:flex;flex-direction:column;align-items:center;padding:1.5rem">
          <i class="fas fa-exclamation-circle"></i><p>Could not load customers.</p>
        </div></td></tr>`;
    }
  },

  _loadSection(section, container) {
    if (section !== "analytics" && container.dataset.loaded) return;
    container.dataset.loaded = "1";
    switch (section) {
      case "staff":        StaffManager.renderGrid(container);     break;
      case "analytics":    Analytics.renderAll(container);         break;
      case "transactions": TransactionsPage.renderInto(container); break;
      case "pricing":      PricingManager.renderTable(container);  break;
      case "customers":    CustomerManager.renderTable(container);  break;
    }
  },
};

/* ============================================================
   STAFF DASHBOARD
   ============================================================ */
const StaffDashboard = {
  currentStaff: null,

  async init() {
    const page = document.getElementById("page-staff-dashboard");
    if (!page || page.dataset.built) return;
    page.dataset.built = "1";

    this.currentStaff = AuthService.getCurrentUser() || { name: "Staff Member", role: "staff", id: null };

    const welcome = page.querySelector(".dash-welcome");
    if (welcome) welcome.textContent = `Good day, ${this.currentStaff.name?.split(" ")[0] || "there"}!`;

    this._bindNav(page);
    await this._loadSection("overview", page);
  },

  _bindNav(page) {
    page.querySelectorAll(".staff-nav-item").forEach((item) => {
      item.addEventListener("click", () => {
        page.querySelectorAll(".staff-nav-item").forEach((i) => i.classList.remove("active"));
        page.querySelectorAll(".staff-section").forEach((s)  => s.classList.remove("active"));
        item.classList.add("active");
        const sec = page.querySelector(`#staff-${item.dataset.section}`);
        if (sec) { sec.classList.add("active"); this._loadSection(item.dataset.section, page); }
      });
    });
  },

  async _loadSection(section, page) {
    switch (section) {
      case "overview": await this._renderOverview(page); break;
      case "kanban":   await this._renderKanban(page);   break;
      case "queue":    await this._renderQueue(page);    break;
    }
  },

  async _fetchMyOrders() {
    try {
      const { orders } = await ApiClient.get(
        `/orders${this.currentStaff?.id ? `?assignedTo=${this.currentStaff.id}` : ""}`
      );
      return orders || [];
    } catch { return []; }
  },

  async _fetchAllOrders() {
    try {
      const { orders } = await ApiClient.get("/orders");
      return orders || [];
    } catch { return []; }
  },

  async _renderOverview(page) {
    const sec = page.querySelector("#staff-overview");
    if (!sec) return;
    sec.innerHTML = `<div class="loading-pulse" style="height:120px;border-radius:12px;margin-bottom:2rem"></div>`;

    const orders = await this._fetchMyOrders();

    const assigned   = orders.length;
    const completed  = orders.filter((o) => o.status === "Delivered").length;
    const inProgress = orders.filter((o) => o.status === "Being Cleaned").length;

    sec.innerHTML = `
      <div class="dash-stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:2rem">
        <div class="dash-stat-card">
          <div class="dash-stat-icon" style="background:var(--coral-light);color:var(--coral)"><i class="fas fa-tasks"></i></div>
          <div><span class="dash-stat-val">${assigned}</span><span class="dash-stat-label">Assigned Today</span></div>
        </div>
        <div class="dash-stat-card">
          <div class="dash-stat-icon" style="background:#e8f5e9;color:var(--success)"><i class="fas fa-check-circle"></i></div>
          <div><span class="dash-stat-val">${completed}</span><span class="dash-stat-label">Completed Today</span></div>
        </div>
        <div class="dash-stat-card">
          <div class="dash-stat-icon" style="background:#fff8e1;color:var(--yellow-dark)"><i class="fas fa-clock"></i></div>
          <div><span class="dash-stat-val">${inProgress}</span><span class="dash-stat-label">In Progress</span></div>
        </div>
      </div>
      <h3 class="dash-section-title">My Assigned Orders</h3>
      ${orders.length === 0
        ? `<div class="dash-empty-state" style="display:flex">
            <i class="fas fa-clipboard-check"></i>
            <h3>No orders assigned</h3>
            <p>Orders assigned to you will appear here.</p>
           </div>`
        : `<div class="work-queue-wrap">${orders.map((o) => this._queueCard(o)).join("")}</div>`}`;

    this._bindQueueActions(sec);
  },

  async _renderKanban(page) {
    const sec = page.querySelector("#staff-kanban");
    if (!sec) return;
    sec.innerHTML = `<div class="loading-pulse" style="height:300px;border-radius:12px"></div>`;

    const allOrders = await this._fetchAllOrders();

    const cols = [
      { label: "Assigned",    statuses: ["Pending", "Picked Up"] },
      { label: "In Progress", statuses: ["At Facility", "Being Cleaned"] },
      { label: "Ready",       statuses: ["Ready for Delivery"] },
      { label: "Delivered",   statuses: ["Delivered"] },
    ];

    sec.innerHTML = `
      <div class="staff-kanban">
        ${cols.map((col) => {
          const colOrders = allOrders.filter((o) => col.statuses.includes(o.status));
          return `
            <div class="kanban-col">
              <div class="kanban-col-header">
                <span class="kanban-col-title">${col.label}</span>
                <span class="kanban-count">${colOrders.length}</span>
              </div>
              <div class="kanban-cards">
                ${colOrders.length === 0
                  ? '<div class="kanban-empty">No orders</div>'
                  : colOrders.map((o) => `
                      <div class="kanban-card" data-ref="${o.ref || o.id}">
                        <div class="kanban-card-ref">${o.ref || o.id}</div>
                        <div class="kanban-card-name">${o.customer?.name || o.customerName || "—"}</div>
                        <div class="kanban-card-items">
                          ${Array.isArray(o.items)
                            ? o.items.slice(0, 2).join(", ") + (o.items.length > 2 ? ` +${o.items.length - 2}` : "")
                            : "—"}
                        </div>
                        <div class="kanban-card-footer">
                          <span class="kanban-card-tier" style="color:${
                            o.service === "Premium" ? "var(--yellow-dark)"
                            : o.service === "Standard" ? "var(--coral)" : "var(--success)"}">${o.service || ""}</span>
                          <span class="kanban-card-time">
                            <i class="fas fa-clock"></i> ${o.eta ? o.eta.split(" ")[1] || o.eta : "—"}
                          </span>
                        </div>
                      </div>`).join("")}
              </div>
            </div>`;
        }).join("")}
      </div>`;

    sec.querySelectorAll(".kanban-card").forEach((card) => {
      card.addEventListener("click", () => {
        const order = allOrders.find((o) => (o.ref || o.id) === card.dataset.ref);
        if (order) OrderDrawer.open(order);
      });
    });
  },

  async _renderQueue(page) {
    const sec = page.querySelector("#staff-queue");
    if (!sec) return;
    sec.innerHTML = `<div class="loading-pulse" style="height:300px;border-radius:12px"></div>`;

    const allOrders = await this._fetchAllOrders();

    sec.innerHTML = `
      <div class="dash-panel-header" style="margin-bottom:1.5rem">
        <h2>Daily Work Queue</h2>
        <span style="font-size:.85rem;color:var(--mid)">
          ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </span>
      </div>
      ${allOrders.length === 0
        ? `<div class="dash-empty-state" style="display:flex">
            <i class="fas fa-list-ul"></i>
            <h3>No orders in queue</h3>
            <p>All orders will appear here.</p>
           </div>`
        : `<div class="work-queue-wrap">${allOrders.map((o) => this._queueCard(o)).join("")}</div>`}`;

    this._bindQueueActions(sec);
  },

  _queueCard(o) {
    const currentIdx = ORDER_STATUSES.indexOf(o.status);
    const nextStatus = currentIdx >= 0 && currentIdx < ORDER_STATUSES.length - 2
      ? ORDER_STATUSES[currentIdx + 1]
      : null;
    const ref      = o.ref || o.id;
    const customer = o.customer?.name || o.customerName || "—";
    const items    = Array.isArray(o.items) ? o.items : [];
    return `
      <div class="queue-order-card">
        <span class="queue-order-ref">${ref}</span>
        <div class="queue-order-info">
          <div class="queue-order-customer">${customer}</div>
          <div class="queue-order-items">${items.slice(0, 3).join(" · ")}${items.length > 3 ? ` +${items.length - 3}` : ""}</div>
          <div class="queue-order-meta">
            <span><i class="fas fa-map-marker-alt"></i>${o.area || "—"}</span>
            <span><i class="fas fa-clock"></i>ETA ${o.eta || "—"}</span>
            <span>${statusBadge(o.status)}</span>
          </div>
        </div>
        <div class="queue-order-actions">
          ${nextStatus && nextStatus !== "Cancelled"
            ? `<button class="btn btn-primary btn-sm update-status-btn"
                 data-ref="${ref}" data-id="${o.id || ref}" data-next="${nextStatus}">
                 → ${nextStatus.split(" ")[0]}
               </button>`
            : `<span class="status-badge status-delivered">Done</span>`}
          <button class="btn btn-ghost btn-sm view-order-btn" data-ref="${ref}">
            <i class="fas fa-eye"></i>
          </button>
        </div>
      </div>`;
  },

  _bindQueueActions(container) {
    container.querySelectorAll(".view-order-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const order = await ApiClient.get(`/orders/track/${btn.dataset.ref}`);
          if (order) OrderDrawer.open(order);
        } catch { Notify.error("Error", "Could not load order details."); }
      });
    });

    container.querySelectorAll(".update-status-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const oldHTML = btn.innerHTML;
        btn.disabled  = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        try {
          await OrderService.updateOrderStatus(btn.dataset.id || btn.dataset.ref, btn.dataset.next);
          Notify.success("Status Updated", `${btn.dataset.ref} → ${btn.dataset.next}`);
          NotificationCenter.add("status", "Order Status Updated", `${btn.dataset.ref} is now: ${btn.dataset.next}`);
          const page = document.getElementById("page-staff-dashboard");
          if (page) {
            const activeSec = page.querySelector(".staff-section.active");
            if (activeSec) {
              const secId = activeSec.id.replace("staff-", "");
              await this._loadSection(secId, page);
            }
          }
        } catch (err) {
          Notify.error("Update Failed", err.message || "Could not update status.");
          btn.disabled  = false;
          btn.innerHTML = oldHTML;
        }
      });
    });
  },
};

/* ============================================================
   CHECKOUT PAGE
   ============================================================ */
const CheckoutPage = {
  currentOrder: null,

  init() {
    const page = document.getElementById("page-checkout");
    if (!page || page.dataset.built) return;
    page.dataset.built = "1";

    const body = page.querySelector("#checkout-body");
    if (!body) return;

    if (!this.currentOrder) {
      body.innerHTML = `
        <div class="dash-empty-state" style="display:flex">
          <i class="fas fa-shopping-cart"></i>
          <h3>No active order</h3>
          <p>Please create an order first.</p>
          <a href="#/create-order" class="btn btn-primary" data-route="/create-order">Create Order</a>
        </div>`;
      return;
    }

    const o = this.currentOrder;
    body.innerHTML = `
      <div class="checkout-layout">
        <div class="checkout-left">
          <div class="checkout-card">
            <h3 class="checkout-card-title"><i class="fas fa-receipt"></i> Order Summary</h3>
            ${(o.items || []).map((i) => `
              <div class="checkout-summary-row">
                <span>${i.name}</span>
                <span>₦${(i.price || 0).toLocaleString()}</span>
              </div>`).join("")}
            <div class="checkout-summary-row"><span>Subtotal</span><span>₦${(o.subtotal || 0).toLocaleString()}</span></div>
            <div class="checkout-summary-row">
              <span>Delivery</span>
              <span>${o.delivery === 0 ? '<span style="color:var(--success)">Free</span>' : "₦" + (o.delivery || 0).toLocaleString()}</span>
            </div>
            <div class="checkout-summary-total">
              <span>Total</span>
              <span class="checkout-summary-total-amt">₦${(o.total || 0).toLocaleString()}</span>
            </div>
          </div>
          <div class="checkout-card">
            <h3 class="checkout-card-title"><i class="fas fa-map-marker-alt"></i> Delivery Details</h3>
            <div class="checkout-summary-row"><span>Name</span><span>${o.customer || "—"}</span></div>
            <div class="checkout-summary-row"><span>Phone</span><span>${o.phone || "—"}</span></div>
            <div class="checkout-summary-row"><span>Area</span><span>${o.area || "—"}</span></div>
          </div>
        </div>
        <div class="checkout-right">
          <div class="checkout-card">
            <h3 class="checkout-card-title"><i class="fas fa-lock"></i> Payment Method</h3>
            <div class="payment-methods">
              <label class="payment-method-card selected">
                <input type="radio" name="payment" value="flutterwave" checked />
                <div class="payment-method-info">
                  <div class="payment-method-name">
                    Flutterwave <span class="payment-method-badge">Recommended</span>
                  </div>
                  <div class="payment-method-desc">Card, Bank Transfer, USSD, Mobile Money</div>
                </div>
              </label>
              <label class="payment-method-card">
                <input type="radio" name="payment" value="cod" />
                <div class="payment-method-info">
                  <div class="payment-method-name">Pay on Delivery</div>
                  <div class="payment-method-desc">Cash or transfer at delivery</div>
                </div>
              </label>
            </div>
            <div style="margin-top:1.5rem">
              <button class="btn btn-primary btn-block btn-lg" id="pay-now-btn">
                <i class="fas fa-lock"></i> Pay ₦${(o.total || 0).toLocaleString()} Securely
              </button>
              <p style="text-align:center;font-size:.78rem;color:var(--light-text);margin-top:.75rem">
                <i class="fas fa-shield-alt" style="color:var(--success)"></i> 256-bit SSL encrypted.
              </p>
            </div>
          </div>
        </div>
      </div>`;

    body.querySelectorAll(".payment-method-card").forEach((card) => {
      card.querySelector("input")?.addEventListener("change", () => {
        body.querySelectorAll(".payment-method-card").forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
      });
    });

    body.querySelector("#pay-now-btn").addEventListener("click", async () => {
      const method = body.querySelector("input[name=payment]:checked")?.value;
      if (method === "cod") {
        Notify.success("Order Confirmed", "You'll pay on delivery. Pickup will be scheduled shortly.");
        Router.navigate("/");
        return;
      }
      await PaymentFlow.simulate(o);
    });
  },
};

/* ============================================================
   RECEIPT PAGE
   ============================================================ */
const ReceiptPage = {
  currentReceipt: null,

  init() {
    const page = document.getElementById("page-receipt");
    if (!page || page.dataset.built) return;
    page.dataset.built = "1";

    const body = page.querySelector("#receipt-body");
    if (!body) return;

    if (!this.currentReceipt) {
      body.innerHTML = `<div class="dash-empty-state" style="display:flex">
        <i class="fas fa-receipt"></i><h3>No receipt available</h3>
        <p>Complete a payment to view your receipt.</p>
        <a href="#/" class="btn btn-primary" data-route="/">Go Home</a>
      </div>`;
      return;
    }

    const r = this.currentReceipt;
    body.innerHTML = `
      <div class="receipt-card" style="margin:2rem auto">
        <div class="receipt-header">
          <div class="receipt-logo">
            <span class="logo-mark" style="width:30px;height:30px;font-size:.75rem">DM</span>
            <span class="logo-text" style="color:var(--white)">Demarven<strong>Laundry</strong></span>
          </div>
          <div class="receipt-status"><i class="fas fa-check-circle"></i> Payment Confirmed</div>
          <div class="receipt-amount">₦${(r.total || 0).toLocaleString()}</div>
          <div class="receipt-ref">Ref: ${r.flwRef || "—"}</div>
        </div>
        <div class="receipt-body">
          <div class="receipt-row"><span>Date</span><span>${r.date || "—"}</span></div>
          <div class="receipt-row"><span>Customer</span><span>${r.customer || "—"}</span></div>
          <div class="receipt-row"><span>Service</span><span>${r.service || "Standard"}</span></div>
          <div class="receipt-divider"></div>
          ${(r.items || []).map((i) => `
            <div class="receipt-row"><span>${i.name}</span><span>₦${(i.price || 0).toLocaleString()}</span></div>`).join("")}
          <div class="receipt-divider"></div>
          <div class="receipt-row"><span>Subtotal</span><span>₦${(r.subtotal || 0).toLocaleString()}</span></div>
          <div class="receipt-row"><span>Delivery</span><span>${r.delivery === 0 ? "Free" : "₦" + (r.delivery || 0).toLocaleString()}</span></div>
          <div class="receipt-row" style="font-weight:700;font-size:1rem">
            <span>Total Paid</span><span style="color:var(--coral)">₦${(r.total || 0).toLocaleString()}</span>
          </div>
        </div>
        <div class="receipt-actions">
          <button class="btn btn-outline" onclick="window.print()"><i class="fas fa-print"></i> Print</button>
          <a href="#/" data-route="/" class="btn btn-primary"><i class="fas fa-home"></i> Go Home</a>
        </div>
      </div>`;
  },
};

/* ============================================================
   TRANSACTIONS PAGE
   ============================================================ */
const TransactionsPage = {
  async init() {
    const page = document.getElementById("page-transactions");
    if (!page || page.dataset.built) return;
    page.dataset.built = "1";
    const body = page.querySelector("#transactions-body");
    if (body) await this.renderInto(body);
  },

  async renderInto(container) {
    container.innerHTML = `
      <div class="dash-panel-header">
        <h2>Transaction History</h2>
        <input type="text" class="dash-search-input" placeholder="Search by ref or customer..." id="txn-search" />
      </div>
      <div class="txn-table-wrap">
        <table class="txn-table">
          <thead>
            <tr><th>Txn Ref</th><th>Order</th><th>Customer</th><th>Method</th><th>Amount</th><th>Status</th><th>Date</th></tr>
          </thead>
          <tbody id="txn-tbody">
            <tr><td colspan="7"><div class="loading-pulse" style="height:40px;border-radius:8px"></div></td></tr>
          </tbody>
        </table>
      </div>`;

    let rows = [];
    try {
      const { transactions } = await TransactionService.getTransactions();
      rows = transactions || [];
    } catch { /* rows stays [] */ }

    const tbody = container.querySelector("#txn-tbody");
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:3rem">
        <div class="dash-empty-state" style="display:flex">
          <i class="fas fa-receipt"></i>
          <p>No transactions yet. Completed payments will appear here.</p>
        </div></td></tr>`;
      return;
    }

    const renderRows = (data) => data.map((t) => `
      <tr>
        <td>${t.ref || t.id}</td>
        <td style="color:var(--coral)">${t.orderRef || "—"}</td>
        <td style="color:var(--dark);font-weight:500">${t.customer?.name || t.customerName || "—"}</td>
        <td>${t.method || "—"}</td>
        <td class="${t.status === "Cancelled" ? "txn-amount-debit" : "txn-amount-credit"}">
          ₦${(t.amount || 0).toLocaleString()}
        </td>
        <td>${statusBadge(t.status)}</td>
        <td>${t.createdAt ? new Date(t.createdAt).toLocaleString("en-GB") : "—"}</td>
      </tr>`).join("");

    tbody.innerHTML = renderRows(rows);

    container.querySelector("#txn-search")?.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = rows.filter((t) =>
        [t.ref, t.orderRef, t.customer?.name, t.customerName].some((v) => v?.toLowerCase().includes(q))
      );
      tbody.innerHTML = filtered.length
        ? renderRows(filtered)
        : `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--light-text)">No matching transactions.</td></tr>`;
    });
  },
};

/* ============================================================
   PAYMENT FLOW  — uses existing #payment-modal element
   ============================================================ */
const PaymentFlow = {
  _modal: null,

  init() {
    this._modal = document.getElementById("payment-modal");
  },

  async simulate(order) {
    /* TODO: Replace with real Flutterwave / Paystack SDK integration.
       1. Call POST /api/v1/payments/initiate to get a payment link / token
       2. Open the payment gateway modal/redirect
       3. Handle webhook callback on the server
       4. Verify via GET /api/v1/payments/verify/:txRef before showing success */
    this._show("processing", order);
    try {
      await delay(2000);
      this._show("success", order);
    } catch {
      this._show("failure", order);
    }
  },

  _show(state, order) {
    const card = this._modal.querySelector("#payment-modal-card");
    this._modal.classList.add("open");

    if (state === "processing") {
      card.innerHTML = `
        <div class="payment-spinner"><i class="fas fa-circle-notch"></i></div>
        <div class="payment-modal-title">Processing Payment</div>
        <div class="payment-modal-sub">Connecting to Flutterwave. Please wait.</div>
        <div class="payment-modal-amount">₦${(order.total || 0).toLocaleString()}</div>
        <p style="font-size:.78rem;color:var(--light-text);margin-top:1rem">
          <i class="fas fa-lock"></i> Secured by Flutterwave
        </p>`;

    } else if (state === "success") {
      const ref = order.flwRef || "FLW" + Date.now().toString().slice(-8);
      card.innerHTML = `
        <div class="payment-success-icon"><i class="fas fa-check-circle"></i></div>
        <div class="payment-modal-title">Payment Successful!</div>
        <div class="payment-modal-amount">₦${(order.total || 0).toLocaleString()}</div>
        <div class="payment-modal-sub">Transaction Ref: <strong style="font-family:monospace">${ref}</strong></div>
        <div style="margin-top:1.75rem;display:flex;gap:.75rem;flex-direction:column">
          <button class="btn btn-primary btn-block" id="pm-receipt-btn">
            <i class="fas fa-receipt"></i> View Receipt
          </button>
          <button class="btn btn-ghost btn-block" id="pm-track-btn">
            <i class="fas fa-search"></i> Track My Order
          </button>
        </div>`;
      NotificationCenter.add("payment", "Payment Successful",
        `₦${(order.total || 0).toLocaleString()} via Flutterwave · ${order.ref || ref}`);
      card.querySelector("#pm-receipt-btn").addEventListener("click", () => {
        this._close();
        ReceiptPage.currentReceipt = {
          ...order,
          flwRef: ref,
          date: new Date().toLocaleString("en-GB"),
        };
        const rp = document.getElementById("page-receipt");
        if (rp) delete rp.dataset.built;
        Router.navigate("/receipt");
      });
      card.querySelector("#pm-track-btn").addEventListener("click", () => {
        this._close();
        Router.navigate("/track-order");
      });

    } else {
      card.innerHTML = `
        <div class="payment-fail-icon"><i class="fas fa-times-circle"></i></div>
        <div class="payment-modal-title">Payment Failed</div>
        <div class="payment-modal-sub">Your card was declined or there was a network error. No money was charged.</div>
        <div style="margin-top:1.75rem;display:flex;gap:.75rem;flex-direction:column">
          <button class="btn btn-primary btn-block" id="pm-retry-btn">
            <i class="fas fa-redo"></i> Try Again
          </button>
          <button class="btn btn-ghost btn-block" id="pm-cancel-btn">Cancel</button>
        </div>`;
      card.querySelector("#pm-retry-btn").addEventListener("click", () => this.simulate(order));
      card.querySelector("#pm-cancel-btn").addEventListener("click", () => this._close());
    }
  },

  _close() { this._modal.classList.remove("open"); },
};

/* ============================================================
   ORDER DRAWER  — uses existing #order-detail-drawer + #order-overlay
   ============================================================ */
const OrderDrawer = {
  _drawer:  null,
  _overlay: null,

  init() {
    this._drawer  = document.getElementById("order-detail-drawer");
    this._overlay = document.getElementById("order-overlay");
    this._overlay?.addEventListener("click", () => this.close());
  },

  open(order) {
    const ref      = order.ref || order.id || "—";
    const customer = order.customer?.name || order.customerName || "—";
    const phone    = order.customer?.phone || order.phone || "—";
    const email    = order.customer?.email || order.email || "—";
    const timeline = Array.isArray(order.timeline) ? order.timeline : [];
    const items    = Array.isArray(order.items) ? order.items : [];

    this._drawer.innerHTML = `
      <div class="drawer-header">
        <div>
          <h3>Order Details</h3>
          <div style="font-family:monospace;font-size:.82rem;color:rgba(255,255,255,.6);margin-top:.15rem">${ref}</div>
        </div>
        <button class="drawer-close" id="drawer-close-btn"><i class="fas fa-times"></i></button>
      </div>
      <div class="drawer-body">
        <div class="drawer-section">
          <div class="drawer-section-title">Order Info</div>
          <div class="drawer-info-row"><span>Reference</span><span style="font-family:monospace;color:var(--coral)">${ref}</span></div>
          <div class="drawer-info-row"><span>Status</span><span>${statusBadge(order.status)}</span></div>
          <div class="drawer-info-row"><span>Service</span><span>${order.service || "—"}</span></div>
          <div class="drawer-info-row"><span>Total</span><span style="color:var(--coral);font-weight:700">₦${(order.total || 0).toLocaleString()}</span></div>
          <div class="drawer-info-row"><span>Assigned Staff</span><span>${order.staff || "Unassigned"}</span></div>
          <div class="drawer-info-row"><span>ETA</span><span>${order.eta || "—"}</span></div>
        </div>
        <div class="drawer-section">
          <div class="drawer-section-title">Customer</div>
          <div class="drawer-info-row"><span>Name</span><span>${customer}</span></div>
          <div class="drawer-info-row"><span>Phone</span><span><a href="tel:${phone}" style="color:var(--coral)">${phone}</a></span></div>
          <div class="drawer-info-row"><span>Email</span><span>${email}</span></div>
          <div class="drawer-info-row"><span>Area</span><span>${order.area || "—"}</span></div>
        </div>
        <div class="drawer-section">
          <div class="drawer-section-title">Items</div>
          ${items.length
            ? items.map((i) => `
                <div class="drawer-info-row">
                  <span><i class="fas fa-tshirt" style="color:var(--coral);margin-right:.4rem"></i>${i}</span>
                </div>`).join("")
            : `<p style="font-size:.85rem;color:var(--light-text)">No item details available.</p>`}
        </div>
        ${timeline.length ? `
          <div class="drawer-section">
            <div class="drawer-section-title">Status Timeline</div>
            <div class="order-timeline">
              ${timeline.map((t) => `
                <div class="timeline-item">
                  <div class="timeline-dot ${t.done ? "done" : ""} ${t.active ? "active" : ""}"></div>
                  <div class="timeline-time">${t.time || "—"}</div>
                  <div class="timeline-label">${t.status}</div>
                  ${t.note ? `<div class="timeline-note">${t.note}</div>` : ""}
                  ${t.actor && t.actor !== "—" ? `<div class="timeline-actor"><i class="fas fa-user"></i> ${t.actor}</div>` : ""}
                </div>`).join("")}
            </div>
          </div>` : ""}
      </div>
      <div class="drawer-footer">
        <div class="drawer-status-form">
          <select class="drawer-status-select" id="drawer-status-select">
            ${ORDER_STATUSES.map((s) =>
              `<option value="${s}" ${s === order.status ? "selected" : ""}>${s}</option>`
            ).join("")}
          </select>
          <button class="btn btn-primary" id="drawer-update-btn">
            <i class="fas fa-save"></i> Update Status
          </button>
        </div>
      </div>`;

    this._drawer.querySelector("#drawer-close-btn").addEventListener("click", () => this.close());
    this._drawer.querySelector("#drawer-update-btn").addEventListener("click", () => this._updateStatus(order));

    this._drawer.classList.add("open");
    this._overlay.classList.add("open");
  },

  close() {
    this._drawer.classList.remove("open");
    this._overlay.classList.remove("open");
  },

  async _updateStatus(order) {
    const select    = this._drawer.querySelector("#drawer-status-select");
    const newStatus = select.value;
    if (newStatus === order.status) { Notify.info("No change", "Status is already " + newStatus); return; }

    const btn = this._drawer.querySelector("#drawer-update-btn");
    btn.disabled  = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
      await OrderService.updateOrderStatus(order.id || order.ref, newStatus);
      order.status = newStatus;

      const now = new Date().toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
      if (Array.isArray(order.timeline)) {
        const tl = order.timeline.find((t) => t.status === newStatus);
        if (tl) { tl.done = true; tl.active = false; tl.time = now; tl.actor = "Staff"; }
      }

      NotificationCenter.add("status", "Order Status Updated", `${order.ref || order.id} is now: ${newStatus}`);
      Notify.success("Status Updated", `${order.ref || order.id} → ${newStatus}`);
      btn.disabled  = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Update Status';
      this.open(order);
    } catch (err) {
      Notify.error("Update Failed", err.message || "Could not update status.");
      btn.disabled  = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Update Status';
    }
  },
};

/* ============================================================
   NOTIFICATION CENTER  — uses existing static HTML elements
   ============================================================ */
const NotificationCenter = {
  _items:   [],
  _panel:   null,
  _overlay: null,

  async init() {
    this._panel   = document.getElementById("notif-center-panel");
    this._overlay = document.getElementById("notif-overlay");

    // Wire up the existing bell button in the navbar
    const bell = document.getElementById("notif-bell-btn");
    bell?.addEventListener("click", () => this._open());

    // Wire up existing panel controls
    this._overlay?.addEventListener("click", () => this._close());
    document.getElementById("notif-panel-close")?.addEventListener("click", () => this._close());
    document.getElementById("notif-mark-all")?.addEventListener("click", () => this._markAll());

    await this._fetchAndRender();
    this._updateBadge();
  },

  add(type, title, msg) {
    this._items.unshift({ id: Date.now(), type, title, msg, time: "Just now", read: false });
    this._render();
    this._updateBadge();
  },

  _unreadCount() { return this._items.filter((n) => !n.read).length; },

  _open()  { this._panel?.classList.add("open");    this._overlay?.classList.add("open"); },
  _close() { this._panel?.classList.remove("open"); this._overlay?.classList.remove("open"); },

  async _fetchAndRender() {
    try {
      const { notifications } = await NotificationService.getNotifications();
      this._items = notifications || [];
    } catch {
      this._items = [];
    }
    this._render();
    this._updateBadge();
  },

  async _markAll() {
    try {
      await NotificationService.markAllRead();
    } catch { /* optimistic */ }
    this._items.forEach((n) => (n.read = true));
    this._render();
    this._updateBadge();
    Notify.success("All caught up!", "All notifications marked as read.");
  },

  _updateBadge() {
    const badge = document.getElementById("notif-bell-badge");
    if (!badge) return;
    const count = this._unreadCount();
    badge.style.display = count > 0 ? "flex" : "none";
    badge.textContent   = count > 9 ? "9+" : count;
  },

  _render() {
    const list = document.getElementById("notif-list");
    if (!list) return;
    if (!this._items.length) {
      list.innerHTML = `<div class="notif-empty"><i class="fas fa-bell-slash"></i><p>No notifications yet</p></div>`;
      return;
    }
    const iconMap = {
      order:   ["notif-icon-order",   "fa-shopping-bag"],
      payment: ["notif-icon-payment", "fa-credit-card"],
      status:  ["notif-icon-status",  "fa-truck"],
      system:  ["notif-icon-system",  "fa-info-circle"],
    };
    list.innerHTML = this._items.map((n) => {
      const [cls, icon] = iconMap[n.type] || iconMap.system;
      return `
        <div class="notif-item ${n.read ? "" : "unread"}" data-id="${n.id}">
          <div class="notif-item-icon ${cls}"><i class="fas ${icon}"></i></div>
          <div class="notif-item-body">
            <div class="notif-item-title">${n.title}</div>
            <div class="notif-item-msg">${n.msg}</div>
            <div class="notif-item-time"><i class="fas fa-clock"></i> ${n.time}</div>
          </div>
          ${!n.read ? '<div class="notif-unread-dot"></div>' : ""}
        </div>`;
    }).join("");

    list.querySelectorAll(".notif-item").forEach((el) => {
      el.addEventListener("click", async () => {
        const n = this._items.find((x) => x.id === +el.dataset.id || x.id === el.dataset.id);
        if (n && !n.read) {
          try { await NotificationService.markRead(n.id); } catch { /* optimistic */ }
          n.read = true;
          this._updateBadge();
          this._render();
        }
      });
    });
  },
};

/* ============================================================
   MODAL SYSTEM  — uses existing #global-modal-overlay element
   ============================================================ */
const Modal = {
  _overlay: null,
  _card:    null,

  init() {
    this._overlay = document.getElementById("global-modal-overlay");
    this._card    = document.getElementById("global-modal-card");
    this._overlay?.addEventListener("click", (e) => { if (e.target === this._overlay) this.close(); });
  },

  open({ title, body, footer = "" }) {
    this._card.innerHTML = `
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" id="modal-close-btn"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ""}`;
    this._card.querySelector("#modal-close-btn").addEventListener("click", () => this.close());
    this._overlay.classList.add("open");
  },

  close() { this._overlay.classList.remove("open"); },
};

/* ============================================================
   ANALYTICS
   ============================================================ */
const Analytics = {
  _currentPeriod: "7d",

  async renderAll(container) {
    container.innerHTML = `
      <div class="dash-panel-header">
        <h2>Analytics</h2>
        <div class="analytics-filters">
          ${["7d","30d","90d","all"].map((p, i) =>
            `<button class="date-filter-btn ${i === 0 ? "active" : ""}" data-period="${p}">
              ${p === "7d" ? "Last 7 Days" : p === "30d" ? "Last 30 Days" : p === "90d" ? "Last 90 Days" : "All Time"}
            </button>`).join("")}
        </div>
      </div>
      <div class="analytics-grid" id="analytics-kpis" style="grid-template-columns:repeat(3,1fr)">
        ${Array(6).fill('<div class="analytics-kpi loading-pulse" style="min-height:90px"></div>').join("")}
      </div>
      <div class="analytics-two-col" style="margin-top:1.5rem">
        <div class="chart-card">
          <div class="chart-card-header">
            <div class="chart-card-title"><i class="fas fa-chart-bar" style="color:var(--coral);margin-right:.4rem"></i>Revenue by Day</div>
          </div>
          <div class="chart-wrap" id="revenue-chart-wrap">
            <div class="loading-pulse" style="height:200px;border-radius:8px"></div>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <div class="chart-card-title"><i class="fas fa-chart-pie" style="color:var(--coral);margin-right:.4rem"></i>Service Mix</div>
          </div>
          <div id="service-donut-wrap" style="margin-top:.5rem">
            <div class="loading-pulse" style="height:130px;border-radius:8px"></div>
          </div>
        </div>
      </div>
      <div class="chart-card" style="margin-top:1.5rem">
        <div class="chart-card-header">
          <div class="chart-card-title"><i class="fas fa-users" style="color:var(--coral);margin-right:.4rem"></i>Customer Growth</div>
        </div>
        <div class="chart-wrap" id="growth-chart-wrap">
          <div class="loading-pulse" style="height:180px;border-radius:8px"></div>
        </div>
      </div>`;

    await this._loadAll(container);

    container.querySelectorAll(".date-filter-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        container.querySelectorAll(".date-filter-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this._currentPeriod = btn.dataset.period;
        await this._loadAll(container);
      });
    });
  },

  async _loadAll(container) {
    await Promise.all([
      this._loadKPIs(container),
      this._loadRevenueChart(container),
      this._loadDonut(container),
      this._loadGrowthChart(container),
    ]);
  },

  async _loadKPIs(container) {
    const grid = container.querySelector("#analytics-kpis");
    if (!grid) return;
    try {
      const { kpis } = await AnalyticsService.getKPIs(this._currentPeriod);
      if (!kpis || kpis.length === 0) {
        grid.innerHTML = `<div class="dash-empty-state" style="display:flex;grid-column:1/-1">
          <i class="fas fa-chart-line"></i><p>No analytics data for this period.</p>
        </div>`;
        return;
      }
      grid.innerHTML = kpis.map((k) => `
        <div class="analytics-kpi">
          <div class="analytics-kpi-label">
            <i class="fas ${k.icon}" style="color:var(--coral);margin-right:.3rem"></i>${k.label}
          </div>
          <div class="analytics-kpi-val">${k.val ?? "—"}</div>
          ${k.change != null ? `
          <div class="analytics-kpi-change ${k.up ? "kpi-up" : "kpi-down"}">
            <i class="fas fa-arrow-${k.up ? "up" : "down"}"></i> ${k.change} vs last period
          </div>` : ""}
        </div>`).join("");
    } catch {
      grid.innerHTML = `<div class="error-state" style="grid-column:1/-1">
        <i class="fas fa-exclamation-circle"></i><p>Could not load KPIs.</p>
      </div>`;
    }
  },

  async _loadRevenueChart(container) {
    const wrap = container.querySelector("#revenue-chart-wrap");
    if (!wrap) return;
    try {
      const { days, labels } = await AnalyticsService.getRevenue(this._currentPeriod);
      if (!days || days.length === 0) {
        wrap.innerHTML = `<div class="dash-empty-state" style="display:flex"><i class="fas fa-chart-bar"></i><p>No revenue data.</p></div>`;
        return;
      }
      this._renderBarChart(wrap, days, labels);
    } catch {
      wrap.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-circle"></i><p>Could not load revenue data.</p></div>`;
    }
  },

  _renderBarChart(wrap, data, labels) {
    const max  = Math.max(...data, 1);
    const W    = 600, H = 200, pad = 30;
    const barW = (W - pad * 2) / data.length - 6;
    const bars = data.map((v, i) => {
      const bH = Math.round((v / max) * H * 0.85);
      const x  = pad + i * ((W - pad * 2) / data.length) + 3;
      const y  = H - bH;
      return `
        <rect class="bar-chart-bar" x="${x}" y="${y}" width="${barW}" height="${bH}" rx="4">
          <title>₦${v.toLocaleString()}</title>
        </rect>
        <text class="bar-chart-label" x="${x + barW / 2}" y="${H + 16}">${labels[i] || i}</text>
        <text class="bar-chart-value" x="${x + barW / 2}" y="${y - 4}">₦${Math.round(v / 1000)}k</text>`;
    }).join("");
    wrap.innerHTML = `
      <svg class="bar-chart-svg" viewBox="0 0 ${W} ${H + 30}" preserveAspectRatio="none">
        <line class="bar-chart-grid" x1="${pad}" y1="0" x2="${pad}" y2="${H}"/>
        ${bars}
      </svg>`;
  },

  async _loadDonut(container) {
    const wrap = container.querySelector("#service-donut-wrap");
    if (!wrap) return;
    try {
      const { breakdown } = await AnalyticsService.getServiceMix();
      if (!breakdown || breakdown.length === 0) {
        wrap.innerHTML = `<div class="dash-empty-state" style="display:flex"><i class="fas fa-chart-pie"></i><p>No service data.</p></div>`;
        return;
      }
      this._renderDonut(wrap, breakdown);
    } catch {
      wrap.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-circle"></i><p>Could not load service mix.</p></div>`;
    }
  },

  _renderDonut(wrap, data) {
    const r = 52, cx = 65, cy = 65, C = 2 * Math.PI * r;
    let offset = 0;
    const segments = data.map((d) => {
      const dash = (d.pct / 100) * C;
      const seg  = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color}"
        stroke-width="14" stroke-dasharray="${dash} ${C - dash}"
        stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})">
        <title>${d.label}: ${d.pct}%</title></circle>`;
      offset += dash;
      return seg;
    }).join("");
    wrap.innerHTML = `
      <div class="donut-wrap">
        <svg class="donut-svg" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r="${r}" fill="none" stroke="var(--border)" stroke-width="14"/>
          ${segments}
        </svg>
        <div class="donut-legend">
          ${data.map((d) => `
            <div class="donut-legend-item">
              <div class="donut-legend-dot" style="background:${d.color}"></div>
              ${d.label} <strong>${d.pct}%</strong>
            </div>`).join("")}
        </div>
      </div>`;
  },

  async _loadGrowthChart(container) {
    const wrap = container.querySelector("#growth-chart-wrap");
    if (!wrap) return;
    try {
      const { growth, labels } = await AnalyticsService.getCustomerGrowth();
      if (!growth || growth.length === 0) {
        wrap.innerHTML = `<div class="dash-empty-state" style="display:flex"><i class="fas fa-users"></i><p>No growth data.</p></div>`;
        return;
      }
      this._renderGrowthChart(wrap, growth, labels);
    } catch {
      wrap.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-circle"></i><p>Could not load growth data.</p></div>`;
    }
  },

  _renderGrowthChart(wrap, data, labels) {
    const W = 500, H = 160, pad = 30;
    const max = Math.max(...data, 1);
    const pts = data.map((v, i) => {
      const x = pad + i * ((W - pad * 2) / (data.length - 1));
      const y = H - (v / max) * H * 0.85 - 10;
      return `${x},${y}`;
    });
    const areaBottom = `${pad},${H} ${W - pad},${H}`;
    wrap.innerHTML = `
      <svg viewBox="0 0 ${W} ${H + 20}" style="width:100%;height:${H + 20}px" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="var(--coral)" stop-opacity=".3"/>
            <stop offset="100%" stop-color="var(--coral)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <polygon points="${pts.join(" ")} ${areaBottom}" class="line-chart-area"/>
        <polyline points="${pts.join(" ")}" class="line-chart-path"/>
        ${data.map((v, i) => {
          const x = pad + i * ((W - pad * 2) / (data.length - 1));
          const y = H - (v / max) * H * 0.85 - 10;
          return `
            <circle cx="${x}" cy="${y}" r="4" class="line-chart-dot"/>
            <text x="${x}" y="${H + 16}" style="font-size:10px;fill:var(--light-text);text-anchor:middle;font-family:var(--font-body)">${labels[i] || i}</text>`;
        }).join("")}
      </svg>`;
  },
};

/* ============================================================
   PRICING MANAGER  (admin section)
   ============================================================ */
const PricingManager = {
  _items: [],

  async renderTable(container) {
    container.innerHTML = `
      <div class="pricing-mgmt-header">
        <h2 style="font-family:var(--font-display);font-size:1.4rem;font-weight:700">Manage Pricing</h2>
        <div style="display:flex;gap:.75rem">
          <input type="text" placeholder="Search items..." class="dash-search-input" id="pricing-search" />
          <button class="btn btn-primary" id="add-pricing-btn"><i class="fas fa-plus"></i> Add Item</button>
        </div>
      </div>
      <div class="pricing-mgmt-table-wrap">
        <table class="pricing-mgmt-table">
          <thead><tr><th>Item</th><th>Category</th><th>Basic</th><th>Standard</th><th>Premium</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="pricing-tbody">
            <tr><td colspan="7"><div class="loading-pulse" style="height:40px;border-radius:8px"></div></td></tr>
          </tbody>
        </table>
      </div>`;

    try {
      const { items } = await PricingService.getPricing();
      this._items = items || [];
    } catch {
      this._items = [];
    }

    container.querySelector("#pricing-tbody").innerHTML = this._rows();
    this._bindTableEvents(container);
  },

  _rows(filter = "") {
    const filtered = this._items.filter((i) =>
      !filter || i.name.toLowerCase().includes(filter) || i.category.toLowerCase().includes(filter)
    );
    if (!filtered.length) {
      return `<tr><td colspan="7">
        <div class="dash-empty-state" style="display:flex">
          <i class="fas fa-tags"></i>
          <p>${filter ? "No items match your search." : "No pricing items yet. Add the first one."}</p>
        </div>
      </td></tr>`;
    }
    return filtered.map((i) => `
      <tr>
        <td>${i.name}</td>
        <td>${i.category}</td>
        <td class="price-val">${i.basic    ? "₦" + i.basic.toLocaleString()    : "—"}</td>
        <td class="price-val">${i.standard ? "₦" + i.standard.toLocaleString() : "—"}</td>
        <td class="price-val">${i.premium  ? "₦" + i.premium.toLocaleString()  : "—"}</td>
        <td><span class="${i.enabled ? "pricing-enabled" : "pricing-disabled"}">
          <i class="fas fa-circle" style="font-size:.5rem;margin-right:.3rem"></i>
          ${i.enabled ? "Active" : "Disabled"}
        </span></td>
        <td style="display:flex;gap:.4rem">
          <button class="btn btn-ghost btn-sm pricing-edit-btn"   data-id="${i.id}"><i class="fas fa-edit"></i></button>
          <button class="btn btn-ghost btn-sm pricing-toggle-btn" data-id="${i.id}">
            <i class="fas fa-${i.enabled ? "ban" : "check"}"></i>
          </button>
        </td>
      </tr>`).join("");
  },

  _bindTableEvents(container) {
    container.querySelector("#pricing-search")?.addEventListener("input", (e) => {
      container.querySelector("#pricing-tbody").innerHTML = this._rows(e.target.value.toLowerCase());
      this._bindRowEvents(container);
    });
    container.querySelector("#add-pricing-btn")?.addEventListener("click", () => this._openForm(null, container));
    this._bindRowEvents(container);
  },

  _bindRowEvents(container) {
    container.querySelectorAll(".pricing-edit-btn").forEach((btn) =>
      btn.addEventListener("click", () =>
        this._openForm(this._items.find((i) => i.id == btn.dataset.id), container)
      )
    );
    container.querySelectorAll(".pricing-toggle-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const item = this._items.find((i) => i.id == btn.dataset.id);
        if (!item) return;
        try {
          await PricingService.toggleItem(item.id, !item.enabled);
          item.enabled = !item.enabled;
          Notify.success(item.enabled ? "Enabled" : "Disabled", `${item.name} updated.`);
          container.querySelector("#pricing-tbody").innerHTML = this._rows();
          this._bindRowEvents(container);
        } catch (err) {
          Notify.error("Failed", err.message || "Could not update item.");
        }
      })
    );
  },

  _openForm(item, container) {
    const CATS = [
      "Everyday Laundry", "Corporate / Formal", "Native & Traditional",
      "Ladies' Wear", "Bedding & Home", "Extras",
    ];
    Modal.open({
      title: item ? `Edit — ${item.name}` : "Add Pricing Item",
      body: `
        <div class="form-group">
          <label>Category</label>
          <select id="DM-category">
            ${CATS.map((c) => `<option ${item?.category === c ? "selected" : ""}>${c}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label>Item Name</label>
          <input type="text" id="DM-name" value="${item?.name || ""}" placeholder="e.g. Kaftan" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Basic (₦)</label>
            <input type="number" id="DM-basic" value="${item?.basic || ""}" placeholder="Leave blank if N/A" />
          </div>
          <div class="form-group">
            <label>Standard (₦)</label>
            <input type="number" id="DM-standard" value="${item?.standard || ""}" placeholder="Leave blank if N/A" />
          </div>
        </div>
        <div class="form-group">
          <label>Premium (₦)</label>
          <input type="number" id="DM-premium" value="${item?.premium || ""}" placeholder="Leave blank if N/A" />
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" id="save-pricing-btn"><i class="fas fa-save"></i> Save</button>`,
    });
    document.getElementById("save-pricing-btn")?.addEventListener("click", async () => {
      const name = document.getElementById("DM-name")?.value.trim();
      if (!name) { Notify.error("Missing field", "Item name is required."); return; }
      const payload = {
        category: document.getElementById("DM-category").value,
        name,
        basic:    +document.getElementById("DM-basic").value    || null,
        standard: +document.getElementById("DM-standard").value || null,
        premium:  +document.getElementById("DM-premium").value  || null,
      };
      const btn = document.getElementById("save-pricing-btn");
      btn.disabled  = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      try {
        if (item) {
          const updated = await PricingService.updateItem(item.id, payload);
          Object.assign(item, updated.item || payload);
          Notify.success("Updated", `${name} pricing updated.`);
        } else {
          const created = await PricingService.createItem({ ...payload, enabled: true });
          this._items.push(created.item || { id: Date.now(), ...payload, enabled: true });
          Notify.success("Item Added", `${name} has been added.`);
        }
        Modal.close();
        container.querySelector("#pricing-tbody").innerHTML = this._rows();
        this._bindRowEvents(container);
      } catch (err) {
        Notify.error("Save Failed", err.message || "Could not save item.");
        btn.disabled  = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Save';
      }
    });
  },
};

/* ============================================================
   STAFF MANAGER  (admin section)
   ============================================================ */
const StaffManager = {
  _staff: [],

  async renderGrid(container) {
    container.innerHTML = `
      <div class="dash-panel-header">
        <h2>Staff Management</h2>
        <div style="display:flex;gap:.75rem">
          <select class="dash-filter-select" id="staff-role-filter">
            <option value="">All Roles</option>
            <option value="rider">Riders</option>
            <option value="cleaner">Cleaners</option>
          </select>
          <button class="btn btn-primary" id="add-staff-btn">
            <i class="fas fa-user-plus"></i> Add Staff
          </button>
        </div>
      </div>
      <div class="staff-card-grid" id="staff-card-grid">
        ${Array(3).fill('<div class="staff-card loading-pulse" style="min-height:220px"></div>').join("")}
      </div>`;

    try {
      const { staff } = await StaffService.getStaff();
      this._staff = staff || [];
    } catch {
      this._staff = [];
    }

    const grid = container.querySelector("#staff-card-grid");
    if (grid) {
      grid.innerHTML = this._staff.length
        ? this._staff.map((s) => this._card(s)).join("")
        : `<div class="dash-empty-state" style="display:flex;grid-column:1/-1">
            <i class="fas fa-users"></i>
            <h3>No staff members yet</h3>
            <p>Add your first team member to get started.</p>
           </div>`;
    }
    this._bindGridEvents(container);
  },

  _card(s) {
    const activeOrders    = s.activeOrders    ?? s.orders    ?? 0;
    const completedOrders = s.completedOrders ?? s.completed ?? 0;
    const workload  = Math.min(100, Math.round((activeOrders / 12) * 100));
    const wlClass   = workload > 70 ? "busy" : workload > 40 ? "moderate" : "light";
    const initials  = (s.name || "").split(" ").map((w) => w[0]).join("").substring(0, 2);
    return `
      <div class="staff-card ${s.enabled ? "" : "disabled"}" data-role="${s.role}">
        <div class="staff-card-avatar" style="background:${s.color || "var(--coral)"}">${initials}</div>
        <div class="staff-card-name">${s.name}</div>
        <div class="staff-card-role">
          <span class="role-badge role-staff">
            <i class="fas fa-${s.role === "rider" ? "motorcycle" : "soap"}"></i> ${s.role}
          </span>
        </div>
        <div class="staff-card-stats">
          <div class="staff-stat">
            <span class="staff-stat-val">${activeOrders}</span>
            <span class="staff-stat-label">Active</span>
          </div>
          <div class="staff-stat">
            <span class="staff-stat-val">${completedOrders}</span>
            <span class="staff-stat-label">Done</span>
          </div>
        </div>
        <div class="staff-workload-bar">
          <div class="staff-workload-fill ${wlClass}" style="width:${workload}%"></div>
        </div>
        <div style="font-size:.72rem;color:var(--light-text);text-align:center;margin:.25rem 0 .75rem">
          Workload: ${workload}%
        </div>
        <div class="staff-card-actions">
          <button class="btn btn-ghost btn-sm staff-assign-btn" data-id="${s.id}" title="Assign Order">
            <i class="fas fa-tasks"></i>
          </button>
          <button class="btn btn-ghost btn-sm staff-edit-btn" data-id="${s.id}" title="Edit">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-ghost btn-sm staff-toggle-btn" data-id="${s.id}" title="${s.enabled ? "Disable" : "Enable"}">
            <i class="fas fa-${s.enabled ? "ban" : "check"}"></i>
          </button>
        </div>
      </div>`;
  },

  _bindGridEvents(container) {
    container.querySelector("#add-staff-btn")?.addEventListener("click", () => this._openForm(null, container));
    container.querySelector("#staff-role-filter")?.addEventListener("change", (e) => {
      const role = e.target.value;
      container.querySelectorAll(".staff-card").forEach((card) => {
        card.style.display = !role || card.dataset.role === role ? "" : "none";
      });
    });
    container.querySelectorAll(".staff-edit-btn").forEach((btn) =>
      btn.addEventListener("click", () =>
        this._openForm(this._staff.find((s) => s.id == btn.dataset.id), container)
      )
    );
    container.querySelectorAll(".staff-toggle-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const s = this._staff.find((m) => m.id == btn.dataset.id);
        if (!s) return;
        try {
          await StaffService.toggleStaff(s.id, !s.enabled);
          s.enabled = !s.enabled;
          Notify.success(s.enabled ? "Enabled" : "Disabled", `${s.name} has been ${s.enabled ? "reactivated" : "disabled"}.`);
          this.renderGrid(container);
        } catch (err) {
          Notify.error("Failed", err.message || "Could not update staff status.");
        }
      })
    );
    container.querySelectorAll(".staff-assign-btn").forEach((btn) =>
      btn.addEventListener("click", () => this._openAssign(btn.dataset.id))
    );
  },

  _openForm(s, container) {
    Modal.open({
      title: s ? `Edit — ${s.name}` : "Add Staff Member",
      body: `
        <div class="form-group">
          <label>Full Name *</label>
          <input type="text" id="sf-name" value="${s?.name || ""}" placeholder="e.g. Emeka Adeyemi" />
        </div>
        <div class="form-group">
          <label>Role</label>
          <select id="sf-role">
            <option value="cleaner"    ${s?.role === "cleaner"    ? "selected" : ""}>Cleaner</option>
            <option value="rider"      ${s?.role === "rider"      ? "selected" : ""}>Rider / Courier</option>
            <option value="supervisor" ${s?.role === "supervisor" ? "selected" : ""}>Supervisor</option>
          </select>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="sf-email" value="${s?.email || ""}" placeholder="staff@Demarven.ng" />
        </div>
        <div class="form-group">
          <label>Phone</label>
          <input type="tel" id="sf-phone" value="${s?.phone || ""}" placeholder="+234 800 000 0000" />
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" id="save-staff-btn"><i class="fas fa-save"></i> Save</button>`,
    });
    document.getElementById("save-staff-btn")?.addEventListener("click", async () => {
      const name = document.getElementById("sf-name")?.value.trim();
      if (!name) { Notify.error("Missing Info", "Name is required."); return; }
      const payload = {
        name,
        role:  document.getElementById("sf-role").value,
        email: document.getElementById("sf-email").value,
        phone: document.getElementById("sf-phone").value,
      };
      const btn = document.getElementById("save-staff-btn");
      btn.disabled  = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      try {
        if (s) {
          const updated = await StaffService.updateStaff(s.id, payload);
          Object.assign(s, updated.staff || payload);
          Notify.success("Updated", `${s.name}'s profile updated.`);
        } else {
          const COLORS = ["#FF4B7D","#4FACFE","#FFB830","#27AE60","#9C27B0"];
          const created = await StaffService.createStaff(payload);
          this._staff.push(created.staff || {
            id: Date.now(), ...payload,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            enabled: true, activeOrders: 0, completedOrders: 0,
          });
          Notify.success("Staff Added", `${name} has been added to the team.`);
        }
        Modal.close();
        this.renderGrid(container);
      } catch (err) {
        Notify.error("Save Failed", err.message || "Could not save staff member.");
        btn.disabled  = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Save';
      }
    });
  },

  async _openAssign(staffId) {
    const s = this._staff.find((m) => m.id == staffId);
    if (!s) return;

    let orders = [];
    try {
      const res = await ApiClient.get("/orders?status=Pending,Picked Up,At Facility");
      orders = res.orders || [];
    } catch { /* empty list shown */ }

    Modal.open({
      title: `Assign Orders to ${s.name}`,
      body: `
        <p style="font-size:.88rem;color:var(--mid);margin-bottom:1rem">
          Select orders to assign to this staff member:
        </p>
        ${orders.length === 0
          ? `<div class="dash-empty-state" style="display:flex">
              <i class="fas fa-inbox"></i><p>No unassigned orders available.</p>
             </div>`
          : `<div class="assign-order-list">
              ${orders.map((o) => `
                <label class="assign-order-item">
                  <input type="checkbox" value="${o.ref || o.id}" style="width:auto;accent-color:var(--coral)" />
                  <div style="flex:1;margin-left:.5rem">
                    <div style="font-size:.87rem;font-weight:600;color:var(--dark)">${o.ref || o.id} — ${o.customer?.name || "—"}</div>
                    <div style="font-size:.78rem;color:var(--mid)">
                      ${Array.isArray(o.items) ? o.items.join(", ") : "—"} · ${statusBadge(o.status)}
                    </div>
                  </div>
                </label>`).join("")}
             </div>`}`,
      footer: orders.length ? `
        <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" id="do-assign-btn"><i class="fas fa-check"></i> Assign Selected</button>` : `
        <button class="btn btn-ghost btn-block" onclick="Modal.close()">Close</button>`,
    });

    document.getElementById("do-assign-btn")?.addEventListener("click", async () => {
      const checked = Array.from(document.querySelectorAll("#global-modal-card input[type=checkbox]:checked"));
      if (!checked.length) { Notify.error("Nothing selected", "Select at least one order."); return; }
      const refs = checked.map((cb) => cb.value);
      const btn  = document.getElementById("do-assign-btn");
      btn.disabled  = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      try {
        await StaffService.assignOrders(s.id, refs);
        Notify.success("Orders Assigned", `${refs.length} order(s) assigned to ${s.name}.`);
        Modal.close();
      } catch (err) {
        Notify.error("Assignment Failed", err.message || "Could not assign orders.");
        btn.disabled  = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Assign Selected';
      }
    });
  },
};

/* ============================================================
   CUSTOMER MANAGER  (admin section)
   ============================================================ */
const CustomerManager = {
  _customers: [],

  async renderTable(container) {
    container.innerHTML = `
      <div class="dash-panel-header">
        <h2>Customers</h2>
        <input type="text" class="dash-search-input" placeholder="Search customers..." id="customer-search" />
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Area</th><th>Orders</th><th>Spent</th><th>Joined</th><th>Action</th></tr></thead>
          <tbody id="customers-tbody">
            <tr><td colspan="8"><div class="loading-pulse" style="height:40px;border-radius:8px"></div></td></tr>
          </tbody>
        </table>
      </div>`;

    try {
      const { customers } = await CustomerService.getCustomers();
      this._customers = customers || [];
    } catch {
      this._customers = [];
    }

    container.querySelector("#customers-tbody").innerHTML = this._rows();
    this._bindEvents(container);
  },

  _rows(filter = "") {
    const filtered = this._customers.filter((c) =>
      !filter || c.name.toLowerCase().includes(filter) || c.email.toLowerCase().includes(filter)
    );
    if (!filtered.length) {
      return `<tr><td colspan="8">
        <div class="dash-empty-state" style="display:flex">
          <i class="fas fa-users"></i>
          <p>${filter ? "No customers match your search." : "No customers yet."}</p>
        </div>
      </td></tr>`;
    }
    return filtered.map((c) => `
      <tr>
        <td>
          <strong>${c.name}</strong>
          ${c.tags?.includes("VIP") ? '<span class="customer-tag vip" style="margin-left:.4rem">VIP</span>' : ""}
        </td>
        <td>${c.email}</td>
        <td>${c.phone || "—"}</td>
        <td>${c.area || "—"}</td>
        <td>${c.orders ?? "—"}</td>
        <td style="color:var(--coral);font-weight:700">₦${(c.totalSpent || 0).toLocaleString()}</td>
        <td>${c.joinedAt ? new Date(c.joinedAt).toLocaleDateString("en-GB") : "—"}</td>
        <td>
          <button class="btn btn-ghost btn-sm view-customer-btn" data-id="${c.id}">
            <i class="fas fa-eye"></i> View
          </button>
        </td>
      </tr>`).join("");
  },

  _bindEvents(container) {
    container.querySelector("#customer-search")?.addEventListener("input", (e) => {
      container.querySelector("#customers-tbody").innerHTML = this._rows(e.target.value.toLowerCase());
      this._bindViewButtons(container);
    });
    this._bindViewButtons(container);
  },

  _bindViewButtons(container) {
    container.querySelectorAll(".view-customer-btn").forEach((btn) =>
      btn.addEventListener("click", () => this._openDetail(btn.dataset.id))
    );
  },

  async _openDetail(id) {
    const c = this._customers.find((x) => x.id == id);
    if (!c) return;

    let orders = [];
    try {
      const res = await ApiClient.get(`/orders?customerId=${id}`);
      orders = res.orders || [];
    } catch { /* empty */ }

    const initials = (c.name || "").split(" ").map((w) => w[0]).join("").substring(0, 2);
    const avgOrder = c.orders ? Math.round((c.totalSpent || 0) / c.orders) : 0;

    Modal.open({
      title: `Customer — ${c.name}`,
      body: `
        <div style="text-align:center;margin-bottom:1.5rem">
          <div class="customer-avatar-lg" style="margin:0 auto 1rem">${initials}</div>
          <div class="customer-name">${c.name}</div>
          <div class="customer-email">${c.email}</div>
          <div class="customer-tags" style="justify-content:center;margin-top:.5rem">
            ${c.tags?.length
              ? c.tags.map((t) => `<span class="customer-tag ${t.toLowerCase()}">${t}</span>`).join("")
              : '<span class="customer-tag">Regular</span>'}
          </div>
          <div class="customer-stats" style="max-width:200px;margin:.75rem auto 0">
            <div class="customer-stat">
              <span class="customer-stat-val">${c.orders ?? "—"}</span>
              <span class="customer-stat-label">Orders</span>
            </div>
            <div class="customer-stat">
              <span class="customer-stat-val" style="font-size:1rem">₦${Math.round((c.totalSpent || 0) / 1000)}k</span>
              <span class="customer-stat-label">Spent</span>
            </div>
          </div>
        </div>
        <div class="drawer-section-title">Contact Info</div>
        <div class="drawer-info-row"><span>Phone</span><span><a href="tel:${c.phone}" style="color:var(--coral)">${c.phone || "—"}</a></span></div>
        <div class="drawer-info-row"><span>Area</span><span>${c.area || "—"}</span></div>
        <div class="drawer-info-row"><span>Member Since</span><span>${c.joinedAt ? new Date(c.joinedAt).toLocaleDateString("en-GB") : "—"}</span></div>
        <div class="drawer-info-row"><span>Last Order</span><span>${c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString("en-GB") : "—"}</span></div>
        ${orders.length ? `
          <div class="drawer-section-title" style="margin-top:1.25rem">Order History</div>
          ${orders.map((o) => `
            <div class="drawer-info-row">
              <span style="font-family:monospace;color:var(--coral)">${o.ref || o.id}</span>
              <span>${statusBadge(o.status)}</span>
            </div>`).join("")}` : ""}
        <div class="drawer-section-title" style="margin-top:1.25rem">Payment Summary</div>
        <div class="drawer-info-row"><span>Total Paid</span><span style="color:var(--coral);font-weight:700">₦${(c.totalSpent || 0).toLocaleString()}</span></div>
        <div class="drawer-info-row"><span>Avg Order Value</span><span>${avgOrder ? "₦" + avgOrder.toLocaleString() : "—"}</span></div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
        <button class="btn btn-primary" onclick="Notify.info('Coming Soon','Customer editing coming soon.')">
          <i class="fas fa-edit"></i> Edit
        </button>`,
    });
  },
};

/* ============================================================
   ROLE GUARD
   ============================================================ */
const RoleGuard = {
  _hierarchy: { customer: 0, staff: 1, admin: 2 },
  getRole() {
    try { return JSON.parse(localStorage.getItem("DM_user") || "{}").role || ROLES.CUSTOMER; }
    catch { return ROLES.CUSTOMER; }
  },
  can(role, required) {
    return (this._hierarchy[role] || 0) >= (this._hierarchy[required] || 0);
  },
};

/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */
function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

function statusBadge(status) {
  return `<span class="status-badge ${STATUS_CLASSES[status] || ""}">${status || "Unknown"}</span>`;
}

function bindPasswordToggles(root = document) {
  root.querySelectorAll(".toggle-pw").forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      target.type = target.type === "text" ? "password" : "text";
      btn.querySelector("i").className = target.type === "text" ? "fas fa-eye-slash" : "fas fa-eye";
    });
  });
}

/* ============================================================
   GLOBAL UI
   ============================================================ */
function initGlobalUI() {
  document.getElementById("ann-close")?.addEventListener("click", () => {
    document.getElementById("announcement-bar")?.remove();
  });

  const hamburger = document.getElementById("hamburger");
  const navLinks  = document.getElementById("nav-links");
  hamburger?.addEventListener("click", () => {
    hamburger.classList.toggle("open");
    navLinks?.classList.toggle("open");
  });

  const navbar = document.getElementById("navbar");
  window.addEventListener("scroll", () => {
    navbar?.classList.toggle("scrolled", window.scrollY > 50);
    document.getElementById("scroll-top")?.classList.toggle("visible", window.scrollY > 400);
  }, { passive: true });

  document.getElementById("scroll-top")?.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" })
  );

  bindPasswordToggles();

  document.getElementById("contact-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.currentTarget.querySelector('[type="submit"]');
    btn.disabled  = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    try {
      await ApiClient.post("/contact", {
        name:    e.currentTarget.querySelector("#contact-name")?.value,
        email:   e.currentTarget.querySelector("#contact-email")?.value,
        phone:   e.currentTarget.querySelector("#contact-phone")?.value,
        subject: e.currentTarget.querySelector("#contact-subject")?.value,
        message: e.currentTarget.querySelector("#contact-msg")?.value,
      });
      Notify.success("Message Sent!", "We'll get back to you within 24 hours.");
      e.currentTarget.reset();
    } catch {
      Notify.error("Failed", "Could not send your message. Please try calling us directly.");
    } finally {
      btn.disabled  = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';
    }
  });

  document.getElementById("newsletter-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = e.currentTarget.querySelector('input[type="email"]');
    if (!input?.value) return;
    try {
      await ApiClient.post("/newsletter/subscribe", { email: input.value });
      Notify.success("Subscribed!", "You'll receive our best offers and laundry tips.");
      input.value = "";
    } catch {
      Notify.error("Failed", "Could not subscribe. Please try again.");
    }
  });
}

/* ============================================================
   LINK INTERCEPTION
   ============================================================ */
function bindLinks() {
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-route]");
    if (!link) return;
    e.preventDefault();
    const route = link.getAttribute("data-route");
    if (route) Router.navigate(route);
  });
}

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  Notify.init();
  PageBar.init();
  PaymentFlow.init();
  OrderDrawer.init();
  Modal.init();

  initGlobalUI();
  bindLinks();

  NotificationCenter.init();

  window.addEventListener("hashchange", () => Router.resolve());
  Router.resolve();

  // Expose globals required by inline HTML onclick attributes
  window.Notify          = Notify;
  window.Modal           = Modal;
  window.OrderDrawer     = OrderDrawer;
  window.StaffManager    = StaffManager;
  window.PricingManager  = PricingManager;
  window.CustomerManager = CustomerManager;
  window.Analytics       = Analytics;
  window.PaymentFlow     = PaymentFlow;
  window.Router          = Router;
  window.TrackOrderPage  = TrackOrderPage;
});