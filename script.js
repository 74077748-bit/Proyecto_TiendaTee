
/* ==========================================================
   TIENDATEE
   Catálogo, buscador, filtros, carrusel y carrito.
   Diseño adaptable. Demostración sin pagos reales.
========================================================== */

"use strict";
// CONEXIÓN CON SUPABASE
const SUPABASE_URL = "https://okszetvgoflpujbphopr.supabase.co";
const SUPABASE_KEY = "sb_publishable_iB0JmEqk8130zdWdaiyVfg_ESWGLCzm";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


/* =========================
   1. PRODUCTOS
========================= */

let PRODUCTS = [];

const FALLBACK_IMG = "assets/cat-hombres.webp";
const CART_KEY = "tiendatee-cart";

// CARGAR PRODUCTOS DESDE SUPABASE


async function loadProducts() {
  try {
    const [productosResult, imagenesResult, variantesResult] =
      await Promise.all([
        supabaseClient
          .from("Productos")
          .select("*")
          .order("id", { ascending: true }),

        supabaseClient
          .from("Imagenes_Productos")
          .select("id, producto_id, color, imagen"),

        supabaseClient
          .from("Variantes_Productos")
          .select("id, producto_id, color, talla, stock")
      ]);

    if (productosResult.error) throw productosResult.error;
    if (imagenesResult.error) throw imagenesResult.error;
    if (variantesResult.error) throw variantesResult.error;

    const imagenesPorProducto = new Map();
    const variantesPorProducto = new Map();

    (imagenesResult.data || []).forEach(imagen => {
      const id = String(imagen.producto_id);

      if (!imagenesPorProducto.has(id)) {
        imagenesPorProducto.set(id, []);
      }

      imagenesPorProducto.get(id).push(imagen);
    });

    (variantesResult.data || []).forEach(variante => {
      const id = String(variante.producto_id);

      if (!variantesPorProducto.has(id)) {
        variantesPorProducto.set(id, []);
      }

      variantesPorProducto.get(id).push(variante);
    });

    PRODUCTS = (productosResult.data || []).map(product => {
      const id = String(product.id);
      const imagenes = imagenesPorProducto.get(id) || [];
      const variantes = variantesPorProducto.get(id) || [];

      return {
        id,
        name: product.nombre,
        tallas: product.tallas || "",
        price: Number(product.precio),
        stock: Number(product.stock) || 0,
        oldPrice: product.precio_anterior == null
          ? null
          : Number(product.precio_anterior),
        category: product.categoria,
        image: product.imagen || "",
        bestseller: Boolean(product.destacado),
        badge: product.etiqueta || "",
        images: imagenes,
        variants: variantes,

        colors: variantes.length
          ? [...new Set(
              variantes
                .filter(v => Number(v.stock) > 0)
                .map(v => v.color)
            )]
          : (product.colores || "")
              .split(",")
              .map(c => c.trim())
              .filter(Boolean),

        sizes: variantes.length
          ? [...new Set(
              variantes.flatMap(v =>
                (v.talla || "")
                  .split(",")
                  .map(s => s.trim())
                  .filter(Boolean)
              )
            )]
          : (product.tallas || "")
              .split(",")
              .map(s => s.trim())
              .filter(Boolean)
      };
    });

    return true;

  } catch (error) {
    console.error("Error al cargar productos:", error);
    showToast("No se pudieron cargar los productos de Supabase.");
    return false;
  }
}


const CATEGORY_LABELS = {
  all: "Todas",
  hombres: "Hombres",
  mujeres: "Mujeres",
  ninos: "Niños",
  estilos: "Estilos",
  tematicas: "Temáticas"
};

const VIEWS = [
  "inicio",
  "tienda",
  "nosotros",
  "contacto",
  "cuenta",
  "envios",
  "devoluciones",
  "terminos"
];

/* =========================
   2. ESTADO DE LA TIENDA
========================= */

const state = {
  filter: "all",
  query: "",
  carouselIndex: 0,
  cart: []
};

/* =========================
   3. ALMACENAMIENTO
========================= */



function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(item => {
        const product = PRODUCTS.find(
          product => product.id === String(item?.id)
        );

        if (
          !product ||
          !Number.isInteger(item.qty) ||
          item.qty <= 0 ||
          !item.color ||
          !item.size
        ) {
          return false;
        }

        const stock = getVariantStock(
          product,
          item.color,
          item.size
        );

        return stock > 0;
      })
      .map(item => {
        const product = PRODUCTS.find(
          product => product.id === String(item.id)
        );

        const stock = getVariantStock(
          product,
          item.color,
          item.size
        );

        return {
          id: String(item.id),
          qty: Math.min(item.qty, stock),
          color: item.color,
          size: item.size
        };
      });

  } catch (error) {
    console.warn("No se pudo recuperar el carrito:", error);
    return [];
  }
}



function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  } catch (error) {
    console.warn("No se pudo guardar el carrito:", error);
    showToast("No se pudo guardar el carrito en este navegador.");
  }
}

function money(amount) {
  return `S/ ${Number(amount).toFixed(2)}`;
}

/* =========================
   4. IMÁGENES
========================= */

