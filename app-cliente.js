/* =========================================================================
   NubePOS · app-cliente.js
   Orquesta el Dashboard del Cliente Final: catálogo reactivo (Firestore),
   chatbot con cards de producto, carrito de compras y checkout con QR
   Simple + notificación a Telegram vía función serverless.

   Principio de responsabilidad única: cada clase/módulo hace una sola
   cosa. index:
     1. Config e inicialización de Firebase
     2. Utilidades compartidas
     3. CatalogService   -> catálogo Firestore en tiempo real
     4. CartManager      -> estado y cálculos del carrito
     5. ChatEngine        -> intención del cliente + respuestas con cards
     6. PaymentService    -> QR, pedido en Firestore, notificación Telegram
     7. UIController       -> conecta todo con el DOM y maneja eventos
   ========================================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  query,
  where,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

/* ------------------------------------------------------------------ *
 * 1. CONFIGURACIÓN DE FIREBASE
 *    Reemplazá estos valores por los de tu proyecto. Estas claves son
 *    públicas por diseño (identifican el proyecto, no autorizan nada por
 *    sí solas); la seguridad real vive en las Firestore Security Rules.
 * ------------------------------------------------------------------ */
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxx",
};

// ID del negocio que atiende este kiosco/mesa. En un despliegue multi-tenant
// esto normalmente viene de la URL (?negocio=xyz) o de un subdominio.
const NEGOCIO_ID = new URLSearchParams(location.search).get("negocio") || "default";

// Endpoint de la función serverless que notifica a Telegram. Mismo origen
// en Netlify/Vercel (/api/...); podés apuntarlo a otro dominio si separás
// el backend.
const NOTIFY_ENDPOINT = "/api/notify-telegram";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ------------------------------------------------------------------ *
 * 2. UTILIDADES
 * ------------------------------------------------------------------ */

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

/** Formatea un número como moneda boliviana (Bs) o dólares, sin depender
 *  de Intl locales que puedan faltar en navegadores viejos. */
function formatBOB(amount) {
  return `Bs ${Number(amount || 0).toFixed(2)}`;
}
function formatUSD(amount) {
  if (!amount && amount !== 0) return "";
  return `$us ${Number(amount).toFixed(2)}`;
}

/** Escapa texto para insertarlo de forma segura en innerHTML. */
function escapeHTML(str = "") {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/** Simple normalizador para comparar texto del chat contra el catálogo. */
function normalize(str = "") {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .trim();
}

function isOnline() {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/* ------------------------------------------------------------------ *
 * 3. CATALOG SERVICE
 *    Única responsabilidad: mantener sincronizado el catálogo local con
 *    la colección `productos` de Firestore y notificar a quien escuche.
 * ------------------------------------------------------------------ */
class CatalogService {
  constructor(db, negocioId) {
    this.db = db;
    this.negocioId = negocioId;
    this.products = [];
    this.listeners = new Set();
    this.unsubscribe = null;
  }

  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  #emit() {
    this.listeners.forEach((cb) => cb(this.products));
  }

  start() {
    const productosRef = collection(this.db, "productos");
    const q = query(productosRef, where("negocioId", "==", this.negocioId), where("disponible", "==", true));

    this.unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        this.products = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        this.#emit();
      },
      (error) => {
        console.error("[CatalogService] error de sincronización:", error);
        this.#emit(); // permite que la UI muestre el estado vacío/fallback
        UIController.showOfflineBanner(true);
      }
    );
  }

  stop() {
    if (this.unsubscribe) this.unsubscribe();
  }

  getById(id) {
    return this.products.find((p) => p.id === id);
  }

  getCategories() {
    return [...new Set(this.products.map((p) => p.categoria).filter(Boolean))];
  }

  search(term) {
    const t = normalize(term);
    if (!t) return [];
    return this.products.filter((p) => {
      const haystack = normalize(`${p.nombre} ${p.descripcion} ${p.categoria}`);
      return t.split(" ").some((word) => word.length > 2 && haystack.includes(word));
    });
  }
}

