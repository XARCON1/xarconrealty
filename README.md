# XARCON INMOBILIARIA - Plataforma Web

Sitio web inmobiliario moderno, optimizado para captación de clientes y administración simple de propiedades mediante JSON.

## Estructura del proyecto

```bash
/
├── index.html
├── nosotros.html
├── propiedades.html
├── contacto.html
├── data/
│   └── properties.json
├── css/
│   └── styles.css
├── js/
│   └── main.js
└── propiedades/
    └── propiedad-template.html
```

## Cómo funciona el sistema JSON

Toda la información de propiedades se carga desde `data/properties.json`.

Cada propiedad debe incluir:

- `id` (único, usado en URL del detalle)
- `title`
- `price` (número en USD)
- `location`
- `images` (arreglo de URLs)
- `description`
- `type` (`Casa`, `Terreno`, `Local`)
- `bedrooms`
- `bathrooms`
- `featured` (true/false)
- `opportunity` (true/false)
- `createdAt` (fecha tipo `YYYY-MM-DD` para “últimas propiedades”)

## Cómo agregar nuevas propiedades

1. Abre `data/properties.json`.
2. Duplica un objeto existente dentro del arreglo.
3. Cambia el `id` por uno único (ejemplo: `casa-managua-norte`).
4. Actualiza título, precio, ubicación, descripción e imágenes.
5. Define si será destacada (`featured`) u oportunidad (`opportunity`).
6. Guarda el archivo.

> Al guardar, la propiedad aparecerá automáticamente en:
> - Buscador de `propiedades.html`
> - Sección destacadas (si `featured: true`)
> - Sección oportunidades (si `opportunity: true`)
> - Sección últimas (según `createdAt` más reciente)

## Cómo gestionar listados

### Filtros disponibles en `propiedades.html`

- Precio máximo
- Tipo de propiedad
- Ubicación
- Habitaciones mínimas
- Búsqueda por texto

### Página de detalle

La página `propiedades/propiedad-template.html` es dinámica:

- Se abre con parámetro `id`.
- Ejemplo: `propiedades/propiedad-template.html?id=casa-santo-domingo`
- Muestra galería de imágenes, datos principales, botones de contacto y área para mapa.

## Desarrollo local

Como se usa `fetch()` para cargar JSON, ejecuta el proyecto con un servidor local:

```bash
python -m http.server 8000
```

Luego abre `http://localhost:8000`.

## SEO implementado

- Títulos y descripciones por página.
- Etiquetas Open Graph en inicio.
- Estructura HTML semántica.
- Datos estructurados tipo `RealEstateAgent` en `index.html`.
