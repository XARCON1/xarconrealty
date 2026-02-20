const ADMIN_AUTH_KEY = 'xarcon-admin-auth';
const ADMIN_CREDENTIALS_HASH_KEY = 'xarcon-admin-credentials-hash';
const ADMIN_STORAGE_KEYS = window.XARCON_STORAGE_KEYS || {
  properties: 'xarcon_properties',
  primaryLegacyProperties: 'realEstateProperties',
  legacyProperties: 'xarcon-admin-properties',
  overrides: 'xarcon-admin-property-overrides',
  deleted: 'xarcon-admin-deleted-properties'
};

const textEncoder = new TextEncoder();

const hashText = async (value) => {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const getDefaultCredentialHash = async () => hashText('admin:Xarcon#2026');

const getStoredCredentialHash = async () => {
  const stored = localStorage.getItem(ADMIN_CREDENTIALS_HASH_KEY);
  if (stored) return stored;
  const fallback = await getDefaultCredentialHash();
  localStorage.setItem(ADMIN_CREDENTIALS_HASH_KEY, fallback);
  return fallback;
};

const safeParse = (value, fallback) => {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch (error) {
    return fallback;
  }
};

const getStoredProperties = () => {
  const primary = safeParse(localStorage.getItem(ADMIN_STORAGE_KEYS.properties) || '[]', []);
  if (Array.isArray(primary) && primary.length) {
    return primary;
  }

  const primaryLegacy = safeParse(localStorage.getItem(ADMIN_STORAGE_KEYS.primaryLegacyProperties) || '[]', []);
  if (Array.isArray(primaryLegacy) && primaryLegacy.length) {
    localStorage.setItem(ADMIN_STORAGE_KEYS.properties, JSON.stringify(primaryLegacy));
    return primaryLegacy;
  }

  const legacy = safeParse(localStorage.getItem(ADMIN_STORAGE_KEYS.legacyProperties) || '[]', []);
  if (Array.isArray(legacy) && legacy.length) {
    localStorage.setItem(ADMIN_STORAGE_KEYS.properties, JSON.stringify(legacy));
    return legacy;
  }

  return Array.isArray(primary) ? primary : [];
};
const getOverrides = () => safeParse(localStorage.getItem(ADMIN_STORAGE_KEYS.overrides) || '{}', {});
const getDeletedIds = () => safeParse(localStorage.getItem(ADMIN_STORAGE_KEYS.deleted) || '[]', []);

const setStoredProperties = (properties) => localStorage.setItem('xarcon_properties', JSON.stringify(properties));
const setOverrides = (overrides) => localStorage.setItem(ADMIN_STORAGE_KEYS.overrides, JSON.stringify(overrides));
const setDeletedIds = (ids) => localStorage.setItem(ADMIN_STORAGE_KEYS.deleted, JSON.stringify(ids));

const createSlug = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const generateUniquePropertyId = (title, usedIds, preferredId = '') => {
  const normalizedPreferredId = preferredId.trim();
  if (normalizedPreferredId && !usedIds.has(normalizedPreferredId)) {
    return normalizedPreferredId;
  }

  const baseSlug = createSlug(title) || 'propiedad';
  let suffix = 1;
  let candidate = baseSlug;

  while (usedIds.has(candidate)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });

const requireAuth = () => {
  if (sessionStorage.getItem(ADMIN_AUTH_KEY) !== 'true') {
    window.location.replace('index.html');
    return false;
  }
  return true;
};

const getPropertyOriginMap = async () => {
  const response = await fetch('data/properties.json');
  const defaults = response.ok ? await response.json() : [];
  const customIds = new Set(getStoredProperties().map((property) => property.id));
  const originMap = {};

  defaults.forEach((property) => {
    originMap[property.id] = customIds.has(property.id) ? 'custom' : 'default';
  });

  customIds.forEach((id) => {
    originMap[id] = 'custom';
  });

  return originMap;
};

const setupAdminDashboard = async () => {
  if (!requireAuth()) return;

  const logoutButton = document.getElementById('admin-logout');
  const quickAddButton = document.getElementById('admin-quick-add');
  const propertyForm = document.getElementById('admin-property-form');
  const propertyList = document.getElementById('admin-property-list');
  const formStatus = document.getElementById('admin-form-status');
  const imageInput = document.getElementById('field-images');
  const imagePreview = document.getElementById('image-preview');
  const totalCountNode = document.getElementById('counter-total');
  const soldCountNode = document.getElementById('counter-sold');
  const availableCountNode = document.getElementById('counter-available');

  const fieldIds = {
    id: document.getElementById('field-id'),
    title: document.getElementById('field-title'),
    price: document.getElementById('field-price'),
    location: document.getElementById('field-location'),
    city: document.getElementById('field-city'),
    address: document.getElementById('field-address'),
    type: document.getElementById('field-type'),
    bedrooms: document.getElementById('field-bedrooms'),
    bathrooms: document.getElementById('field-bathrooms'),
    description: document.getElementById('field-description'),
    featured: document.getElementById('field-featured'),
    opportunity: document.getElementById('field-opportunity'),
    status: document.getElementById('field-status'),
    agent: document.getElementById('field-agent'),
    latitude: document.getElementById('field-latitude'),
    longitude: document.getElementById('field-longitude')
  };

  let uploadedImages = [];
  let originMap = await getPropertyOriginMap();

  const syncCounters = (properties) => {
    const soldCount = properties.filter((property) => property.status === 'sold').length;
    totalCountNode.textContent = String(properties.length);
    soldCountNode.textContent = String(soldCount);
    availableCountNode.textContent = String(properties.length - soldCount);
  };

  const fillForm = (property) => {
    fieldIds.id.value = property.id;
    fieldIds.title.value = property.title;
    fieldIds.price.value = property.price;
    fieldIds.location.value = property.location;
    fieldIds.city.value = property.city || '';
    fieldIds.address.value = property.address || '';
    fieldIds.type.value = property.type || '';
    fieldIds.bedrooms.value = property.bedrooms || 0;
    fieldIds.bathrooms.value = property.bathrooms || 0;
    fieldIds.description.value = property.description;
    fieldIds.featured.checked = Boolean(property.featured);
    fieldIds.opportunity.checked = Boolean(property.opportunity);
    fieldIds.status.value = property.status || 'available';
    fieldIds.agent.value = property.agent || 'Equipo Xarcon';
    fieldIds.latitude.value = Number.isFinite(Number(property.latitude)) ? property.latitude : '';
    fieldIds.longitude.value = Number.isFinite(Number(property.longitude)) ? property.longitude : '';

    uploadedImages = [...(property.images || [])];
    imagePreview.innerHTML = uploadedImages.map((src) => `<img src="${src}" alt="Vista previa" />`).join('');

    propertyForm.dataset.mode = 'edit';
    formStatus.textContent = `Editando: ${property.title}`;
    propertyForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const resetForm = () => {
    propertyForm.reset();
    fieldIds.id.value = '';
    fieldIds.status.value = 'available';
    fieldIds.agent.value = 'Equipo Xarcon';
    uploadedImages = [];
    imagePreview.innerHTML = '';
    propertyForm.dataset.mode = 'create';
  };

  const renderProperties = async () => {
    const properties = await window.getProperties();
    console.debug('[XARCON][ADMIN] Render inventory with merged properties:', properties.length);
    syncCounters(properties);

    propertyList.innerHTML = properties.length
      ? properties
          .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
          .map(
            (property) => `
              <tr>
                <td><strong>${property.title}</strong><br/><small>${property.id}</small></td>
                <td>${property.agent || 'Equipo Xarcon'}</td>
                <td>${property.location}</td>
                <td>${formatPrice(property.price)}</td>
                <td><span class="admin-status-pill ${property.status === 'sold' ? 'sold' : 'available'}">${property.status === 'sold' ? 'Vendida' : 'Disponible'}</span></td>
                <td>${property.dateAdded}</td>
                <td class="admin-list-actions">
                  <button class="btn btn-outline" data-edit="${property.id}" type="button">Editar</button>
                  <button class="btn btn-outline" data-toggle-sold="${property.id}" type="button">${property.status === 'sold' ? 'Marcar disponible' : 'Marcar vendida'}</button>
                  <button class="btn btn-outline" data-delete="${property.id}" type="button">Eliminar</button>
                </td>
              </tr>
            `
          )
          .join('')
      : '<tr><td colspan="7">No hay propiedades disponibles.</td></tr>';
  };

  const saveProperty = (property, mode) => {
    const normalized = window.normalizeProperty(property);
    const storedProperties = getStoredProperties();
    const overrides = getOverrides();
    const deletedIds = new Set(getDeletedIds());
    deletedIds.delete(normalized.id);

    if (mode === 'create') {
      const withoutDuplicate = storedProperties.filter((item) => item.id !== normalized.id);
      withoutDuplicate.unshift(normalized);
      setStoredProperties(withoutDuplicate);
      setDeletedIds([...deletedIds]);
      console.debug('[XARCON][ADMIN] Property created and saved in localStorage:', normalized);
      return;
    }

    if (originMap[normalized.id] === 'default') {
      overrides[normalized.id] = {
        ...normalized,
        dateAdded: normalized.dateAdded,
        status: normalized.status,
        sold: normalized.status === 'sold'
      };
      setOverrides(overrides);
      console.debug('[XARCON][ADMIN] Default property override saved:', normalized.id, overrides[normalized.id]);
    } else {
      const updated = storedProperties.map((item) => (item.id === normalized.id ? normalized : item));
      setStoredProperties(updated);
      console.debug('[XARCON][ADMIN] Custom property updated:', normalized.id);
    }

    setDeletedIds([...deletedIds]);
  };

  const deletePropertyById = (propertyId) => {
    const stored = getStoredProperties();
    const overrides = getOverrides();
    const deletedIds = new Set(getDeletedIds());
    const isCustom = originMap[propertyId] === 'custom';

    if (isCustom) {
      setStoredProperties(stored.filter((item) => item.id !== propertyId));
    } else {
      delete overrides[propertyId];
      setOverrides(overrides);
      deletedIds.add(propertyId);
    }

    setDeletedIds([...deletedIds]);
  };

  logoutButton.addEventListener('click', () => {
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
    window.location.replace('index.html');
  });

  quickAddButton.addEventListener('click', () => {
    resetForm();
    formStatus.textContent = 'Modo rápido: completa los campos y guarda.';
    fieldIds.title.focus();
  });

  imageInput.addEventListener('change', async () => {
    const files = [...imageInput.files];
    if (!files.length) return;
    const loaded = await Promise.all(files.map(fileToDataUrl));
    uploadedImages = loaded;
    imagePreview.innerHTML = uploadedImages.map((src) => `<img src="${src}" alt="Vista previa" />`).join('');
  });

  propertyForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!uploadedImages.length) {
      formStatus.textContent = 'Debes subir al menos una imagen.';
      return;
    }

    const mode = propertyForm.dataset.mode || 'create';
    const title = fieldIds.title.value.trim();
    const requestedId = fieldIds.id.value.trim();
    const usedIds = new Set((await window.getProperties()).map((item) => item.id));
    if (propertyForm.dataset.mode === 'edit' && requestedId) {
      usedIds.delete(requestedId);
    }
    const currentId = generateUniquePropertyId(title, usedIds, requestedId);

    if (!requestedId && currentId !== createSlug(title)) {
      formStatus.textContent = `ID autogenerado para evitar duplicados: ${currentId}`;
    }

    const property = {
      id: currentId,
      title,
      price: Number(fieldIds.price.value),
      location: fieldIds.location.value.trim(),
      images: uploadedImages,
      description: fieldIds.description.value.trim(),
      type: fieldIds.type.value,
      bedrooms: Number(fieldIds.bedrooms.value || 0),
      bathrooms: Number(fieldIds.bathrooms.value || 0),
      featured: fieldIds.featured.checked,
      opportunity: fieldIds.opportunity.checked,
      status: fieldIds.status.value,
      sold: fieldIds.status.value === 'sold',
      dateAdded: new Date().toISOString().slice(0, 10),
      city: fieldIds.city.value.trim(),
      address: fieldIds.address.value.trim(),
      latitude: fieldIds.latitude.value === '' ? null : Number(fieldIds.latitude.value),
      longitude: fieldIds.longitude.value === '' ? null : Number(fieldIds.longitude.value),
      agent: fieldIds.agent.value.trim() || 'Equipo Xarcon'
    };

    if (mode === 'edit') {
      const existing = (await window.getProperties()).find((item) => item.id === currentId);
      if (existing?.dateAdded) {
        property.dateAdded = existing.dateAdded;
      }
    }

    saveProperty(property, mode);
    console.debug('[XARCON][ADMIN] Form submit payload:', property);
    originMap = await getPropertyOriginMap();
    await renderProperties();
    resetForm();
    formStatus.textContent = 'Propiedad guardada correctamente.';
  });

  propertyList.addEventListener('click', async (event) => {
    const deleteId = event.target.dataset.delete;
    const toggleId = event.target.dataset.toggleSold;
    const editId = event.target.dataset.edit;

    if (editId) {
      const properties = await window.getProperties();
      const selected = properties.find((item) => item.id === editId);
      if (selected) fillForm(selected);
      return;
    }

    if (toggleId) {
      const properties = await window.getProperties();
      const selected = properties.find((item) => item.id === toggleId);
      if (!selected) return;
      saveProperty({ ...selected, status: selected.status === 'sold' ? 'available' : 'sold' }, 'edit');
      await renderProperties();
      formStatus.textContent = 'Estado actualizado correctamente.';
      return;
    }

    if (deleteId) {
      deletePropertyById(deleteId);
      originMap = await getPropertyOriginMap();
      await renderProperties();
      formStatus.textContent = 'Propiedad eliminada del catálogo público.';
    }
  });

  resetForm();
  await renderProperties();
};

document.addEventListener('DOMContentLoaded', () => {
  setupAdminDashboard();
});
