# XARCON INMOBILIARIA - Plataforma Web

Sitio web inmobiliario moderno, optimizado para captación de clientes y administración de propiedades vía JSON estático (compatible con GitHub Pages).

## Estructura del proyecto

```bash
/
├── index.html
├── nosotros.html
├── propiedades.html
├── propiedades-mapa.html
├── contacto.html
├── admin.html
├── css/
│   └── styles.css
├── js/
│   ├── main.js
│   ├── admin.js
│   ├── map-page.js
│   ├── maps-config.js
│   └── properties.json
└── propiedades/
    └── propiedad-template.html
```

## Fuente única de datos

Toda la información pública se carga únicamente desde `js/properties.json`.

## Panel de administración

`admin.html` permite:

- Agregar propiedades
- Editar propiedades
- Eliminar propiedades
- Cargar imágenes por URL
- Previsualizar JSON actualizado
- Descargar `properties.json` con el botón **Download updated properties.json**

> Importante: el panel no escribe en servidor. Debes descargar el archivo y reemplazar `js/properties.json` en el repositorio.

## Desarrollo local

Como se usa `fetch()` para cargar JSON, ejecuta el proyecto con un servidor local:

```bash
python -m http.server 8000
```

Luego abre `http://localhost:8000`.