function handleImgError(img) {
  if (img.dataset.fallbackApplied === "true") return;

  img.dataset.fallbackApplied = "true";
  img.src = FALLBACK_IMG;
}

function attachImageFallbacks(container) {
  container.querySelectorAll("img").forEach((img) => {
    img.addEventListener("error", () => handleImgError(img), {
      once: true
    });
  });
}

/* =========================
   5. TARJETAS DE PRODUCTOS
========================= */



function getVariantStock(product, color, size) {
  // Imagen principal: usar el stock general
  if (!color || color === "Principal") {
    return Number(product.stock) || 0;
  }

  if (!product.variants || product.variants.length === 0) {
    return Number(product.stock) || 0;
  }

  const variant = product.variants.find(v =>
    v.color?.trim().toLowerCase() === color.trim().toLowerCase() &&
    v.talla
      ?.split(",")
      .map(t => t.trim().toLowerCase())
      .includes(size?.trim().toLowerCase())
  );

  return variant ? Number(variant.stock) : 0;
}


function getProductImageByColor(product, color) {
  const image = product.images?.find(img =>
    img.color?.toLowerCase() === color?.toLowerCase()
  );

  return image?.imagen || product.image || FALLBACK_IMG;
}


function getAvailableSizes(product, color) {
  if (!product.variants || product.variants.length === 0) {
    return product.sizes || [];
  }

  const variant = product.variants.find(v =>
    v.color?.trim().toLowerCase() === color?.trim().toLowerCase() &&
    Number(v.stock) > 0
  );

  if (!variant) return [];

  return variant.talla
    .split(",")
    .map(size => size.trim())
    .filter(Boolean);
}



function productCard(product, compact = false) {
  const badge = product.badge
    ? `<span class="badge">${product.badge}</span>`
    : "";

  const oldPrice = product.oldPrice
    ? `<s>${money(product.oldPrice)}</s> `
    : "";

  const stock = Number(product.stock) || 0;

  let stockMessage = "";
  let stockClass = "";

  if (stock === 0) {
    stockMessage = "Agotado";
    stockClass = "stock-out";
  } else if (stock <= 3) {
    stockMessage = `¡Últimas unidades! (${stock} disponibles)`;
    stockClass = "stock-low";
  } else {
    stockMessage = `${stock} unidades disponibles`;
    stockClass = "stock-available";
  }

  return `
    <article
      class="paper-card product-card${compact ? " compact-card" : ""}"
      data-id="${product.id}"
    >
      ${badge}

      <img
        class="product-image"
        src="${product.image}"
        alt="${product.name}"
        width="220"
        height="260"
        loading="lazy"
      >

      <h3>${product.name}</h3>

      <p class="price">
        ${oldPrice}${money(product.price)}
      </p>

      <p class="stock-status ${stockClass}">
        ${stockMessage}
      </p>


            <button
        type="button"
        class="btn-add"
        data-details="${product.id}"
        aria-label="Ver detalles de ${product.name}"
        ${stock === 0 ? "disabled" : ""}
      >
        ${stock === 0 ? "Agotado" : "Ver detalles"}
      </button>
    </article>
  `;
}


/* =========================
   6. FILTROS Y BÚSQUEDA
========================= */


