const ADMIN_AUTH_KEY = 'xarcon-admin-auth';
const ADMIN_PROPERTIES_KEY = 'xarcon-admin-properties';
const ADMIN_CREDENTIALS_HASH_KEY = 'xarcon-admin-credentials-hash';

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

const getStoredProperties = () => {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_PROPERTIES_KEY) || '[]');
  } catch (error) {
    return [];
  }
};

const setStoredProperties = (properties) => localStorage.setItem(ADMIN_PROPERTIES_KEY, JSON.stringify(properties));

const createSlug = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });

const setupAdminDashboard = async () => {
  const loginSection = document.getElementById('admin-login');
  const dashboardSection = document.getElementById('admin-dashboard');
  if (!loginSection || !dashboardSection) return;

  const loginForm = document.getElementById('admin-login-form');
  const loginStatus = document.getElementById('admin-login-status');
  const userInput = document.getElementById('admin-user');
  const passInput = document.getElementById('admin-pass');
  const logoutButton = document.getElementById('admin-logout');

  const propertyForm = document.getElementById('admin-property-form');
  const propertyList = document.getElementById('admin-property-list');
  const formStatus = document.getElementById('admin-form-status');
  const imageInput = document.getElementById('field-images');
  const imagePreview = document.getElementById('image-preview');

  let uploadedImages = [];

  const renderAuth = () => {
    const isLogged = sessionStorage.getItem(ADMIN_AUTH_KEY) === 'true';
    loginSection.classList.toggle('hidden', isLogged);
    dashboardSection.classList.toggle('hidden', !isLogged);
  };

  const renderProperties = () => {
    const properties = getStoredProperties();
    propertyList.innerHTML = properties.length
      ? properties
          .map(
            (property) => `
          <article class="admin-list-card">
            <img src="${property.images[0]}" alt="${property.title}" loading="lazy" />
            <div>
              <strong>${property.title}</strong>
              <p>${property.location} · $${Number(property.price).toLocaleString('en-US')}</p>
              <p>${property.sold ? 'Estado: Vendida' : 'Estado: Disponible'}</p>
              <div class="admin-list-actions">
                <button class="btn btn-outline" data-toggle-sold="${property.id}" type="button">${property.sold ? 'Marcar disponible' : 'Marcar vendida'}</button>
                <button class="btn btn-outline" data-delete="${property.id}" type="button">Eliminar</button>
              </div>
            </div>
          </article>
        `
          )
          .join('')
      : '<p>No hay propiedades guardadas aún. Agrega la primera para publicar.</p>';
  };

  const upsertProperty = (property) => {
    const current = getStoredProperties();
    current.unshift(property);
    setStoredProperties(current);
    renderProperties();
  };

  imageInput.addEventListener('change', async () => {
    const files = [...imageInput.files];
    uploadedImages = [];
    imagePreview.innerHTML = '';

    if (!files.length) return;

    uploadedImages = await Promise.all(files.map(fileToDataUrl));
    imagePreview.innerHTML = uploadedImages.map((src) => `<img src="${src}" alt="Vista previa" />`).join('');
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const enteredHash = await hashText(`${userInput.value.trim()}:${passInput.value}`);
    const credentialHash = await getStoredCredentialHash();

    if (enteredHash !== credentialHash) {
      loginStatus.textContent = 'Credenciales inválidas. Intenta nuevamente.';
      return;
    }

    sessionStorage.setItem(ADMIN_AUTH_KEY, 'true');
    loginStatus.textContent = '';
    loginForm.reset();
    renderAuth();
    renderProperties();
  });

  logoutButton.addEventListener('click', () => {
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
    renderAuth();
  });

  propertyForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!uploadedImages.length) {
      formStatus.textContent = 'Debes subir al menos una imagen.';
      return;
    }

    const title = document.getElementById('field-title').value.trim();
    const id = `${createSlug(title)}-${Date.now().toString().slice(-6)}`;

    const property = {
      id,
      title,
      price: Number(document.getElementById('field-price').value),
      location: document.getElementById('field-location').value.trim(),
      images: uploadedImages,
      description: document.getElementById('field-description').value.trim(),
      type: document.getElementById('field-type').value,
      bedrooms: Number(document.getElementById('field-bedrooms').value || 0),
      bathrooms: Number(document.getElementById('field-bathrooms').value || 0),
      featured: document.getElementById('field-featured').checked,
      opportunity: document.getElementById('field-opportunity').checked,
      sold: document.getElementById('field-sold').checked,
      createdAt: new Date().toISOString().slice(0, 10),
      city: document.getElementById('field-city').value.trim(),
      address: document.getElementById('field-address').value.trim(),
      latitude: null,
      longitude: null
    };

    upsertProperty(property);
    propertyForm.reset();
    uploadedImages = [];
    imagePreview.innerHTML = '';
    formStatus.textContent = 'Propiedad guardada y publicada automáticamente.';
  });

  propertyList.addEventListener('click', (event) => {
    const deleteId = event.target.dataset.delete;
    const toggleId = event.target.dataset.toggleSold;
    const properties = getStoredProperties();

    if (deleteId) {
      const filtered = properties.filter((item) => item.id !== deleteId);
      setStoredProperties(filtered);
      renderProperties();
      return;
    }

    if (toggleId) {
      const updated = properties.map((item) => (item.id === toggleId ? { ...item, sold: !item.sold } : item));
      setStoredProperties(updated);
      renderProperties();
    }
  });

  renderAuth();
  if (sessionStorage.getItem(ADMIN_AUTH_KEY) === 'true') {
    renderProperties();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  setupAdminDashboard();
});
