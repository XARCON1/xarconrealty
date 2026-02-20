const WHATSAPP_NUMBER = '50588889999';
const ADMIN_STORAGE_KEYS = {
  properties: 'xarcon-admin-properties',
  overrides: 'xarcon-admin-property-overrides',
  deleted: 'xarcon-admin-deleted-properties'
};

const formatPrice = (value) =>
  new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);

const getBasePath = () => (window.location.pathname.includes('/propiedades/') ? '../' : '');

const safeParse = (value, fallback) => {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch (error) {
    return fallback;
  }
};

const normalizeProperty = (property) => {
  const soldValue = property.status ? property.status === 'sold' : Boolean(property.sold);
  const status = soldValue ? 'sold' : 'available';

  return {
    ...property,
    price: Number(property.price) || 0,
    images: Array.isArray(property.images) ? property.images.filter(Boolean) : [],
    status,
    sold: soldValue,
    agent: property.agent || 'Equipo Xarcon',
    dateAdded: property.dateAdded || property.createdAt || new Date().toISOString().slice(0, 10),
    createdAt: property.dateAdded || property.createdAt || new Date().toISOString().slice(0, 10),
    latitude: Number.isFinite(Number(property.latitude)) ? Number(property.latitude) : null,
    longitude: Number.isFinite(Number(property.longitude)) ? Number(property.longitude) : null
  };
};

const getAdminProperties = () => {
  const stored = safeParse(localStorage.getItem(ADMIN_STORAGE_KEYS.properties) || '[]', []);
  return Array.isArray(stored) ? stored.map(normalizeProperty) : [];
};

const getAdminOverrides = () => {
  const stored = safeParse(localStorage.getItem(ADMIN_STORAGE_KEYS.overrides) || '{}', {});
  return stored && typeof stored === 'object' ? stored : {};
};

const getDeletedPropertyIds = () => {
  const stored = safeParse(localStorage.getItem(ADMIN_STORAGE_KEYS.deleted) || '[]', []);
  return Array.isArray(stored) ? new Set(stored) : new Set();
};

const mergeProperties = (baseProperties, adminProperties, overrides, deletedIds) => {
  const mergedMap = new Map();

  [...baseProperties, ...adminProperties].forEach((property) => {
    mergedMap.set(property.id, normalizeProperty(property));
  });

  Object.entries(overrides).forEach(([propertyId, override]) => {
    const source = mergedMap.get(propertyId);
    if (!source) return;
    mergedMap.set(propertyId, normalizeProperty({ ...source, ...override }));
  });

  return [...mergedMap.values()].filter((property) => !deletedIds.has(property.id));
};

const getProperties = async () => {
  const response = await fetch(`${getBasePath()}data/properties.json`);
  if (!response.ok) {
    throw new Error('No se pudieron cargar las propiedades.');
  }

  const basePropertiesRaw = await response.json();
  const baseProperties = Array.isArray(basePropertiesRaw) ? basePropertiesRaw.map(normalizeProperty) : [];
  const adminProperties = getAdminProperties();
  const adminOverrides = getAdminOverrides();
  const deletedIds = getDeletedPropertyIds();

  return mergeProperties(baseProperties, adminProperties, adminOverrides, deletedIds);
};

window.XARCON_STORAGE_KEYS = ADMIN_STORAGE_KEYS;
window.getProperties = getProperties;
window.normalizeProperty = normalizeProperty;

const createPropertyCard = (property) => {
  const bedrooms = property.bedrooms > 0 ? `${property.bedrooms} hab` : 'Uso flexible';
  const detailHref = `${getBasePath()}propiedades/propiedad-template.html?id=${property.id}`;
  const locationText = property.address ? `${property.address}, ${property.city}` : property.location;

  return `
    <article class="property-card reveal ${property.status === 'sold' ? 'property-card-sold' : ''}">
      <img src="${property.images[0]}" alt="${property.title}" loading="lazy" />
      <div class="property-content">
        <p class="property-chip">${property.type}</p>
        ${property.status === 'sold' ? '<p class="sold-chip">Vendida</p>' : ''}
        <h3>${property.title}</h3>
        <p class="price">${formatPrice(property.price)}</p>
        <p class="location">${locationText}</p>
        <p>${property.description}</p>
        <div class="property-meta">
          <span>${bedrooms}</span>
          <span>${property.bathrooms} baños</span>
        </div>
        <a class="btn btn-outline" href="${detailHref}">Ver detalles</a>
      </div>
    </article>
  `;
};

