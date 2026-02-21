const ADMIN_JSON_SOURCE = 'js/properties.json';

const normalizePropertyForAdmin = (property) => {
  const latitude = Number(property.latitude ?? property.lat);
  const longitude = Number(property.longitude ?? property.lng);
  const images = Array.isArray(property.images) ? property.images.filter(Boolean) : [];

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

const parseImageUrls = (raw) =>
  raw
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);

const setupAdminPanel = async () => {
  const form = document.getElementById('admin-property-form');
  if (!form) return;

  const statusNode = document.getElementById('admin-form-status');
  const propertyList = document.getElementById('admin-property-list');
  const jsonPreview = document.getElementById('json-preview');
  const imagePreview = document.getElementById('image-preview');
  const cancelEditButton = document.getElementById('admin-cancel-edit');
  const downloadButton = document.getElementById('download-json');

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
    images: document.getElementById('field-images'),
    latitude: document.getElementById('field-latitude'),
    longitude: document.getElementById('field-longitude')
  };

  let properties = [];
  const mapController = typeof window.setupAdminMap === 'function'
    ? window.setupAdminMap({ latitudeField: fields.latitude, longitudeField: fields.longitude, statusNode })
    : null;

  const updatePreview = () => {
    const payload = JSON.stringify(properties, null, 2);
    jsonPreview.value = payload;
  };

  const renderImagePreview = () => {
    const urls = parseImageUrls(fields.images.value);
    imagePreview.innerHTML = urls
      .slice(0, 6)
      .map((url) => `<img src="${url}" alt="Preview" loading="lazy" />`)
      .join('');
  };

  const resetForm = () => {
    form.reset();
    form.dataset.mode = 'create';
    fields.id.value = '';
    fields.bedrooms.value = '0';
    fields.bathrooms.value = '0';
    fields.area.value = '0';
    imagePreview.innerHTML = '';
    if (mapController?.resetToDefault) {
      mapController.resetToDefault();
    }
  };

  const buildRow = (property) => `
    <tr>
      <td>${property.title}</td>
      <td>${property.type}</td>
      <td>${formatPrice(property.price)}</td>
      <td>${property.location}</td>
      <td class="admin-list-actions">
        <button class="btn btn-outline" data-action="edit" data-id="${property.id}" type="button">Editar</button>
        <button class="btn btn-outline" data-action="delete" data-id="${property.id}" type="button">Eliminar</button>
      </td>
    </tr>
  `;

  const renderTable = () => {
    propertyList.innerHTML = properties.map(buildRow).join('');
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
    fields.images.value = property.images.join('\n');
    renderImagePreview();

    if (mapController?.setCoordinates && Number.isFinite(property.latitude) && Number.isFinite(property.longitude)) {
      mapController.setCoordinates(property.latitude, property.longitude);
    }
  };

  const upsertProperty = () => {
    const images = parseImageUrls(fields.images.value);
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

  fields.images.addEventListener('input', renderImagePreview);

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
    const response = await fetch(ADMIN_JSON_SOURCE);
    if (!response.ok) {
      throw new Error('fetch-failed');
    }

    const data = await response.json();
    properties = Array.isArray(data) ? data.map(normalizePropertyForAdmin) : [];
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