/* ------------------------------------------------------------------ *
 * 4. CART MANAGER
 *    Única responsabilidad: mantener el estado del carrito y sus totales.
 *    No toca el DOM directamente; emite eventos para que la UI reaccione.
 * ------------------------------------------------------------------ */
class CartManager {
  constructor({ taxRate = 0 } = {}) {
    this.items = new Map(); // productId -> { product, qty }
    this.taxRate = taxRate; // ej. 0.13 para IVA 13%
    this.listeners = new Set();
  }

  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  #emit() {
    const totals = this.computeTotals();
    this.listeners.forEach((cb) => cb({ items: this.getItems(), totals }));
  }

  add(product, qty = 1) {
    const current = this.items.get(product.id);
    const nextQty = (current?.qty || 0) + qty;
    if (nextQty <= 0) {
      this.items.delete(product.id);
    } else {
      this.items.set(product.id, { product, qty: nextQty });
    }
    this.#emit();
  }

  setQty(product, qty) {
    if (qty <= 0) {
      this.items.delete(product.id);
    } else {
      this.items.set(product.id, { product, qty });
    }
    this.#emit();
  }

  remove(productId) {
    this.items.delete(productId);
    this.#emit();
  }

  clear() {
    this.items.clear();
    this.#emit();
  }

  getQty(productId) {
    return this.items.get(productId)?.qty || 0;
  }

  getItems() {
    return [...this.items.values()];
  }

  getItemCount() {
    return this.getItems().reduce((sum, i) => sum + i.qty, 0);
  }

  computeTotals() {
    const subtotal = this.getItems().reduce(
      (sum, i) => sum + Number(i.product.precioBOB || 0) * i.qty,
      0
    );
    const impuesto = subtotal * this.taxRate;
    const total = subtotal + impuesto;
    return { subtotal, impuesto, total };
  }
}

/* ------------------------------------------------------------------ *
 * 5. CHAT ENGINE
 *    Única responsabilidad: interpretar el texto del cliente y producir
 *    una respuesta (texto y/o cards de producto). El matching por
 *    palabras clave es el motor por defecto y funciona 100% offline de
 *    APIs externas. Para IA generativa real, `replyWithAI()` muestra el
 *    punto de extensión: llamar a una función serverless propia (nunca
 *    a la API de IA directamente desde el navegador) que devuelva texto.
 * ------------------------------------------------------------------ */
class ChatEngine {
  constructor(catalogService) {
    this.catalog = catalogService;
  }

  /** Devuelve { text, products } según la intención detectada. */
  interpret(rawMessage) {
    const msg = normalize(rawMessage);

    if (/\b(hola|buenas|buenos dias|buenas tardes|buenas noches)\b/.test(msg)) {
      return { text: "¡Hola! 👋 Preguntame por un plato, un ingrediente o pedime una recomendación." };
    }

    if (/\b(gracias|listo|ok)\b/.test(msg)) {
      return { text: "¡De nada! Si querés, seguí explorando el menú o avisame cuando quieras pagar." };
    }

    if (/\b(recomien|sugerenc|que me recomiendas|especialidad)\b/.test(msg)) {
      const destacados = this.catalog.products.filter((p) => p.destacado).slice(0, 3);
      const lista = destacados.length ? destacados : this.catalog.products.slice(0, 3);
      if (!lista.length) {
        return { text: "Todavía no cargué el menú, dame un segundo y volvé a preguntar." };
      }
      return {
        text: "Estos son mis favoritos de la casa:",
        products: lista,
      };
    }

    if (/\b(precio|cuanto cuesta|cuanto vale|costo)\b/.test(msg)) {
      const found = this.catalog.search(msg);
      if (found.length) {
        return { text: "Estos son los precios que encontré:", products: found.slice(0, 4) };
      }
    }

    // Búsqueda general por nombre/descr./categoría
    const found = this.catalog.search(msg);
    if (found.length) {
      return {
        text: found.length === 1
          ? "Encontré esto para vos:"
          : `Encontré ${found.length} opciones:`,
        products: found.slice(0, 6),
      };
    }

    return {
      text: "No encontré nada con esa palabra en el menú. Probá con el nombre de un plato, una categoría (ej. \"bebidas\") o pedime una recomendación.",
    };
  }