const setupMenuAndYear = () => {
  const menuButton = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.nav-links');
  const links = document.querySelectorAll('.nav-links a');
  const yearElement = document.getElementById('year');

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  if (menuButton && navLinks) {
    menuButton.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(isOpen));
    });

    links.forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        menuButton.setAttribute('aria-expanded', 'false');
      });
    });
  }
};

const setupHomeSections = async () => {
  const featuredNode = document.getElementById('featured-properties');
  const latestNode = document.getElementById('latest-properties');
  const opportunitiesNode = document.getElementById('opportunity-properties');

  if (!featuredNode && !latestNode && !opportunitiesNode) {
    return;
  }

  const properties = await getProperties();
  const latestProperties = [...properties].sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded)).slice(0, 3);

  if (featuredNode) {
    featuredNode.innerHTML = properties.filter((property) => property.featured).slice(0, 3).map(createPropertyCard).join('');
  }

  if (latestNode) {
    latestNode.innerHTML = latestProperties.map(createPropertyCard).join('');
  }

  if (opportunitiesNode) {
    opportunitiesNode.innerHTML = properties.filter((property) => property.opportunity).slice(0, 3).map(createPropertyCard).join('');
  }
};

const setupPropertiesPage = async () => {
  const listingNode = document.getElementById('properties-list');
  if (!listingNode) {
    return;
  }

  const properties = await getProperties();
  const typeSelect = document.getElementById('filter-type');
  const locationSelect = document.getElementById('filter-location');
  const bedroomsSelect = document.getElementById('filter-bedrooms');
  const priceInput = document.getElementById('filter-price');
  const searchInput = document.getElementById('filter-search');
  const resetButton = document.getElementById('reset-filters');
  const resultCount = document.getElementById('result-count');

  const queryText = new URLSearchParams(window.location.search).get('q');
  if (queryText) {
    searchInput.value = queryText;
  }

  [...new Set(properties.map((property) => property.type))].forEach((type) => {
    typeSelect.insertAdjacentHTML('beforeend', `<option value="${type}">${type}</option>`);
  });

  [...new Set(properties.map((property) => property.location))].forEach((location) => {
    locationSelect.insertAdjacentHTML('beforeend', `<option value="${location}">${location}</option>`);
  });

  const render = () => {
    const maxPrice = Number(priceInput.value || Number.MAX_SAFE_INTEGER);
    const minBedrooms = Number(bedroomsSelect.value || 0);
    const selectedType = typeSelect.value;
    const selectedLocation = locationSelect.value;
    const text = searchInput.value.trim().toLowerCase();

    const filtered = properties.filter((property) => {
      const matchPrice = property.price <= maxPrice;
      const matchType = !selectedType || property.type === selectedType;
      const matchLocation = !selectedLocation || property.location === selectedLocation;
      const matchBedrooms = property.bedrooms >= minBedrooms;
      const matchText = !text || `${property.title} ${property.description}`.toLowerCase().includes(text);
      return matchPrice && matchType && matchLocation && matchBedrooms && matchText;
    });

    listingNode.innerHTML = filtered.map(createPropertyCard).join('');
    resultCount.textContent = `${filtered.length} propiedad(es) encontrada(s)`;
  };

  [typeSelect, locationSelect, bedroomsSelect, priceInput, searchInput].forEach((element) => {
    element.addEventListener('input', render);
    element.addEventListener('change', render);
  });

  resetButton.addEventListener('click', () => {
    typeSelect.value = '';
    locationSelect.value = '';
    bedroomsSelect.value = '';
    priceInput.value = '';
    searchInput.value = '';
    render();
  });

  render();
};

