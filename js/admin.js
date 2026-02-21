const ADMIN_JSON_SOURCE = 'js/properties.json';
const ADMIN_FALLBACK_SOURCES = ['js/properties.json', './js/properties.json', '../js/properties.json'];


const normalizePropertyForAdmin = (property) => {
  const latitude = Number(property.latitude ?? property.lat);
  const longitude = Number(property.longitude ?? property.lng);
  const images = Array.isArray(property.images)
    ? property.images.filter((image) => typeof image === 'string' && image.trim())
    : [];

  return {
    id: property.id,
    title: property.title || '',
    price: Number(property.price) || 0,
    location: property.location || '',
    type: property.type || 'Casa',
    description: property.description || '',
    bedrooms: Number(property.bedrooms) || 0,
    bathrooms: Number(property.bathrooms) || 0,
    area: Number(property.area) || 0,
    images,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    city: property.city || '',
    address: property.address || '',
    featured: Boolean(property.featured),
    opportunity: Boolean(property.opportunity),
    createdAt: property.createdAt || new Date().toISOString().slice(0, 10),
    agent: property.agent || 'Equipo Xarcon'
  };
};

const generateIdFromTitle = (title) =>
  title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const isLikelyImageUrl = (url) => {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const setupAdminPanel = async () => {
  const form = document.getElementById('admin-property-form');
  if (!form) return;

  const statusNode = document.getElementById('admin-form-status');
  const propertyList = document.getElementById('admin-property-list');
  const jsonPreview = document.getElementById('json-preview');
  const cancelEditButton = document.getElementById('admin-cancel-edit');
  const downloadButton = document.getElementById('download-json');

  const imageUrlInput = document.getElementById('field-image-url');
  const addImageButton = document.getElementById('add-image-url');
  const imagePreviewNode = document.getElementById('image-preview');
  const imageUrlFeedback = document.getElementById('image-url-feedback');

  const fields = {
    id: document.getElementById('field-id'),
    title: document.getElementById('field-title'),
    price: document.getElementById('field-price'),
    location: document.getElementById('field-location'),
    type: document.getElementById('field-type'),
    description: document.getElementById('field-description'),
    bedrooms: document.getElementById('field-bedrooms'),
    bathrooms: document.getElementById('field-bathrooms'),
    area: document.getElementById('field-area'),
    latitude: document.getElementById('field-latitude'),
    longitude: document.getElementById('field-longitude')
  };

  let properties = [];
  let imageUrls = [];
  const mapController = typeof window.setupAdminMap === 'function'
    ? window.setupAdminMap({ latitudeField: fields.latitude, longitudeField: fields.longitude, statusNode })
    : null;

  const updatePreview = () => {
    const payload = JSON.stringify(properties, null, 2);
    jsonPreview.value = payload;
  };

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const setImageFeedback = (message, isError = false) => {
    imageUrlFeedback.textContent = message;
    imageUrlFeedback.classList.toggle('is-error', isError);
  };

  const renderImagePreview = (previewCandidate = '') => {
    const cards = imageUrls
      .map(
        (url, index) => `
          <article class="admin-upload-card" data-image-url="${url}">
            <img src="${url}" alt="Imagen ${index + 1}" loading="lazy" referrerpolicy="no-referrer" />
            <div class="admin-upload-card-meta">
              <p>${url}</p>
            </div>
            <button class="btn btn-outline" type="button" data-action="remove-image-url" data-image-url="${url}">Eliminar</button>
          </article>
        `
      )
      .join('');

    const previewCard = previewCandidate
      ? `
        <article class="admin-upload-card admin-upload-card-candidate">
          <img src="${previewCandidate}" alt="Vista previa nueva imagen" loading="lazy" referrerpolicy="no-referrer" />
          <div class="admin-upload-card-meta">
            <p>Vista previa pendiente</p>
          </div>
        </article>
      `
      : '';

    imagePreviewNode.innerHTML = `${previewCard}${cards}`;
  };

  const tryLoadImage = (url) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });

  const addImageUrl = async () => {
    const url = imageUrlInput.value.trim();
    if (!url) {
      setImageFeedback('Pega una URL de imagen.', true);
      return;
    }

    if (!isLikelyImageUrl(url)) {
      setImageFeedback('URL inválida. Usa una URL http(s) válida.', true);
      return;
    }

    if (imageUrls.includes(url)) {
      setImageFeedback('Esta imagen ya fue agregada.', true);
      return;
    }

    renderImagePreview(url);
    setImageFeedback('Validando imagen...', false);

    const isValidImage = await tryLoadImage(url);
    if (!isValidImage) {
      renderImagePreview();
      setImageFeedback('No se pudo cargar la imagen desde esa URL. Verifica el enlace.', true);
      return;
    }

    imageUrls.push(url);
    imageUrlInput.value = '';
    renderImagePreview();
    setImageFeedback('Imagen agregada correctamente.');
  };

  const resetForm = () => {
    form.reset();
    form.dataset.mode = 'create';
    fields.id.value = '';
    fields.bedrooms.value = '0';
    fields.bathrooms.value = '0';
    fields.area.value = '0';
    imageUrls = [];
    renderImagePreview();
    setImageFeedback('Pega una URL y agrégala para incluirla en la propiedad.');
    if (mapController?.resetToDefault) {
      mapController.resetToDefault();
    }
  };

  const buildCard = (property) => {
    const imageSrc = property.images[0] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80';

    return `
      <article class="admin-manage-card">
        <img class="admin-manage-thumb" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(property.title)}" loading="lazy" referrerpolicy="no-referrer" />
        <div class="admin-manage-content">
          <p class="admin-manage-type">${escapeHtml(property.type)}</p>
          <h3>${escapeHtml(property.title)}</h3>
          <p class="admin-manage-price">${formatPrice(property.price)}</p>
          <p class="admin-manage-location">${escapeHtml(property.location)}</p>
          <div class="admin-list-actions">
            <button class="btn btn-outline" data-action="edit" data-id="${escapeHtml(property.id)}" type="button">Editar</button>
            <button class="btn btn-outline" data-action="delete" data-id="${escapeHtml(property.id)}" type="button">Eliminar</button>
          </div>
        </div>
      </article>
    `;
  };

  const renderTable = () => {
    if (!properties.length) {
      propertyList.innerHTML = '<p class="admin-empty-state">No hay propiedades cargadas. Agrega una nueva propiedad para comenzar.</p>';
      updatePreview();
      return;
    }

    propertyList.innerHTML = properties.map(buildCard).join('');
    updatePreview();
  };

  const fillForm = (property) => {
    form.dataset.mode = 'edit';
    fields.id.value = property.id;
    fields.title.value = property.title;
    fields.price.value = String(property.price);
    fields.location.value = property.location;
    fields.type.value = property.type;
    fields.description.value = property.description;
    fields.bedrooms.value = String(property.bedrooms);
    fields.bathrooms.value = String(property.bathrooms);
    fields.area.value = String(property.area || 0);
    fields.latitude.value = Number.isFinite(property.latitude) ? String(property.latitude) : '';
    fields.longitude.value = Number.isFinite(property.longitude) ? String(property.longitude) : '';
    imageUrls = [...property.images];
    renderImagePreview();
    setImageFeedback('Editando imágenes por URL.');

    if (mapController?.setCoordinates && Number.isFinite(property.latitude) && Number.isFinite(property.longitude)) {
      mapController.setCoordinates(property.latitude, property.longitude);
    }
  };

  const upsertProperty = () => {
    const images = imageUrls.filter(Boolean);
    if (!images.length) {
      statusNode.textContent = 'Debes agregar al menos una URL de imagen válida.';
      return;
    }

    const title = fields.title.value.trim();
    const baseId = generateIdFromTitle(title);
    const existingId = fields.id.value;
    let id = existingId || baseId;

    if (!id) {
      statusNode.textContent = 'No se pudo generar un ID para la propiedad.';
      return;
    }

    if (!existingId) {
      let counter = 1;
      while (properties.some((property) => property.id === id)) {
        id = `${baseId}-${counter}`;
        counter += 1;
      }
    }

    const latitude = Number(fields.latitude.value);
    const longitude = Number(fields.longitude.value);
    const location = fields.location.value.trim();

    const property = {
      id,
      title,
      price: Number(fields.price.value) || 0,
      location,
      city: location.split(',').slice(-1)[0]?.trim() || location,
      address: location,
      type: fields.type.value,
      description: fields.description.value.trim(),
      bedrooms: Number(fields.bedrooms.value) || 0,
      bathrooms: Number(fields.bathrooms.value) || 0,
      area: Number(fields.area.value) || 0,
      images,
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
      featured: false,
      opportunity: false,
      createdAt: new Date().toISOString().slice(0, 10),
      agent: 'Equipo Xarcon'
    };

    const existingIndex = properties.findIndex((item) => item.id === id);
    if (existingIndex >= 0) {
      properties[existingIndex] = { ...properties[existingIndex], ...property };
      statusNode.textContent = 'Propiedad actualizada correctamente.';
    } else {
      properties.push(property);
      statusNode.textContent = 'Propiedad agregada correctamente.';
    }

    properties.sort((a, b) => a.title.localeCompare(b.title, 'es'));
    renderTable();
    resetForm();
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    upsertProperty();
  });

  addImageButton.addEventListener('click', addImageUrl);

  imageUrlInput.addEventListener('input', () => {
    const candidateUrl = imageUrlInput.value.trim();
    if (isLikelyImageUrl(candidateUrl)) {
      renderImagePreview(candidateUrl);
      setImageFeedback('Vista previa inmediata. Pulsa "Agregar imagen" para validar y guardar.', false);
    } else {
      renderImagePreview();
      setImageFeedback('Pega una URL y agrégala para incluirla en la propiedad.', false);
    }
  });

  imageUrlInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addImageUrl();
    }
  });

  imagePreviewNode.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="remove-image-url"]');
    if (!button) return;

    const url = button.dataset.imageUrl;
    imageUrls = imageUrls.filter((imageUrl) => imageUrl !== url);
    renderImagePreview();
    setImageFeedback(imageUrls.length ? 'Imagen eliminada.' : 'No hay imágenes agregadas todavía.');
  });

  cancelEditButton.addEventListener('click', () => {
    resetForm();
    statusNode.textContent = 'Edición cancelada.';
  });

  propertyList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const { id, action } = button.dataset;
    const property = properties.find((item) => item.id === id);
    if (!property) return;

    if (action === 'edit') {
      fillForm(property);
      statusNode.textContent = `Editando: ${property.title}`;
    }

    if (action === 'delete') {
      properties = properties.filter((item) => item.id !== id);
      renderTable();
      statusNode.textContent = 'Propiedad eliminada.';
      if (fields.id.value === id) {
        resetForm();
      }
    }
  });

  downloadButton.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(properties, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'properties.json';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    statusNode.textContent = 'Archivo properties.json descargado.';
  });

  try {
    let data = null;

    for (const source of ADMIN_FALLBACK_SOURCES) {
      try {
        const response = await fetch(source, { cache: 'no-store' });
        if (!response.ok) continue;

        data = await response.json();
        if (Array.isArray(data)) {
          statusNode.textContent = `Propiedades cargadas desde ${source}.`;
          break;
        }
      } catch (fetchError) {
        // Try the next known path.
      }
    }

    if (!Array.isArray(data)) {
      throw new Error('fetch-failed');
    }

    properties = data.map(normalizePropertyForAdmin);
    properties.sort((a, b) => a.title.localeCompare(b.title, 'es'));
    renderTable();
    resetForm();
  } catch (error) {
    statusNode.textContent = 'No se pudo cargar js/properties.json';
    properties = [];
    renderTable();
    resetForm();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  setupAdminPanel();
});