  /* Punto de extensión opcional para IA generativa real:
     const res = await fetch("/api/chat-ai", { method: "POST", body: JSON.stringify({ mensaje, catalogo }) });
     El backend serverless guarda ahí la API key y arma el prompt con el
     catálogo; el cliente nunca ve credenciales. Se deja fuera del alcance
     de esta entrega para mantener el chatbot funcional sin dependencias
     externas, pero la arquitectura ya está lista para enchufarlo. */
}

/* ------------------------------------------------------------------ *
 * 6. PAYMENT SERVICE
 *    Única responsabilidad: desplegar el QR Simple, registrar el pedido
 *    en Firestore y notificar a Telegram a través del endpoint seguro.
 *    Nunca maneja tokens ni chat IDs: eso vive solo en el servidor.
 * ------------------------------------------------------------------ */
class PaymentService {
  constructor(db, negocioId, notifyEndpoint) {
    this.db = db;
    this.negocioId = negocioId;
    this.notifyEndpoint = notifyEndpoint;
  }

  /** Trae la config de cobro del negocio (URL de imagen QR fija, etc.) */
  async getPaymentConfig() {
    // Se resuelve por snapshot puntual usando onSnapshot + unsubscribe
    // inmediato para reutilizar la misma dependencia de Firestore sin
    // sumar el paquete getDoc por separado.
    return new Promise((resolve, reject) => {
      const ref = doc(this.db, "configuracion", this.negocioId);
      const unsub = onSnapshot(
        ref,
        (snap) => {
          unsub();
          resolve(snap.exists() ? snap.data() : {});
        },
        (err) => {
          unsub();
          reject(err);
        }
      );
    });
  }

  /** Crea el documento de pedido en estado "pendiente". */
  async crearPedido({ items, totals, cliente }) {
    const pedidosRef = collection(this.db, "pedidos");
    const payload = {
      negocioId: this.negocioId,
      items: items.map((i) => ({
        productoId: i.product.id,
        nombre: i.product.nombre,
        precioUnitarioBOB: Number(i.product.precioBOB || 0),
        cantidad: i.qty,
      })),
      subtotal: totals.subtotal,
      impuesto: totals.impuesto,
      total: totals.total,
      estado: "pendiente",
      cliente: cliente || null,
      creadoEn: serverTimestamp(),
    };
    const docRef = await addDoc(pedidosRef, payload);
    return docRef.id;
  }

  async marcarComo(pedidoId, estado) {
    const ref = doc(this.db, "pedidos", pedidoId);
    await updateDoc(ref, { estado, actualizadoEn: serverTimestamp() });
  }

