
/* ==========================================================
   TIENDATEE
   Catálogo, buscador, filtros, carrusel y carrito.
   Diseño adaptable. Demostración sin pagos reales.
========================================================== */

"use strict";

/* =========================
   1. PRODUCTOS
========================= */

const PRODUCTS = [
  {
    id: "andina",
    name: "Camiseta Andina 10",
    price: 89.9,
    oldPrice: 119.9,
    category: "hombres",
    image: "assets/prod-andina.jpg",
    bestseller: true,
    badge: "Oferta"
  },
  {
    id: "nocturna",
    name: "Camiseta Nocturna",
    price: 99.9,
    category: "hombres",
    image: "assets/prod-nocturna.jpg",
    bestseller: true,
    badge: "Destacado"
  },
  {
    id: "blanca",
    name: "Camiseta Blanca Clásica",
    price: 79.9,
    category: "hombres",
    image: "assets/prod-blanca.jpg",
    bestseller: true
  },
  {
    id: "costa",
    name: "Camiseta Costa Azul",
    price: 94.9,
    category: "estilos",
    image: "assets/prod-costa.jpg",
    bestseller: true
  },
  {
    id: "clasica",
    name: "Camiseta Rayas Urbanas",
    price: 109.9,
    category: "estilos",
    image: "assets/prod-clasica.jpg",
    bestseller: true,
    badge: "Destacado"
  },
  {
    id: "mujer",
    name: "Camiseta Celeste Dama",
    price: 89.9,
    category: "mujeres",
    image: "assets/prod-mujer.jpg",
    bestseller: true
  },
  {
    id: "nino",
    name: "Camiseta Junior Roja",
    price: 69.9,
    category: "ninos",
    image: "assets/prod-nino.jpg",
    bestseller: true
  },
  {
    id: "tematica",
    name: "Camiseta Crema Temática",
    price: 84.9,
    category: "tematicas",
    image: "assets/prod-tematica.jpg",
    bestseller: true
  },
  {
    id: "verde",
    name: "Camiseta Verde Bosque",
    price: 92.9,
    category: "mujeres",
    image: "assets/prod-verde.jpg"
  },
  {
    id: "negra",
    name: "Camiseta Negra Oro",
    price: 99.9,
    oldPrice: 129.9,
    category: "hombres",
    image: "assets/prod-negra.jpg",
    badge: "Oferta"
  }
];

const FALLBACK_IMG = "assets/cat-hombres.jpg";
const CART_KEY = "tiendatee-cart";
const DEMO_USER_KEY = "tiendatee-demo-user";

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
  cart: loadCart()
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
      .filter((item) => {
        return (
          item &&
          typeof item.id === "string" &&
          PRODUCTS.some((product) => product.id === item.id) &&
          Number.isInteger(item.qty) &&
          item.qty > 0
        );
      })
      .map((item) => ({
        id: item.id,
        qty: item.qty
      }));
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

function productCard(product, compact = false) {
  const badge = product.badge
    ? `<span class="badge">${product.badge}</span>`
    : "";

  const oldPrice = product.oldPrice
    ? `<s>${money(product.oldPrice)}</s> `
    : "";

  return `
    <article
      class="paper-card product-card${compact ? " compact-card" : ""}"
      data-id="${product.id}"
    >
      ${badge}

      <img
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

      <button
        type="button"
        class="btn-add"
        data-add="${product.id}"
        aria-label="Agregar ${product.name} al carrito"
      >
        Agregar al carrito
      </button>
    </article>
  `;
}

/* =========================
   6. FILTROS Y BÚSQUEDA
========================= */