function normalizeText(text) {
  return String(text || "")
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function filteredProducts() {
  const query = normalizeText(state.query);

  const stopWords = [
    "para", "de", "del", "la", "el",
    "las", "los", "una", "un", "con"
  ];

  const searchWords = query
    .split(/\s+/)
    .filter(word => word && !stopWords.includes(word));

  const categoryKeywords = {
    hombres: "hombre hombres masculino varon caballero",
    mujeres: "mujer mujeres femenino dama",
    ninos: "nino ninos infantil junior niño niños",
    estilos: "estilo estilos urbano urbana casual",
    tematicas: "tematica tematicas especial especiales"
  };

  return PRODUCTS.filter((product) => {
    const matchesCategory =
      state.filter === "all" ||
      product.category === state.filter;

    const searchableText = normalizeText([
      product.name,
      product.category,
      CATEGORY_LABELS[product.category],
      categoryKeywords[product.category],
      "camiseta camisetas polo polos ropa futbol futbolera deportiva"
    ].join(" "));

    const matchesQuery =
      !query ||
      searchWords.every(word => searchableText.includes(word));

    return matchesCategory && matchesQuery;
  });
}


function renderShop() {
  const grid = document.getElementById("productGrid");
  const meta = document.getElementById("resultsMeta");
  const title = document.getElementById("shopTitle");
  const lead = document.getElementById("shopLead");

  if (!grid) return;

  const products = filteredProducts();

  if (title) {
    title.textContent =
      state.filter === "all"
        ? "Tienda"
        : CATEGORY_LABELS[state.filter] || "Tienda";
  }

  if (lead) {
    lead.textContent = state.query
      ? `Resultados de búsqueda para: ${state.query}`
      : "Camisetas de diseño propio. No son productos oficiales de clubes ni marcas.";
  }

  if (meta) {
    if (state.query) {
      meta.textContent = products.length
        ? `${products.length} resultado(s) para "${state.query}"`
        : `No encontramos camisetas para "${state.query}".`;
    } else {
      meta.textContent = `${products.length} producto(s)`;
    }
  }

  if (products.length) {
    grid.innerHTML = products
      .map((product) => productCard(product))
      .join("");
  } else {
    grid.innerHTML = `
      <div class="empty search-empty">
        <h3>No encontramos productos</h3>
        <p>Prueba con otro nombre o selecciona otra categoría.</p>
        <button type="button" class="btn-red" data-reset-search>
          Ver todos los productos
        </button>
      </div>
    `;
  }

  attachImageFallbacks(grid);
  updateFilterButtons();
}

function updateFilterButtons() {
  document.querySelectorAll("#filters .chip").forEach((chip) => {
    const active = chip.dataset.filter === state.filter;

    chip.classList.toggle("is-active", active);
    chip.setAttribute("aria-pressed", String(active));
  });
}

function goShop(filter = "all", query = "") {
  state.filter = CATEGORY_LABELS[filter] ? filter : "all";
  state.query = String(query || "");
  state.carouselIndex = 0;

  renderShop();
  setView("tienda");

  if (location.hash !== "#tienda") {
    history.pushState(null, "", "#tienda");
  }
}

/* =========================
   7. CARRUSEL RESPONSIVE
========================= */

function visibleCount() {
  const width = window.innerWidth;

  if (width <= 420) return 1;
  if (width <= 640) return 2;
  if (width <= 1100) return 3;

  return 5;
}

function renderCarousel() {
  const track = document.getElementById("carouselTrack");

  if (!track) return;

  const bestsellers = PRODUCTS.filter(
    (product) => product.bestseller
  );

  track.innerHTML = bestsellers
    .map((product) => productCard(product, true))
    .join("");

  attachImageFallbacks(track);
  state.carouselIndex = 0;

  updateCarousel();
}

function updateCarousel() {
  const track = document.getElementById("carouselTrack");
  const viewport = document.getElementById("carouselViewport");

  if (!track || !viewport) return;

  const cards = track.querySelectorAll(".product-card");

  if (!cards.length) return;

  const visible = visibleCount();
  const maxIndex = Math.max(0, cards.length - visible);

  state.carouselIndex = Math.max(
    0,
    Math.min(state.carouselIndex, maxIndex)
  );

  const firstCard = cards[0];
  const trackStyle = window.getComputedStyle(track);

  const gap =
    parseFloat(trackStyle.columnGap) ||
    parseFloat(trackStyle.gap) ||
    18;

  const cardWidth = firstCard.getBoundingClientRect().width;
  const step = cardWidth + gap;

  track.style.transform =
    `translate3d(${-state.carouselIndex * step}px, 0, 0)`;

  const prev = document.getElementById("carouselPrev");
  const next = document.getElementById("carouselNext");

  if (prev) {
    prev.disabled = state.carouselIndex === 0;
  }

  if (next) {
    next.disabled = state.carouselIndex >= maxIndex;
  }
}

function moveCarousel(direction) {
  const track = document.getElementById("carouselTrack");

  if (!track) return;

  const total = track.querySelectorAll(".product-card").length;
  const maxIndex = Math.max(0, total - visibleCount());

  state.carouselIndex = Math.max(
    0,
    Math.min(state.carouselIndex + direction, maxIndex)
  );

  updateCarousel();
}

/* =========================
   8. CARRITO
========================= */

function cartCount() {
  return state.cart.reduce(
    (total, item) => total + item.qty,
    0
  );
}

function cartSubtotal() {
  return state.cart.reduce((total, item) => {
    const product = PRODUCTS.find((p) => p.id === item.id);

    return total + (product ? product.price * item.qty : 0);
  }, 0);
}



function renderCart() {
  const count = document.getElementById("cartCount");
  const subtotal = document.getElementById("cartSubtotal");
  const container = document.getElementById("cartItems");

  if (count) {
    count.textContent = String(cartCount());
  }

  if (subtotal) {
    subtotal.textContent = money(cartSubtotal());
  }

  if (!container) return;

  if (!state.cart.length) {
    container.innerHTML = `
      <p class="empty">Tu carrito está vacío.</p>
    `;
    return;
  }

  container.innerHTML = state.cart
    .map(line => {
      const product = PRODUCTS.find(
        p => p.id === String(line.id)
      );

      if (!product) return "";

      const productImage = getProductImageByColor(
        product,
        line.color
      );

      return `
        <article class="cart-row">
          <img
            src="${productImage}"
            alt="${product.name} - ${line.color}"
            width="70"
            height="80"
            loading="lazy"
          >

          <div class="cart-product-info">
            <strong>${product.name}</strong>

            <p>${money(product.price)}</p>

            <p>Color: ${line.color}</p>
            <p>Talla: ${line.size}</p>

            <div class="qty-ctrl">
              <button
                type="button"
                data-qty="${product.id}"
                data-color="${line.color}"
                data-size="${line.size}"
                data-delta="-1"
                aria-label="Reducir cantidad"
              >−</button>

              <span>${line.qty}</span>

              <button
                type="button"
                data-qty="${product.id}"
                data-color="${line.color}"
                data-size="${line.size}"
                data-delta="1"
                aria-label="Aumentar cantidad"
              >+</button>
            </div>
          </div>

          <button
            type="button"
            class="remove-line"
            data-remove="${product.id}"
            data-color="${line.color}"
            data-size="${line.size}"
            aria-label="Quitar ${product.name} del carrito"
          >
            Quitar
          </button>
        </article>
      `;
    })
    .join("");

  attachImageFallbacks(container);
}






function openProductModal(id) {
  const product = PRODUCTS.find(item => item.id === String(id));

  if (!product) return;

  const modal = document.getElementById("productModal");
  const content = document.getElementById("productModalContent");

  if (!modal || !content) return;

  const galleryImages = [
  {
    color: "",
    imagen: product.image
  },
  ...(product.images || []).filter(img =>
    img.imagen !== product.image
  )
];

const colors = [...new Set(
  galleryImages
    .map(item => item.color)
    .filter(Boolean)
)];
  // Identificar el color de la imagen principal
  const mainImage = product.image || "";
  const initialColor = "";
  product.images.find(img => img.imagen === mainImage)?.color ||
  product.variants?.[0]?.color ||
  colors[0] ||
  "";

  const hasMultipleColors = colors.length > 0;
  const sizes = (product.tallas || "")
  .split(",")
  .map(size => size.trim())
  .filter(Boolean);

  content.innerHTML = `
    <div class="product-detail">

      <div class="product-detail-image">

        <!-- Imagen principal -->
        <img
          id="detailProductImage"
          src="${mainImage || getProductImageByColor(product, initialColor)}"
          alt="${product.name}"
        >

        <!-- Colores debajo de la imagen -->
        ${
          hasMultipleColors
            ? `
              <div class="detail-color-gallery">
                ${galleryImages.map(item => `
                  <button
                    type="button"
                    class="detail-color-option ${item.imagen === mainImage ? "active" : ""}"
                    data-color="${item.color}"
                    ${!item.color ? 'data-main-image="true"' : ""}
                    aria-label="Seleccionar color ${item.color}"
                  >
                    <img
                      src="${item.imagen}"
                      alt="Camiseta color ${item.color}"
                    >
                    <span>${item.color || "Principal"}</span>
                  </button>
                `).join("")}
              </div>
            `
            : ""
        }
      </div>

      <div class="product-detail-info">

        <h2>${product.name}</h2>

        <h3>S/ ${Number(product.price).toFixed(2)}</h3>

        <input
          type="hidden"
          class="product-color"
          id="detailColor"
          value="${initialColor}"
        >

        <p>Selecciona una talla:</p>

        <!-- Tallas como botones -->
        <div class="detail-sizes" id="detailSizes">
          ${sizes.map(size => `
            <button
              type="button"
              class="detail-size-option"
              data-size="${size}"
            >
              ${size}
            </button>
          `).join("")}
        </div>

        <input
          type="hidden"
          class="product-size"
          id="detailSize"
          value=""
        >

        <p id="detailStock">Selecciona una talla.</p>

        <button
          type="button"
          class="btn-primary"
          data-modal-add="${product.id}"
          disabled
        >
          Agregar al carrito
        </button>

      </div>
    </div>
  `;

  modal.hidden = false;
  document.body.style.overflow = "hidden";
}




function closeProductModal() {
  const modal = document.getElementById("productModal");

  if (!modal) return;

  modal.hidden = true;
  document.body.style.overflow = "";
}


function addToCart(id, source = null) {
  const product = PRODUCTS.find(
    item => item.id === String(id)
  );

  if (!product) return;

  const container = source
    ? source.closest("#productModalContent")
    : document.getElementById("productModalContent");

  const color = container?.querySelector("#detailColor")?.value || "Principal";
  const size = container?.querySelector("#detailSize")?.value;

  if (!size) {
    showToast("Selecciona una talla.");
    return;
  }

  const stock = getVariantStock(product, color, size);

  if (stock <= 0) {
    showToast("Esta combinación está agotada.");
    return;
  }

  // Contar todas las unidades del mismo producto y color
  const usedStock = state.cart
    .filter(item =>
      item.id === String(id) &&
      item.color === color
    )
    .reduce((total, item) => total + item.qty, 0);

  if (usedStock >= stock) {
    showToast(`Solo hay ${stock} unidades disponibles para este color.`);
    return;
  }

  const line = state.cart.find(item =>
    item.id === String(id) &&
    item.color === color &&
    item.size === size
  );

  if (line) {
    line.qty++;
  } else {
    state.cart.push({
      id: String(id),
      qty: 1,
      color,
      size
    });
  }

      saveCart();
      renderCart();
      showToast("Camiseta agregada");
    }



function changeQty(id, delta, color, size) {
  const line = state.cart.find(item =>
    item.id === String(id) &&
    item.color === color &&
    item.size === size
  );

  const product = PRODUCTS.find(
    item => item.id === String(id)
  );

  if (!line || !product) return;

  // Consultar stock de la variante seleccionada
  const stock = getVariantStock(product, color, size);

  const newQty = line.qty + delta;

  if (newQty > stock) {
    showToast(`Solo hay ${stock} unidades disponibles.`);
    return;
  }

  if (newQty <= 0) {
    state.cart = state.cart.filter(item =>
      !(
        item.id === String(id) &&
        item.color === color &&
        item.size === size
      )
    );
  } else {
    line.qty = newQty;
  }

  saveCart();
  renderCart();
}




function removeLine(id, color, size) {
  state.cart = state.cart.filter(
    (item) =>
      !(
        item.id === id &&
        item.color === color &&
        item.size === size
      )
  );

  saveCart();
  renderCart();

  showToast("Producto eliminado del carrito.");
}


function openCart() {
  const overlay = document.getElementById("overlay");
  const drawer = document.getElementById("cartDrawer");
  const closeButton = document.getElementById("cartClose");

  if (!overlay || !drawer) return;

  overlay.hidden = false;
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");

  document.body.classList.add("cart-is-open");

  if (closeButton) {
    closeButton.focus();
  }
}


function closeCart() {
  const overlay = document.getElementById("overlay");
  const drawer = document.getElementById("cartDrawer");
  const openButton = document.getElementById("cartOpen");

  if (!overlay || !drawer) return;

  overlay.hidden = true;
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");

  document.body.classList.remove("cart-is-open");

  if (openButton) {
    openButton.focus();
  }
}

/* =========================
   9. NOTIFICACIONES
========================= */

let toastTimer;

function showToast(message) {
  const toast = document.getElementById("toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("is-on");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("is-on");
  }, 2500);
}

