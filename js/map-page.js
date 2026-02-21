const MAPS_DEFAULT_CENTER = { lat: 12.1149926, lng: -86.2361744 };
const MAPS_DEFAULT_ZOOM = 9;


const MAP_PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80';
const getMapPropertyImage = (property) =>
  Array.isArray(property.images) && property.images[0] ? property.images[0] : MAP_PLACEHOLDER_IMAGE;

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

const toGeoProperty = (property) => ({
  ...property,
  city: property.city || property.location,
  address: property.address || property.location,
  latitude: Number(property.latitude),
  longitude: Number(property.longitude),
  hasCoordinates: Number.isFinite(Number(property.latitude)) && Number.isFinite(Number(property.longitude))
});

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

  const propertiesRaw = await getProperties();
  const properties = propertiesRaw.map(toGeoProperty);

  [...new Set(properties.map((property) => property.city).filter(Boolean))].sort().forEach((city) => {
    citySelect.insertAdjacentHTML('beforeend', `<option value="${city}">${city}</option>`);
  });

  [...new Set(properties.map((property) => property.type))].sort().forEach((type) => {
    typeSelect.insertAdjacentHTML('beforeend', `<option value="${type}">${type}</option>`);
  });

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
            <img src="${getMapPropertyImage(property)}" alt="${property.title}" loading="lazy" />
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
      <img src="${getMapPropertyImage(property)}" alt="${property.title}" loading="lazy" />
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