const setupPropertyDetail = async () => {
  const detailNode = document.getElementById('property-detail-content');
  if (!detailNode) {
    return;
  }

  const properties = await getProperties();
  const params = new URLSearchParams(window.location.search);
  const propertyId = params.get('id');
  const property = properties.find((item) => item.id === propertyId) || properties[0];

  document.title = `XARCON INMOBILIARIA | ${property.title}`;

  detailNode.innerHTML = `
    <section class="detail-gallery">
      <img id="main-detail-image" src="${property.images[0]}" alt="${property.title}" class="detail-image" />
      <div class="gallery-controls">
        <button class="btn btn-outline" id="gallery-prev" type="button">←</button>
        <button class="btn btn-outline" id="gallery-next" type="button">→</button>
      </div>
      <div class="thumb-grid">
        ${property.images
          .map(
            (image, index) =>
              `<button class="thumb ${index === 0 ? 'active' : ''}" data-image-index="${index}" type="button"><img src="${image}" alt="Vista ${index + 1} de ${property.title}" /></button>`
          )
          .join('')}
      </div>
    </section>
    <section class="detail-content reveal">
      <p class="property-chip">${property.type}</p>
      <h1>${property.title}</h1>
      <p class="price">${formatPrice(property.price)}</p>
      <p class="location">${property.address ? `${property.address}, ${property.city}` : property.location}</p>
      ${property.status === 'sold' ? '<p class="sold-note">Esta propiedad ya se encuentra vendida.</p>' : ''}
      <p>${property.description}</p>
      <div class="detail-stats">
        <span><strong>Habitaciones:</strong> ${property.bedrooms}</span>
        <span><strong>Baños:</strong> ${property.bathrooms}</span>
        <span><strong>Agente:</strong> ${property.agent}</span>
      </div>
      ${
        property.status === 'sold'
          ? '<div class="detail-cta-row"><a href="../contacto.html" class="btn btn-outline">Solicitar propiedades similares</a></div>'
          : `<div class="detail-cta-row">
               <a href="../contacto.html" class="btn btn-primary">Solicitar información</a>
               <a href="https://wa.me/${WHATSAPP_NUMBER}?text=Hola%20Xarcon%2C%20quiero%20informaci%C3%B3n%20de%20${encodeURIComponent(property.title)}" class="btn btn-whatsapp" target="_blank" rel="noopener noreferrer">Contactar por WhatsApp</a>
             </div>`
      }
      <div id="property-detail-map" class="detail-map" data-property-id="${property.id}" aria-label="Mapa de ubicación de la propiedad"></div>
    </section>
  `;

  let currentImage = 0;
  const mainImageNode = document.getElementById('main-detail-image');
  const thumbs = [...detailNode.querySelectorAll('.thumb')];

  const updateGallery = () => {
    mainImageNode.src = property.images[currentImage];
    thumbs.forEach((thumb, index) => thumb.classList.toggle('active', index === currentImage));
  };

  detailNode.querySelector('#gallery-prev').addEventListener('click', () => {
    currentImage = (currentImage - 1 + property.images.length) % property.images.length;
    updateGallery();
  });

  detailNode.querySelector('#gallery-next').addEventListener('click', () => {
    currentImage = (currentImage + 1) % property.images.length;
    updateGallery();
  });

  thumbs.forEach((thumb) => {
    thumb.addEventListener('click', () => {
      currentImage = Number(thumb.dataset.imageIndex);
      updateGallery();
    });
  });
};

document.addEventListener('DOMContentLoaded', async () => {
  setupMenuAndYear();

  try {
    await Promise.all([setupHomeSections(), setupPropertiesPage(), setupPropertyDetail()]);
    if (typeof window.setupPropertiesMapPage === 'function') {
      await window.setupPropertiesMapPage();
    }
    if (typeof window.setupPropertyDetailMap === 'function') {
      await window.setupPropertyDetailMap();
    }
  } catch (error) {
    const dynamicNodes = document.querySelectorAll('[data-dynamic-error]');
    dynamicNodes.forEach((node) => {
      node.textContent = 'No se pudo cargar la información en este momento. Intenta nuevamente.';
    });
  }
});