/* =========================
   10. NAVEGACIÓN ENTRE VISTAS
========================= */

function closeMobileMenu() {
  const nav = document.getElementById("mainNav");
  const toggle = document.getElementById("menuToggle");

  if (nav) {
    nav.classList.remove("is-open");
  }

  if (toggle) {
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menú");
  }
}

function setView(name, options = {}) {
  const view = VIEWS.includes(name) ? name : "inicio";

  document.querySelectorAll("[data-view]").forEach((element) => {
    element.hidden = element.dataset.view !== view;
  });

  const navMap = {
    inicio: "inicio",
    tienda: "tienda",
    nosotros: "nosotros",
    contacto: "contacto",
    cuenta: "cuenta"
  };

  document.querySelectorAll(".nav-link").forEach((link) => {
    const key = link.dataset.nav;

    const active = options.fromCategories
      ? key === "categorias"
      : key === navMap[view];

    link.classList.toggle("is-active", active);
  });

  closeMobileMenu();

  if (!options.silentScroll) {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }
}

function routeFromHash() {
  const hash = (location.hash || "#inicio").slice(1);

  if (hash === "categorias") {
    setView("inicio", {
      fromCategories: true,
      silentScroll: true
    });

    const categories = document.getElementById("categorias");

    if (categories) {
      setTimeout(() => {
        categories.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }, 50);
    }

    return;
  }

  setView(hash, {
    silentScroll: true
  });

  if (hash === "tienda") {
    renderShop();
  }
}