  /** Notifica el pedido a Telegram vía función serverless. Nunca toca
   *  tokens: solo envía el detalle del pedido a un endpoint propio. */
  async notificarTelegram(pedidoId, { items, totals, cliente }) {
    const body = {
      pedidoId,
      negocioId: this.negocioId,
      items: items.map((i) => ({ nombre: i.product.nombre, cantidad: i.qty })),
      total: totals.total,
      cliente: cliente || null,
    };

    const response = await fetch(this.notifyEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Notificación falló (${response.status}): ${detail}`);
    }
    return response.json().catch(() => ({}));
  }
}

/* ------------------------------------------------------------------ *
 * 7. UI CONTROLLER
 *    Conecta los servicios anteriores con el DOM. Es el único módulo
 *    que lee/escribe elementos del documento.
 * ------------------------------------------------------------------ */
const UIController = {
  // --- refs ---
  refs: {},
  activeCategory: "todos",
  currentPedidoId: null,

  init() {
    this.refs = {
      offlineBanner: $("#offline-banner"),
      categoryChips: $("#category-chips"),
      catalogGrid: $("#catalog-grid"),
      catalogLoading: $("#catalog-loading"),
      chatLog: $("#chat-log"),
      chatForm: $("#chat-form"),
      chatText: $("#chat-text"),
      cartItems: $("#cart-items"),
      cartEmpty: $("#cart-empty"),
      cartSubtotal: $("#cart-subtotal"),
      cartTax: $("#cart-tax"),
      cartTotal: $("#cart-total"),
      taxRateLabel: $("#tax-rate-label"),
      checkoutBtn: $("#checkout-btn"),
      cartFeedback: $("#cart-feedback"),
      cartTab: $("#cart-tab"),
      cartTabBadge: $("#cart-tab-badge"),
      cartTabTotal: $("#cart-tab-total"),
      cartPanel: $("#cart-panel"),
      paymentModal: $("#payment-modal"),
      paymentClose: $("#payment-close"),
      qrImage: $("#qr-image"),
      paymentAmount: $("#payment-amount"),
      confirmPaymentBtn: $("#confirm-payment-btn"),
      paymentStatus: $("#payment-status"),
      productTemplate: $("#product-card-template"),
    };

    this.bindGlobalEvents();
  },

  bindGlobalEvents() {
    window.addEventListener("online", () => this.showOfflineBanner(false));
    window.addEventListener("offline", () => this.showOfflineBanner(true));
    this.showOfflineBanner(!isOnline());

    this.refs.cartTab.addEventListener("click", () => {
      const isOpen = this.refs.cartPanel.classList.toggle("is-open");
      this.refs.cartTab.setAttribute("aria-expanded", String(isOpen));
    });

    this.refs.paymentClose.addEventListener("click", () => this.closePaymentModal());
    this.refs.paymentModal.addEventListener("click", (e) => {
      if (e.target === this.refs.paymentModal) this.closePaymentModal();
    });
  },

  showOfflineBanner(show) {
    this.refs.offlineBanner.hidden = !show;
  },

  /* ---------- Catálogo ---------- */

  renderCategories(categories) {
    const chips = ["todos", ...categories];
    this.refs.categoryChips.innerHTML = chips
      .map(
        (cat) => `<button class="chip${cat === this.activeCategory ? " chip--active" : ""}" data-category="${escapeHTML(cat)}" type="button">${escapeHTML(cat === "todos" ? "Todos" : cat)}</button>`
      )
      .join("");

    $$(".chip", this.refs.categoryChips).forEach((btn) => {
      btn.addEventListener("click", () => {
        this.activeCategory = btn.dataset.category;
        this.renderCatalog(window.__catalogService.products);
        $$(".chip", this.refs.categoryChips).forEach((c) => c.classList.remove("chip--active"));
        btn.classList.add("chip--active");
      });
    });
  },

  renderCatalog(products) {
    this.refs.catalogLoading.remove?.();
    const list =
      this.activeCategory === "todos"
        ? products
        : products.filter((p) => p.categoria === this.activeCategory);

    if (!list.length) {
      this.refs.catalogGrid.innerHTML = `<p class="catalog-grid__empty">No hay productos disponibles en esta categoría por ahora.</p>`;
      return;
    }

    this.refs.catalogGrid.innerHTML = "";
    list.forEach((product) => {
      this.refs.catalogGrid.appendChild(this.buildProductCard(product));
    });
  },

  buildProductCard(product) {
    const node = this.refs.productTemplate.content.cloneNode(true);
    const article = node.querySelector(".product-card");
    const img = node.querySelector(".product-card__img");
    const name = node.querySelector(".product-card__name");
    const desc = node.querySelector(".product-card__desc");
    const priceBOB = node.querySelector(".product-card__price-bob");
    const priceUSD = node.querySelector(".product-card__price-usd");
    const qtyValue = node.querySelector('[data-role="qty"]');
    const incBtn = node.querySelector('[data-action="increment"]');
    const decBtn = node.querySelector('[data-action="decrement"]');

    img.src = product.imagenUrl || "https://via.placeholder.com/300x225?text=NubePOS";
    img.alt = product.nombre || "Producto del menú";
    name.textContent = product.nombre || "Producto";
    desc.textContent = product.descripcion || "";
    priceBOB.textContent = formatBOB(product.precioBOB);
    priceUSD.textContent = formatUSD(product.precioUSD);
    qtyValue.textContent = String(window.__cart.getQty(product.id));

    incBtn.addEventListener("click", () => window.__cart.add(product, 1));
    decBtn.addEventListener("click", () => window.__cart.add(product, -1));

    article.dataset.productId = product.id;
    this._cardRefs = this._cardRefs || new Map();
    this._cardRefs.set(product.id, this._cardRefs.get(product.id) || new Set());
    this._cardRefs.get(product.id).add(qtyValue);

    return node;
  },

  /** Sincroniza los contadores de todas las cards visibles (catálogo y
   *  chat) sin tener que re-renderizar todo cuando cambia el carrito. */
  syncQuantitiesInDOM() {
    $$(".product-card").forEach((card) => {
      const id = card.dataset.productId;
      const qtyEl = card.querySelector('[data-role="qty"]');
      if (id && qtyEl) qtyEl.textContent = String(window.__cart.getQty(id));
    });
  },

  /* ---------- Chat ---------- */

  appendMessage({ role, text, products }) {
    const bubble = document.createElement("div");
    bubble.className = `msg msg--${role}`;
    bubble.textContent = text;

    if (products?.length) {
      const grid = document.createElement("div");
      grid.className = "msg__cards";
      products.forEach((p) => grid.appendChild(this.buildProductCard(p)));
      bubble.appendChild(grid);
    }

    this.refs.chatLog.appendChild(bubble);
    this.refs.chatLog.scrollTop = this.refs.chatLog.scrollHeight;
  },

  showTyping() {
    const typing = document.createElement("div");
    typing.className = "chat-typing";
    typing.id = "chat-typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    this.refs.chatLog.appendChild(typing);
    this.refs.chatLog.scrollTop = this.refs.chatLog.scrollHeight;
  },

  hideTyping() {
    $("#chat-typing")?.remove();
  },

  /* ---------- Carrito ---------- */

  renderCart({ items, totals }) {
    this.refs.cartItems.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "ticket__empty";
      empty.id = "cart-empty";
      empty.textContent = "Tu carrito está vacío. Agregá productos desde el menú o pedile una recomendación al asistente.";
      this.refs.cartItems.appendChild(empty);
    } else {
      items.forEach(({ product, qty }) => {
        const li = document.createElement("li");
        li.className = "cart-line";
        li.innerHTML = `
          <span class="cart-line__name">${escapeHTML(product.nombre)}</span>
          <span class="cart-line__price">${formatBOB(product.precioBOB * qty)}</span>
          <span class="cart-line__meta">
            <span class="cart-line__qty-controls">
              <button class="qty-btn" data-action="dec" aria-label="Quitar una unidad">−</button>
              <span>${qty}</span>
              <button class="qty-btn" data-action="inc" aria-label="Agregar una unidad">+</button>
            </span>
            <button class="cart-line__remove" data-action="remove">Quitar</button>
          </span>
        `;
        li.querySelector('[data-action="inc"]').addEventListener("click", () => window.__cart.add(product, 1));
        li.querySelector('[data-action="dec"]').addEventListener("click", () => window.__cart.add(product, -1));
        li.querySelector('[data-action="remove"]').addEventListener("click", () => window.__cart.remove(product.id));
        this.refs.cartItems.appendChild(li);
      });
    }

    this.refs.cartSubtotal.textContent = formatBOB(totals.subtotal);
    this.refs.cartTax.textContent = formatBOB(totals.impuesto);
    this.refs.cartTotal.textContent = formatBOB(totals.total);

    const count = items.reduce((sum, i) => sum + i.qty, 0);
    this.refs.cartTabBadge.textContent = String(count);
    this.refs.cartTabTotal.textContent = formatBOB(totals.total);
    this.refs.checkoutBtn.disabled = count === 0;

    this.syncQuantitiesInDOM();
  },

  setCartFeedback(text, kind = "") {
    this.refs.cartFeedback.textContent = text || "";
    this.refs.cartFeedback.className = `ticket__note${kind ? ` ticket__note--${kind}` : ""}`;
  },

  /* ---------- Modal de pago ---------- */

  openPaymentModal({ qrUrl, amount }) {
    this.refs.qrImage.src = qrUrl || "";
    this.refs.paymentAmount.textContent = formatBOB(amount);
    this.refs.paymentStatus.textContent = "";
    this.refs.paymentStatus.className = "modal__status";
    this.refs.paymentModal.hidden = false;
    this.refs.confirmPaymentBtn.disabled = false;
    this.refs.confirmPaymentBtn.textContent = "Ya pagué, notificar pedido";
  },

  closePaymentModal() {
    this.refs.paymentModal.hidden = true;
  },

  setPaymentStatus(text, kind = "") {
    this.refs.paymentStatus.textContent = text;
    this.refs.paymentStatus.className = `modal__status${kind ? ` modal__status--${kind}` : ""}`;
  },
};

/* ------------------------------------------------------------------ *
 * BOOTSTRAP: conecta los servicios entre sí y con la UI
 * ------------------------------------------------------------------ */
(function bootstrap() {
  UIController.init();

  const catalogService = new CatalogService(db, NEGOCIO_ID);
  const cart = new CartManager({ taxRate: 0 }); // se ajusta al leer configuración
  const chatEngine = new ChatEngine(catalogService);
  const paymentService = new PaymentService(db, NEGOCIO_ID, NOTIFY_ENDPOINT);

  // Expuestos para que las cards armadas por UIController puedan operar
  // el carrito sin pasar callbacks por cada nodo del DOM.
  window.__cart = cart;
  window.__catalogService = catalogService;

  // --- Catálogo reactivo ---
  catalogService.onChange((products) => {
    UIController.renderCategories(catalogService.getCategories());
    UIController.renderCatalog(products);
  });
  catalogService.start();

  // --- Carrito reactivo ---
  cart.onChange((state) => UIController.renderCart(state));

  // --- Configuración de cobro (tasa de impuesto + QR) ---
  paymentService
    .getPaymentConfig()
    .then((config) => {
      cart.taxRate = Number(config.tasaImpuesto || 0);
      UIController.refs.taxRateLabel.textContent = String(Math.round(cart.taxRate * 100));
      cart.onChange(() => {}); // fuerza recomputo en el próximo cambio
    })
    .catch((err) => {
      console.warn("[PaymentService] no se pudo leer configuración de cobro:", err);
    });

  // --- Chat: envío de mensajes ---
  UIController.refs.chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = UIController.refs.chatText.value.trim();
    if (!text) return;

    UIController.appendMessage({ role: "user", text });
    UIController.refs.chatText.value = "";
    UIController.showTyping();

    // Pequeña latencia simulada para que el chat se sienta conversacional;
    // en producción acá podría ir el `await` a la función serverless de IA.
    setTimeout(() => {
      UIController.hideTyping();
      const reply = chatEngine.interpret(text);
      UIController.appendMessage({ role: "bot", ...reply });
    }, 380);
  });

  // Mensaje de bienvenida inicial
  UIController.appendMessage({
    role: "bot",
    text: "¡Hola! Soy el asistente de NubePOS 🍽️. Preguntame por un plato, una categoría o pedime una recomendación, y te muestro las opciones con precio y foto.",
  });

  // --- Checkout: abrir modal de pago con QR ---
  UIController.refs.checkoutBtn.addEventListener("click", async () => {
    if (!isOnline()) {
      UIController.setCartFeedback("Estás sin conexión. Reconectate para generar el QR de pago.", "error");
      return;
    }
    try {
      UIController.setCartFeedback("Generando código QR…");
      const config = await paymentService.getPaymentConfig();
      const totals = cart.computeTotals();

      if (!config.qrImageUrl) {
        UIController.setCartFeedback(
          "El negocio todavía no configuró su QR de cobro. Avisale al mesero para pagar en caja.",
          "error"
        );
        return;
      }

      UIController.openPaymentModal({ qrUrl: config.qrImageUrl, amount: totals.total });
      UIController.setCartFeedback("");
    } catch (err) {
      console.error("[Checkout] error al preparar el pago:", err);
      UIController.setCartFeedback("No pudimos generar el QR ahora mismo. Intentá de nuevo en unos segundos.", "error");
    }
  });

  // --- Confirmación de pago: registra pedido + notifica Telegram ---
  // Si el intento anterior falló solo en la notificación (el pedido ya
  // quedó guardado con currentPedidoId), el reintento NO vuelve a crear
  // el pedido: solo reintenta el aviso a Telegram. Esto evita pedidos
  // duplicados por errores intermitentes de red.
  UIController.refs.confirmPaymentBtn.addEventListener("click", async () => {
    const items = cart.getItems();
    if (!items.length && !UIController.currentPedidoId) return;

    const totals = cart.computeTotals();
    UIController.refs.confirmPaymentBtn.disabled = true;
    UIController.setPaymentStatus("");

    let pedidoId = UIController.currentPedidoId;

    if (!pedidoId) {
      UIController.refs.confirmPaymentBtn.textContent = "Registrando pedido…";
      try {
        pedidoId = await paymentService.crearPedido({ items, totals, cliente: null });
        UIController.currentPedidoId = pedidoId;
      } catch (err) {
        console.error("[Pedido] error al guardar en Firestore:", err);
        UIController.setPaymentStatus(
          "No pudimos registrar tu pedido. Revisá tu conexión y volvé a intentar; si el problema sigue, avisá al mesero.",
          "error"
        );
        UIController.refs.confirmPaymentBtn.disabled = false;
        UIController.refs.confirmPaymentBtn.textContent = "Reintentar";
        return;
      }
    }

    // El pedido ya quedó guardado como "pendiente" aunque la notificación
    // a Telegram falle: el mesero puede verlo igual desde el panel del
    // comerciante. La notificación es un plus, no un bloqueante.
    try {
      UIController.refs.confirmPaymentBtn.textContent = "Avisando al local…";
      await paymentService.notificarTelegram(pedidoId, { items, totals, cliente: null });
      await paymentService.marcarComo(pedidoId, "pagado");
      UIController.setPaymentStatus("¡Pedido enviado a cocina! 🎉", "success");
      UIController.refs.confirmPaymentBtn.textContent = "Pedido confirmado";
      UIController.currentPedidoId = null;
      cart.clear();
      setTimeout(() => UIController.closePaymentModal(), 1800);
    } catch (err) {
      console.warn("[Telegram] no se pudo notificar:", err);
      UIController.setPaymentStatus(
        "Tu pedido quedó registrado, pero no pudimos avisar por Telegram automáticamente. Podés reintentar o avisar directo en caja.",
        "error"
      );
      UIController.refs.confirmPaymentBtn.disabled = false;
      UIController.refs.confirmPaymentBtn.textContent = "Reintentar aviso";
      // Nota: no limpiamos el carrito ni currentPedidoId aquí, para poder
      // reintentar sin duplicar el pedido.
    }
  });
})();