function filteredProducts() {
  const query = state.query.trim().toLocaleLowerCase("es");

  return PRODUCTS.filter((product) => {
    const matchesCategory =
      state.filter === "all" ||
      product.category === state.filter;

    const matchesQuery =
      !query ||
      product.name.toLocaleLowerCase("es").includes(query);

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
    .map((line) => {
      const product = PRODUCTS.find((p) => p.id === line.id);

      if (!product) return "";

      return `
        <article class="cart-row">
          <img
            src="${product.image}"
            alt="${product.name}"
            width="70"
            height="80"
            loading="lazy"
          >

          <div class="cart-product-info">
            <strong>${product.name}</strong>

            <p>${money(product.price)}</p>

            <div class="qty-ctrl">
              <button
                type="button"
                data-qty="${product.id}"
                data-delta="-1"
                aria-label="Reducir cantidad de ${product.name}"
              >−</button>

              <span aria-label="Cantidad">${line.qty}</span>

              <button
                type="button"
                data-qty="${product.id}"
                data-delta="1"
                aria-label="Aumentar cantidad de ${product.name}"
              >+</button>
            </div>
          </div>

          <button
            type="button"
            class="remove-line"
            data-remove="${product.id}"
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

function addToCart(id) {
  const product = PRODUCTS.find((item) => item.id === id);

  if (!product) return;

  const line = state.cart.find((item) => item.id === id);

  if (line) {
    line.qty += 1;
  } else {
    state.cart.push({
      id,
      qty: 1
    });
  }

  saveCart();
  renderCart();

  showToast(`${product.name} agregado al carrito.`);
}

function changeQty(id, delta) {
  const line = state.cart.find((item) => item.id === id);

  if (!line) return;

  line.qty += delta;

  if (line.qty <= 0) {
    state.cart = state.cart.filter((item) => item.id !== id);
  }

  saveCart();
  renderCart();
}

function removeLine(id) {
  state.cart = state.cart.filter((item) => item.id !== id);

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

function showDemoUser() {
  const box = document.getElementById("demoUser");

  if (!box) return;

  try {
    const raw = localStorage.getItem(DEMO_USER_KEY);

    if (!raw) {
      box.hidden = true;
      return;
    }

    const user = JSON.parse(raw);

    if (!user || !user.email) {
      box.hidden = true;
      return;
    }

    box.textContent =
      `Demo activa: ${user.nombre ? user.nombre + " · " : ""}${user.email}`;

    box.hidden = false;
  } catch (error) {
    console.warn("No se pudo recuperar el usuario de demostración.");
    box.hidden = true;
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

    const addButton = target.closest("[data-add]");

    if (addButton) {
      addToCart(addButton.dataset.add);
      return;
    }

    const qtyButton = target.closest("[data-qty]");

    if (qtyButton) {
      changeQty(
        qtyButton.dataset.qty,
        Number(qtyButton.dataset.delta)
      );
      return;
    }

    const removeButton = target.closest("[data-remove]");

    if (removeButton) {
      removeLine(removeButton.dataset.remove);
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

  /* Cerrar panel con Escape */
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCart();
      closeMobileMenu();
    }
  });

  /* Contacto */
  const contactForm = document.getElementById("contactForm");

  if (contactForm) {
    contactForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const errorElement = document.getElementById("contactError");

      if (!validateForm(contactForm, errorElement)) return;

      showToast(
        "Mensaje validado. Esta demostración no lo envía a un servidor."
      );

      contactForm.reset();
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

  /* Inicio de sesión de demostración */
  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const errorElement = document.getElementById("loginError");

      if (!validateForm(loginForm, errorElement)) return;

      const email = loginForm.elements.email.value.trim();

      try {
        localStorage.setItem(
          DEMO_USER_KEY,
          JSON.stringify({ email })
        );
      } catch (error) {
        showToast("No se pudo guardar la sesión de demostración.");
        return;
      }

      showDemoUser();
      showToast("Sesión de demostración iniciada.");
    });
  }

  /* Registro de demostración */
  if (registerForm) {
    registerForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const errorElement = document.getElementById("registerError");

      if (!validateForm(registerForm, errorElement)) return;

      const nombre = registerForm.elements.nombre.value.trim();
      const email = registerForm.elements.email.value.trim();

      try {
        localStorage.setItem(
          DEMO_USER_KEY,
          JSON.stringify({ nombre, email })
        );
      } catch (error) {
        showToast("No se pudo guardar el registro de demostración.");
        return;
      }

      showDemoUser();
      showToast("Registro de demostración completado.");
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

/* =========================
   13. INICIALIZACIÓN
========================= */

function init() {
  renderCarousel();
  renderShop();
  renderCart();
  bindEvents();
  showDemoUser();
  routeFromHash();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