/* =========================
   11. FORMULARIOS
========================= */

function validateForm(form, errorElement) {
  if (!form || !errorElement) return false;

  errorElement.hidden = true;
  errorElement.textContent = "";

  if (!form.checkValidity()) {
    const invalidField = form.querySelector(":invalid");

    errorElement.textContent = invalidField
      ? invalidField.validationMessage
      : "Revisa los campos e inténtalo de nuevo.";

    errorElement.hidden = false;

    if (invalidField) {
      invalidField.focus();
    }

    return false;
  }

  return true;
}


async function showDemoUser() {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const userAccount = document.getElementById("userAccount");
  const userName = document.getElementById("userName");
  const userEmail = document.getElementById("userEmail");
  const authMessage = document.getElementById("authMessage");
  const authTabs = document.querySelector(".auth-tabs");

  try {
    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) throw error;

    const user = data.session?.user;

    if (user) {
      loginForm.hidden = true;
      registerForm.hidden = true;
      authTabs.hidden = true;
      userAccount.hidden = false;

      userName.textContent =
        `Bienvenido, ${user.user_metadata?.nombre || "usuario"}`;

      userEmail.textContent = user.email || "";

      authMessage.textContent =
        "Has iniciado sesión correctamente en TiendaTee.";

    } else {
      userAccount.hidden = true;
      loginForm.hidden = false;
      registerForm.hidden = true;
      authTabs.hidden = false;

      userName.textContent = "";
      userEmail.textContent = "";

      document.getElementById("tabLogin").classList.add("is-active");
      document.getElementById("tabRegister").classList.remove("is-active");

      authMessage.textContent =
        "Inicia sesión o crea tu cuenta en TiendaTee.";
    }

  } catch (error) {
    console.error("Error al consultar la sesión:", error);
    showToast("No se pudo comprobar tu sesión.");
  }
}

/* =========================
   12. EVENTOS
========================= */

