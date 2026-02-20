const MAPS_DEFAULT_CENTER = { lat: 12.1149926, lng: -86.2361744 };
const MAPS_DEFAULT_ZOOM = 9;
const PROPERTY_OVERRIDES_KEY = 'xarcon-property-overrides';

const getMapApiKey = () => window.XARCON_MAPS_API_KEY || document.querySelector('meta[name="xarcon-maps-key"]')?.content || '';

const loadGoogleMapsApi = () => {
  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  const key = getMapApiKey();
  if (!key || key === 'YOUR_GOOGLE_MAPS_API_KEY') {
    return Promise.reject(new Error('missing-key'));
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.google.maps));
      existingScript.addEventListener('error', () => reject(new Error('load-failed')));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places,geometry`;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error('load-failed'));
    document.head.append(script);
  });
};

const getPropertyOverrides = () => {
  try {
    return JSON.parse(localStorage.getItem(PROPERTY_OVERRIDES_KEY) || '{}');
  } catch (error) {
    return {};
  }
};

const savePropertyOverrides = (overrides) => {
  localStorage.setItem(PROPERTY_OVERRIDES_KEY, JSON.stringify(overrides));
};

const toGeoProperty = (property) => {
  const overrides = getPropertyOverrides()[property.id] || {};
  const latitude = Number(overrides.latitude ?? property.latitude);
  const longitude = Number(overrides.longitude ?? property.longitude);

  return {
    ...property,
    city: overrides.city || property.city,
    address: overrides.address || property.address,
    latitude,
    longitude,
    hasCoordinates: Number.isFinite(latitude) && Number.isFinite(longitude)
  };
};

const setupPropertiesMapPage = async () => {
  const mapNode = document.getElementById('properties-map');
  if (!mapNode) return;

  const statusNode = document.getElementById('map-status');
  const listNode = document.getElementById('map-preview-list');
  const citySelect = document.getElementById('map-filter-city');
  const typeSelect = document.getElementById('map-filter-type');
  const priceInput = document.getElementById('map-filter-price');
  const resetButton = document.getElementById('map-reset-filters');
  const totalNode = document.getElementById('map-filter-total');
  const filterToggle = document.getElementById('map-filter-toggle');
  const panelNode = document.getElementById('map-control-panel');

  const editorForm = document.getElementById('coordinate-editor-form');
  const editorProperty = document.getElementById('editor-property-id');
  const editorCity = document.getElementById('editor-city');
  const editorAddress = document.getElementById('editor-address');
  const editorLat = document.getElementById('editor-latitude');
  const editorLng = document.getElementById('editor-longitude');

  const propertiesRaw = await getProperties();
  const properties = propertiesRaw.map(toGeoProperty);
  console.debug('[XARCON][MAP] Properties loaded for map:', {
    merged: propertiesRaw.length,
    withCoordinates: properties.filter((property) => property.hasCoordinates).length
  });

  [...new Set(properties.map((property) => property.city).filter(Boolean))].sort().forEach((city) => {
    citySelect.insertAdjacentHTML('beforeend', `<option value="${city}">${city}</option>`);
  });

  [...new Set(properties.map((property) => property.type))].sort().forEach((type) => {
    typeSelect.insertAdjacentHTML('beforeend', `<option value="${type}">${type}</option>`);
  });

  editorProperty.innerHTML = properties
    .map((property) => `<option value="${property.id}">${property.title}</option>`)
    .join('');

  const syncEditor = () => {
    const selected = properties.find((property) => property.id === editorProperty.value) || properties[0];
    if (!selected) return;
    editorCity.value = selected.city || '';
    editorAddress.value = selected.address || '';
    editorLat.value = Number.isFinite(selected.latitude) ? String(selected.latitude) : '';
    editorLng.value = Number.isFinite(selected.longitude) ? String(selected.longitude) : '';
  };

  syncEditor();
  editorProperty.addEventListener('change', syncEditor);

  let map;
  let infoWindow;
  let cluster;
  const markerById = new Map();

  const getFilteredProperties = () => {
    const maxPrice = Number(priceInput.value || Number.MAX_SAFE_INTEGER);
    const city = citySelect.value;
    const type = typeSelect.value;

    return properties.filter((property) => {
      if (!property.hasCoordinates) return false;
      const matchCity = !city || property.city === city;
      const matchType = !type || property.type === type;
      const matchPrice = property.price <= maxPrice;
      return matchCity && matchType && matchPrice;
    });
  };

  const renderPreviewList = (items) => {
    totalNode.textContent = `${items.length} propiedad(es) en el mapa`;
    listNode.innerHTML = items
      .slice(0, 6)
      .map((property) => {
        const detailHref = `propiedades/propiedad-template.html?id=${property.id}`;
        return `
          <article class="map-property-preview reveal">
            <img src="${property.images[0]}" alt="${property.title}" loading="lazy" />
            <div>
              <strong>${property.title}</strong>
              <p>${property.city} · ${formatPrice(property.price)}</p>
              <a href="${detailHref}" class="btn btn-outline">View Property</a>
            </div>
          </article>
        `;
      })
      .join('');
  };

  const getInfoCard = (property) => `
    <article class="map-info-card">
      <img src="${property.images[0]}" alt="${property.title}" loading="lazy" />
      <div class="map-info-content">
        <h3>${property.title}</h3>
        <p class="price">${formatPrice(property.price)}</p>
        <p class="location">${property.address || property.location}</p>
        <a class="btn btn-primary" href="propiedades/propiedad-template.html?id=${property.id}">View Property</a>
      </div>
    </article>
  `;

  const renderMarkers = () => {
    const filtered = getFilteredProperties();
    console.debug('[XARCON][MAP] Marker render run:', {
      total: properties.length,
      filtered: filtered.length,
      city: citySelect.value,
      type: typeSelect.value,
      price: Number(priceInput.value || Number.MAX_SAFE_INTEGER)
    });
    renderPreviewList(filtered);

    if (!map) return;
    const bounds = map.getBounds();
    const visible = bounds
      ? filtered.filter((property) => bounds.contains(new google.maps.LatLng(property.latitude, property.longitude)))
      : filtered;

    if (cluster) {
      cluster.clearMarkers();
    }

    const visibleMarkers = visible.map((property) => {
      let marker = markerById.get(property.id);
      if (!marker) {
        marker = new google.maps.Marker({
          position: { lat: property.latitude, lng: property.longitude },
          title: property.title
        });

        marker.addListener('click', () => {
          infoWindow.setContent(getInfoCard(property));
          infoWindow.open({ map, anchor: marker });
          map.panTo(marker.getPosition());
        });

        markerById.set(property.id, marker);
      }
      return marker;
    });

    cluster = new markerClusterer.MarkerClusterer({ map, markers: visibleMarkers });
    statusNode.textContent = filtered.length
      ? `Mapa activo con ${filtered.length} propiedad(es).`
      : 'No hay propiedades con coordenadas para el filtro actual.';
  };

  try {
    await loadGoogleMapsApi();
    map = new google.maps.Map(mapNode, {
      center: MAPS_DEFAULT_CENTER,
      zoom: MAPS_DEFAULT_ZOOM,
      mapTypeControl: false,
      fullscreenControl: true,
      streetViewControl: false,
      gestureHandling: 'greedy'
    });

    infoWindow = new google.maps.InfoWindow();
    map.addListener('idle', () => window.requestAnimationFrame(renderMarkers));

    const filtered = getFilteredProperties();
    if (filtered.length) {
      const bounds = new google.maps.LatLngBounds();
      filtered.forEach((property) => bounds.extend({ lat: property.latitude, lng: property.longitude }));
      map.fitBounds(bounds, 60);
    }

    renderMarkers();
  } catch (error) {
    statusNode.textContent =
      error.message === 'missing-key'
        ? 'Agrega tu Google Maps API key en js/maps-config.js para activar el mapa.'
        : 'No fue posible cargar Google Maps en este momento.';
  }

  [citySelect, typeSelect, priceInput].forEach((element) => {
    element.addEventListener('input', renderMarkers);
    element.addEventListener('change', renderMarkers);
  });

  resetButton.addEventListener('click', () => {
    citySelect.value = '';
    typeSelect.value = '';
    priceInput.value = '';
    renderMarkers();
  });

  filterToggle.addEventListener('click', () => {
    panelNode.classList.toggle('open');
  });

  editorForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const propertyId = editorProperty.value;
    const overrides = getPropertyOverrides();
    overrides[propertyId] = {
      city: editorCity.value.trim(),
      address: editorAddress.value.trim(),
      latitude: Number(editorLat.value),
      longitude: Number(editorLng.value)
    };

    savePropertyOverrides(overrides);

    const selectedIndex = properties.findIndex((property) => property.id === propertyId);
    if (selectedIndex >= 0) {
      properties[selectedIndex] = toGeoProperty(properties[selectedIndex]);
    }

    renderMarkers();
    statusNode.textContent = 'Ubicación guardada correctamente para la propiedad seleccionada.';
  });
};

const setupPropertyDetailMap = async () => {
  const detailMapNode = document.getElementById('property-detail-map');
  if (!detailMapNode) return;

  const propertyId = detailMapNode.dataset.propertyId;
  const properties = (await getProperties()).map(toGeoProperty);
  const property = properties.find((item) => item.id === propertyId);

  if (!property?.hasCoordinates) {
    detailMapNode.textContent = 'Coordenadas pendientes de registro para esta propiedad.';
    return;
  }

  try {
    await loadGoogleMapsApi();
    const map = new google.maps.Map(detailMapNode, {
      center: { lat: property.latitude, lng: property.longitude },
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false
    });

    const marker = new google.maps.Marker({
      map,
      position: { lat: property.latitude, lng: property.longitude },
      title: property.title
    });

    const infoWindow = new google.maps.InfoWindow({ content: `<strong>${property.title}</strong><br/>${property.address || property.location}` });
    marker.addListener('click', () => infoWindow.open({ map, anchor: marker }));
  } catch (error) {
    detailMapNode.textContent = 'No fue posible cargar el mapa de ubicación.';
  }
};

window.setupPropertiesMapPage = setupPropertiesMapPage;
window.setupPropertyDetailMap = setupPropertyDetailMap;
