# XARCON INMOBILIARIA - Sitio Web

Sitio web inmobiliario moderno, responsive y optimizado para publicar propiedades en Nicaragua.

## Estructura del proyecto

```bash
/
├── index.html
├── nosotros.html
├── propiedades.html
├── contacto.html
├── css/
│   └── styles.css
├── js/
│   └── main.js
├── images/
└── propiedades/
    └── propiedad-template.html
```

## Cómo agregar nuevas propiedades

### Opción 1: agregar tarjetas en `propiedades.html`
1. Abre `propiedades.html`.
2. Busca la sección con clase `property-grid`.
3. Duplica un bloque `<article class="property-card">...</article>`.
4. Actualiza:
   - URL o ruta de imagen.
   - Título de la propiedad.
   - Precio.
   - Ubicación.
   - Descripción corta.
   - Enlace del botón `Ver detalles`.

### Opción 2: crear una página de detalle individual
1. Copia `propiedades/propiedad-template.html`.
2. Renombra el archivo (por ejemplo: `casa-managua.html`).
3. Edita los campos:
   - Título principal.
   - Precio.
   - Ubicación.
   - Descripción amplia.
   - Características.
   - Imagen principal.
4. En `propiedades.html`, actualiza el enlace `Ver detalles` para apuntar al nuevo archivo.

## Cómo actualizar el sitio

1. Edita textos y secciones en los archivos HTML según necesidad.
2. Ajusta estilos globales en `css/styles.css`.
3. Si necesitas interacciones nuevas, agrega código en `js/main.js`.
4. Guarda cambios y prueba el sitio localmente abriendo `index.html` en tu navegador.

## Despliegue en GitHub Pages

1. Sube el proyecto a un repositorio en GitHub.
2. Ve a **Settings > Pages** del repositorio.
3. En **Source**, selecciona la rama principal (`main` o `master`) y carpeta raíz (`/root`).
4. Guarda la configuración.
5. GitHub generará una URL pública del sitio.

## Recomendaciones SEO básicas

- Mantén actualizados los `title` y `meta description` de cada página.
- Usa imágenes optimizadas para mejorar velocidad.
- Añade texto descriptivo en `alt` para cada imagen.
- Mantén enlaces internos claros entre páginas.
