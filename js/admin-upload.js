const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const makePreviewName = (index, image) => image.name || `Imagen ${index + 1}`;

const createAdminImageUploader = ({
  input,
  dropzone,
  preview,
  progressBar,
  progressLabel,
  statusNode,
  maxSizeBytes = MAX_IMAGE_SIZE_BYTES
}) => {
  if (!input || !dropzone || !preview) {
    throw new Error('Missing required upload nodes.');
  }

  let images = [];

  const setProgress = (value, message = '') => {
    const safeValue = Math.max(0, Math.min(100, Math.round(value)));
    if (progressBar) {
      progressBar.value = safeValue;
    }
    if (progressLabel) {
      progressLabel.textContent = message || `${safeValue}%`;
    }
  };

  const renderPreview = () => {
    preview.innerHTML = images
      .map(
        (image, index) => `
          <article class="admin-upload-card" data-image-id="${image.id}">
            <img src="${image.dataUrl}" alt="${makePreviewName(index, image)}" loading="lazy" />
            <div class="admin-upload-card-meta">
              <p>${makePreviewName(index, image)}</p>
              <small>${formatBytes(image.size)}</small>
            </div>
            <button class="btn btn-outline" type="button" data-action="remove-image" data-image-id="${image.id}">Eliminar</button>
          </article>
        `
      )
      .join('');
  };

  const notify = (message) => {
    if (statusNode) statusNode.textContent = message;
  };

  const fileToDataUrl = (file, onProgress) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}.`));
      reader.onprogress = (event) => {
        if (!event.lengthComputable) return;
        onProgress(event.loaded / event.total);
      };

      reader.readAsDataURL(file);
    });

  const addFiles = async (fileList) => {
    const files = [...fileList].filter((file) => file.type.startsWith('image/'));
    if (!files.length) {
      notify('Selecciona archivos de imagen válidos.');
      return;
    }

    const validFiles = [];
    const oversized = [];

    files.forEach((file) => {
      if (file.size > maxSizeBytes) {
        oversized.push(`${file.name} (${formatBytes(file.size)})`);
      } else {
        validFiles.push(file);
      }
    });

    if (oversized.length) {
      notify(`Se omitieron archivos mayores de 3MB: ${oversized.join(', ')}`);
    }

    if (!validFiles.length) {
      setProgress(0, 'Sin carga');
      return;
    }

    setProgress(0, 'Procesando imágenes...');

    for (let index = 0; index < validFiles.length; index += 1) {
      const file = validFiles[index];
      const baseProgress = (index / validFiles.length) * 100;

      const dataUrl = await fileToDataUrl(file, (ratio) => {
        const partial = (ratio / validFiles.length) * 100;
        setProgress(baseProgress + partial, `Subiendo ${file.name}...`);
      });

      images.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl
      });
      renderPreview();
    }

    setProgress(100, `${validFiles.length} imagen(es) lista(s)`);
    input.value = '';
  };

  const setImagesFromDataUrls = (dataUrls = []) => {
    images = dataUrls
      .filter(Boolean)
      .map((dataUrl, index) => ({
        id: `existing-${index}-${Math.random().toString(36).slice(2)}`,
        name: `Imagen ${index + 1}`,
        size: Math.ceil((dataUrl.length * 3) / 4),
        type: dataUrl.split(';')[0].replace('data:', '') || 'image/*',
        dataUrl
      }));

    renderPreview();
    setProgress(images.length ? 100 : 0, images.length ? `${images.length} imagen(es) cargada(s)` : 'Sin imágenes');
  };

  const clear = () => {
    images = [];
    input.value = '';
    renderPreview();
    setProgress(0, 'Sin imágenes');
  };

  const preventDefaults = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, preventDefaults);
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, () => dropzone.classList.add('is-dragging'));
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, () => dropzone.classList.remove('is-dragging'));
  });

  dropzone.addEventListener('drop', (event) => {
    if (event.dataTransfer?.files?.length) {
      addFiles(event.dataTransfer.files);
    }
  });


  dropzone.addEventListener('click', () => input.click());
  dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });

  input.addEventListener('change', (event) => {
    if (event.target.files?.length) {
      addFiles(event.target.files);
    }
  });

  preview.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="remove-image"]');
    if (!button) return;

    const imageId = button.dataset.imageId;
    images = images.filter((image) => image.id !== imageId);
    renderPreview();
    setProgress(images.length ? 100 : 0, images.length ? `${images.length} imagen(es) cargada(s)` : 'Sin imágenes');
  });

  setProgress(0, 'Sin imágenes');

  return {
    getImages: () => images.map((image) => image.dataUrl),
    setImagesFromDataUrls,
    clear,
    addFiles
  };
};

window.createAdminImageUploader = createAdminImageUploader;