function bindEvents() {
  const carouselPrev = document.getElementById("carouselPrev");
  const carouselNext = document.getElementById("carouselNext");
  const searchForm = document.getElementById("searchForm");
  const filters = document.getElementById("filters");
  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");

  /* Carrusel */
  if (carouselPrev) {
    carouselPrev.addEventListener("click", () => {
      moveCarousel(-1);
    });
  }

  if (carouselNext) {
    carouselNext.addEventListener("click", () => {
      moveCarousel(1);
    });
  }

  /* Botones de productos y categorías */
  document.body.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) return;


    // Abrir detalles al hacer clic en un producto
    const productCard = target.closest(".product-card");

        // Abrir detalles desde el botón
    const detailsButton = target.closest("[data-details]");

    if (detailsButton) {
      openProductModal(detailsButton.dataset.details);
      return;
    }

    if (productCard && !target.closest("button, a, select, input")) {
      openProductModal(productCard.dataset.id);
      return;
    }

    
    
   
    // Seleccionar color haciendo clic en su imagen
    const colorOption = target.closest(".detail-color-option");

    if (colorOption) {
      const container = document.getElementById("productModalContent");
      const addButton = container.querySelector("[data-modal-add]");
      const product = PRODUCTS.find(
        item => item.id === String(addButton?.dataset.modalAdd)
      );

      if (!product) return;

      const color = colorOption.dataset.color;

const colorInput = container.querySelector("#detailColor");
const image = container.querySelector("#detailProductImage");
const sizeInput = container.querySelector("#detailSize");
const stockText = container.querySelector("#detailStock");

// Si se selecciona la imagen principal
if (colorOption.dataset.mainImage === "true") {
  colorInput.value = "";
  image.src = product.image;

  container.querySelectorAll(".detail-color-option").forEach(option => {
    option.classList.remove("active");
  });

  colorOption.classList.add("active");

  const sizes = (product.tallas || "")
    .split(",")
    .map(size => size.trim())
    .filter(Boolean);

  console.log("Tallas principales:", product.tallas);
  console.log("Tallas separadas:", sizes);

  container.querySelector("#detailSizes").innerHTML = sizes.map(size => `
    <button
      type="button"
      class="detail-size-option"
      data-size="${size}"
    >
      ${size}
    </button>
  `).join("");

  sizeInput.value = "";
  addButton.disabled = true;
  stockText.textContent = "Selecciona una talla.";

  return;
}

      colorInput.value = color;
      image.src = getProductImageByColor(product, color);

      container.querySelectorAll(".detail-color-option").forEach(option => {
        option.classList.remove("active");
      });

      colorOption.classList.add("active");

      const sizes = getAvailableSizes(product, color);

      container.querySelector("#detailSizes").innerHTML = sizes.map(size => `
        <button
          type="button"
          class="detail-size-option"
          data-size="${size}"
        >
          ${size}
        </button>
      `).join("");

      sizeInput.value = "";
      addButton.disabled = true;

      stockText.textContent = sizes.length
        ? "Selecciona una talla."
        : "No hay tallas disponibles para este color.";

      return;
    }

    // Seleccionar talla haciendo clic en su botón
const sizeOption = target.closest(".detail-size-option");

if (sizeOption) {
  const container = document.getElementById("productModalContent");
  const addButton = container.querySelector("[data-modal-add]");
  const colorInput = container.querySelector("#detailColor");
  const sizeInput = container.querySelector("#detailSize");
  const stockText = container.querySelector("#detailStock");

  const product = PRODUCTS.find(
    item => item.id === String(addButton?.dataset.modalAdd)
  );

  if (!product) return;

  const color = colorInput.value;
  const size = sizeOption.dataset.size;
  const stock = getVariantStock(product, color, size);

  sizeInput.value = size;

  container.querySelectorAll(".detail-size-option").forEach(button => {
    button.classList.remove("active");
  });

  sizeOption.classList.add("active");

  stockText.textContent = stock > 0
    ? `${stock} unidades disponibles`
    : "Producto agotado.";

  addButton.disabled = stock <= 0;

  return;
}

    // Cerrar ventana de detalles
    if (target.closest("#productModalClose")) {
      closeProductModal();
      return;
    }

    // Agregar producto desde la ventana
    const modalAdd = target.closest("[data-modal-add]");

    if (modalAdd) {
      addToCart(modalAdd.dataset.modalAdd, modalAdd);
      return;
    }

    // Abrir otro producto relacionado
    const related = target.closest("[data-related]");

    if (related) {
      openProductModal(related.dataset.related);
      return;
    }


    const addButton = target.closest("[data-add]");

    if (addButton) {
      addToCart(addButton.dataset.add, addButton);
      return;
    }

    const qtyButton = target.closest("[data-qty]");

if (qtyButton) {
  changeQty(
    qtyButton.dataset.qty,
    Number(qtyButton.dataset.delta),
    qtyButton.dataset.color,
    qtyButton.dataset.size
  );
  return;
}

    const removeButton = target.closest("[data-remove]");
if (removeButton) {
  removeLine(
    removeButton.dataset.remove,
    removeButton.dataset.color,
    removeButton.dataset.size
  );
  return;
}

    const categoryCard = target.closest(".category-card");

    if (categoryCard) {
      goShop(categoryCard.dataset.filter || "all", "");
      return;
    }

    const resetButton = target.closest("[data-reset-search]");

    if (resetButton) {
      goShop("all", "");

      const input = document.getElementById("searchInput");

      if (input) input.value = "";
    }
  });

    /* Selección de talla en los detalles */
  document.body.addEventListener("change", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLSelectElement)) return;
    if (target.id !== "detailSize") return;

    const container = target.closest("#productModalContent");
    if (!container) return;

    const addButton = container.querySelector("[data-modal-add]");
    const colorInput = container.querySelector("#detailColor");
    const stockText = container.querySelector("#detailStock");

    const product = PRODUCTS.find(
      item => item.id === String(addButton?.dataset.modalAdd)
    );

    if (!product || !colorInput || !addButton) return;

    const color = colorInput.value;
    const size = target.value;

    const stock = size
  ? getVariantStock(product, color || "Principal", size)
  : 0;

    if (stockText) {
      stockText.textContent = stock > 0
        ? `${stock} unidades disponibles`
        : "Selecciona una talla disponible.";
    }

    addButton.disabled = stock <= 0;
  });

