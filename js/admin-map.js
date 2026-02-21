const ADMIN_MAP_DEFAULT_COORDS = { lat: 12.8654, lng: -85.2072 };
const ADMIN_MAP_DEFAULT_ZOOM = 7;

const setupAdminMap = ({ latitudeField, longitudeField, statusNode }) => {
  const mapCanvas = document.getElementById('admin-property-map');
  const searchInput = document.getElementById('admin-map-search');
  const useMapLocationButton = document.getElementById('admin-use-map-location');
  const liveCoordinatesNode = document.getElementById('admin-live-coordinates');

  if (!mapCanvas || !latitudeField || !longitudeField) {
    return null;
  }

  let map;
  let marker;

  const setStatus = (message) => {
    if (statusNode) {
      statusNode.textContent = message;
    }
  };

  const formatCoordinate = (value) => Number(value).toFixed(6);

  const updateLiveCoordinates = (lat, lng) => {
    if (!liveCoordinatesNode) return;
    liveCoordinatesNode.textContent = `Lat: ${formatCoordinate(lat)} · Lng: ${formatCoordinate(lng)}`;
  };

  const applyCoordinatesToFields = (lat, lng) => {
    latitudeField.value = formatCoordinate(lat);
    longitudeField.value = formatCoordinate(lng);
    updateLiveCoordinates(lat, lng);
  };

  const moveMarker = (lat, lng, shouldPan = true) => {
    if (!map || !marker) return;
    marker.setPosition({ lat, lng });
    if (shouldPan) {
      map.panTo({ lat, lng });
    }
    applyCoordinatesToFields(lat, lng);
  };

  const getCurrentFieldsCoordinates = () => {
    const lat = Number(latitudeField.value);
    const lng = Number(longitudeField.value);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
    return null;
  };

  const setFromMapCenter = () => {
    if (!map) return;
    const center = map.getCenter();
    if (!center) return;
    moveMarker(center.lat(), center.lng(), false);
    setStatus('Coordenadas actualizadas desde el centro del mapa.');
  };

  const syncFromInputs = () => {
    const coords = getCurrentFieldsCoordinates();
    if (!coords) return;
    moveMarker(coords.lat, coords.lng, true);
  };

  const setupSearch = () => {
    if (!searchInput || !window.google?.maps?.places) return;
    const searchBox = new google.maps.places.SearchBox(searchInput);

    map.addListener('bounds_changed', () => {
      const bounds = map.getBounds();
      if (bounds) searchBox.setBounds(bounds);
    });

    searchBox.addListener('places_changed', () => {
      const places = searchBox.getPlaces();
      if (!places?.length) return;

      const place = places[0];
      if (!place.geometry?.location) return;

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      map.setZoom(14);
      moveMarker(lat, lng, true);
      setStatus(`Ubicación encontrada: ${place.formatted_address || place.name}`);
    });
  };

  const initMap = async () => {
    try {
      await loadGoogleMapsApi();
      const start = getCurrentFieldsCoordinates() || ADMIN_MAP_DEFAULT_COORDS;

      map = new google.maps.Map(mapCanvas, {
        center: start,
        zoom: getCurrentFieldsCoordinates() ? 14 : ADMIN_MAP_DEFAULT_ZOOM,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true
      });

      marker = new google.maps.Marker({
        position: start,
        map,
        draggable: true,
        title: 'Ubicación de la propiedad'
      });

      applyCoordinatesToFields(start.lat, start.lng);

      map.addListener('click', (event) => {
        if (!event.latLng) return;
        moveMarker(event.latLng.lat(), event.latLng.lng());
        setStatus('Coordenadas actualizadas desde el mapa.');
      });

      marker.addListener('dragend', () => {
        const position = marker.getPosition();
        if (!position) return;
        applyCoordinatesToFields(position.lat(), position.lng());
        setStatus('Coordenadas actualizadas al mover el marcador.');
      });

      latitudeField.addEventListener('input', syncFromInputs);
      longitudeField.addEventListener('input', syncFromInputs);

      if (useMapLocationButton) {
        useMapLocationButton.addEventListener('click', setFromMapCenter);
      }

      setupSearch();
    } catch (error) {
      mapCanvas.innerHTML = '<p class="admin-map-fallback">No se pudo cargar el mapa. Revisa la API key de Google Maps para habilitar esta función.</p>';
      setStatus('Mapa no disponible: configura la API key para usar selección visual.');
    }
  };

  initMap();

  return {
    setCoordinates(lat, lng) {
      const nextLat = Number(lat);
      const nextLng = Number(lng);
      if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return;

      if (map && marker) {
        map.setZoom(14);
        moveMarker(nextLat, nextLng, true);
      } else {
        applyCoordinatesToFields(nextLat, nextLng);
      }
    },
    resetToDefault() {
      this.setCoordinates(ADMIN_MAP_DEFAULT_COORDS.lat, ADMIN_MAP_DEFAULT_COORDS.lng);
      if (map) {
        map.setZoom(ADMIN_MAP_DEFAULT_ZOOM);
      }
    }
  };
};

window.setupAdminMap = setupAdminMap;