/* Selección de color y talla */
document.body.addEventListener("change", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLSelectElement)) return;

  const container = target.closest(
    ".product-card, #productModalContent"
  );

  if (!container) return;

  const isModal = container.id === "productModalContent";

  const addButton = container.querySelector(
    isModal ? "[data-modal-add]" : "[data-add]"
  );

  if (!addButton) return;

  const productId = isModal
    ? addButton.dataset.modalAdd
    : addButton.dataset.add;

  const product = PRODUCTS.find(
    item => item.id === String(productId)
  );

  if (!product) return;

  const colorSelect = container.querySelector(".product-color");
  const sizeSelect = container.querySelector(".product-size");

  const image = isModal
    ? container.querySelector("#detailProductImage")
    : container.querySelector(".product-image");

  const stockText = isModal
    ? container.querySelector("#detailStock")
    : container.querySelector(".stock-status");

  // Al seleccionar un color
  if (target === colorSelect) {
    const color = colorSelect.value;

    if (image) {
      image.src = color
        ? getProductImageByColor(product, color)
        : product.image;
    }

    sizeSelect.innerHTML = `
      <option value="">Selecciona una talla</option>
    `;

    sizeSelect.disabled = !color;

    if (color) {
      const sizes = getAvailableSizes(product, color);

      if (sizes.length) {
        sizeSelect.innerHTML += sizes.map(size => `
          <option value="${size}">${size}</option>
        `).join("");

        if (stockText) {
          stockText.textContent = "Selecciona una talla.";
        }
      } else {
        sizeSelect.innerHTML = `
          <option value="">Sin tallas disponibles</option>
        `;

        if (stockText) {
          stockText.textContent = "No hay stock de este color.";
        }
      }
    } else if (stockText) {
      stockText.textContent = "Selecciona un color y una talla.";
    }
  }

  // Comprobar stock de la combinación
  const color = colorSelect.value;
  const size = sizeSelect.value;

  const stock = color && size
    ? getVariantStock(product, color, size)
    : 0;

  if (color && size && stockText) {
    stockText.textContent = stock > 0
      ? `${stock} unidades disponibles`
      : "Esta combinación está agotada.";
  }

  addButton.disabled = !(size && stock > 0);
});



  /* Filtros */
  if (filters) {
    filters.addEventListener("click", (event) => {
      const target = event.target;

      if (!(target instanceof Element)) return;

      const chip = target.closest("[data-filter]");

      if (!chip) return;

      state.filter = CATEGORY_LABELS[chip.dataset.filter]
        ? chip.dataset.filter
        : "all";

      state.carouselIndex = 0;

      renderShop();
    });
  }

  /* Buscador */
  if (searchForm) {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const input = document.getElementById("searchInput");
      const query = input ? input.value.trim() : "";

      goShop("all", query);
    });
  }

  /* Menú para móviles */
  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("is-open");

      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute(
        "aria-label",
        isOpen ? "Cerrar menú" : "Abrir menú"
      );
    });

    mainNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        closeMobileMenu();
      });
    });
  }

  /* Carrito */
  const cartOpenButton = document.getElementById("cartOpen");
  const cartCloseButton = document.getElementById("cartClose");
  const overlay = document.getElementById("overlay");
  const checkoutButton = document.getElementById("checkoutBtn");

  if (cartOpenButton) {
    cartOpenButton.addEventListener("click", openCart);
  }

  if (cartCloseButton) {
    cartCloseButton.addEventListener("click", closeCart);
  }

  if (overlay) {
    overlay.addEventListener("click", closeCart);
  }

  if (checkoutButton) {
    checkoutButton.addEventListener("click", () => {
      if (!state.cart.length) {
        showToast("Agrega productos antes de continuar.");
        return;
      }

      showToast("Demostración: no se procesan pagos reales.");
    });
  }

/* Cerrar paneles con Escape */
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCart();
    closeProductModal();
    closeMobileMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCart();
    closeProductModal();
    closeMobileMenu();
  }
});

/* Cerrar detalles al pulsar fuera del contenido */
const productModal = document.getElementById("productModal");

if (productModal) {
  productModal.addEventListener("click", (event) => {
    if (event.target === productModal) {
      closeProductModal();
    }
  });
}


 /* Contacto */
const contactForm = document.getElementById("contactForm");

if (contactForm) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const errorElement = document.getElementById("contactError");

    if (!validateForm(contactForm, errorElement)) return;

    const nombre = contactForm.elements.nombre.value.trim();
    const email = contactForm.elements.email.value.trim();
    const mensaje = contactForm.elements.mensaje.value.trim();

    try {
      const { error } = await supabaseClient
        .from("Mensajes")
        .insert([{ nombre, email, mensaje }]);

      if (error) throw error;

      showToast("¡Mensaje enviado correctamente!");
      contactForm.reset();

    } catch (error) {
      console.error("Error de Supabase:", error);

      errorElement.textContent =
        "No se pudo enviar el mensaje. Inténtalo nuevamente.";

      errorElement.hidden = false;
    }
  });
}

  /* Pestañas de cuenta */
  const tabLogin = document.getElementById("tabLogin");
  const tabRegister = document.getElementById("tabRegister");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  if (tabLogin && tabRegister && loginForm && registerForm) {
    tabLogin.addEventListener("click", () => {
      loginForm.hidden = false;
      registerForm.hidden = true;

      tabLogin.classList.add("is-active");
      tabRegister.classList.remove("is-active");
    });

    tabRegister.addEventListener("click", () => {
      loginForm.hidden = true;
      registerForm.hidden = false;

      tabRegister.classList.add("is-active");
      tabLogin.classList.remove("is-active");
    });
  }

 
  /* INICIO DE SESIÓN REAL CON SUPABASE */
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const errorElement = document.getElementById("loginError");

      if (!validateForm(loginForm, errorElement)) return;

      const email = loginForm.elements.email.value.trim();
      const password = loginForm.elements.password.value;

      const submitButton = loginForm.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = "Ingresando...";

      try {
        const { error } = await supabaseClient.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        await showDemoUser();
        showToast("¡Bienvenido a TiendaTee!");

      } catch (error) {
        console.error("Error al iniciar sesión:", error);
        errorElement.textContent = "No se pudo iniciar sesión. Verifica tu correo y contraseña.";
        errorElement.hidden = false;

      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Iniciar sesión";
      }
    });
  }

  
/* REGISTRO REAL CON SUPABASE */
if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const errorElement = document.getElementById("registerError");

    if (!validateForm(registerForm, errorElement)) return;

    const nombre = registerForm.elements.nombre.value.trim();
    const email = registerForm.elements.email.value.trim();
    const password = registerForm.elements.password.value;

    const submitButton = registerForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Creando cuenta...";

    errorElement.hidden = true;
    errorElement.textContent = "";

    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { nombre }
        }
      });

      if (error) throw error;

      // Comprobar si Supabase detectó un correo ya registrado.
      if (data.user && data.user.identities?.length === 0) {
        throw new Error("Este correo ya está registrado. Inicia sesión.");
      }

      if (!data.user) {
        throw new Error("No se pudo crear la cuenta. Inténtalo nuevamente.");
      }

      // Cerrar la sesión automática para que el usuario ingrese manualmente.
      if (data.session) {
        const { error: logoutError } =
          await supabaseClient.auth.signOut();

        if (logoutError) throw logoutError;
      }

      registerForm.reset();

      // Volver a la pestaña de inicio de sesión.
      const tabLogin = document.getElementById("tabLogin");

      if (tabLogin) {
        tabLogin.click();
      }

      await showDemoUser();

      document.getElementById("authMessage").textContent =
        "¡Registro exitoso! Ahora inicia sesión con tu correo y contraseña.";

      showToast("¡Registro exitoso! Ahora inicia sesión.");

    } catch (error) {
      console.error("Error al registrarse:", error);
      errorElement.textContent = error.message;
      errorElement.hidden = false;

    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Crear mi cuenta";
    }
  });
}


  /* CERRAR SESIÓN */
  const logoutBtn = document.getElementById("logoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        const { error } = await supabaseClient.auth.signOut();

        if (error) throw error;

        await showDemoUser();
        showToast("Sesión cerrada correctamente.");

      } catch (error) {
        console.error("Error al cerrar sesión:", error);
        showToast("No se pudo cerrar la sesión.");
      }
    });
  }

  /* Navegación por enlaces */
  window.addEventListener("hashchange", routeFromHash);

  window.addEventListener("popstate", routeFromHash);

  /* Adaptación del carrusel al cambiar el tamaño */
  let resizeTimer;

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(() => {
      updateCarousel();
    }, 120);
  });

  /* Deslizar carrusel en móviles */
  const viewport = document.getElementById("carouselViewport");

  if (viewport) {
    let startX = 0;
    let startY = 0;

    viewport.addEventListener("touchstart", (event) => {
      if (!event.changedTouches.length) return;

      startX = event.changedTouches[0].clientX;
      startY = event.changedTouches[0].clientY;
    }, { passive: true });

    viewport.addEventListener("touchend", (event) => {
      if (!event.changedTouches.length) return;

      const endX = event.changedTouches[0].clientX;
      const endY = event.changedTouches[0].clientY;

      const deltaX = endX - startX;
      const deltaY = endY - startY;

      /* No interferir con el desplazamiento vertical de la página */
      if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY)) {
        return;
      }

      moveCarousel(deltaX < 0 ? 1 : -1);
    }, { passive: true });
  }
}

/* 13. INICIALIZACIÓN
========================= */

async function init() {
  await loadProducts();

  state.cart = loadCart();

  renderCarousel();
  renderShop();
  renderCart();
  bindEvents();

  await showDemoUser();

  supabaseClient.auth.onAuthStateChange(() => {
    setTimeout(() => {
      showDemoUser();
    }, 0);
  });

  routeFromHash();
}


if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
