# Bosques Amador

Página de venta de los 28 lotes de Bosques Amador, en Zacatlán de las Manzanas, Puebla, a 10 minutos del Valle de Piedras Encimadas. Incluye un plano interactivo: el visitante toca un lote y ve su superficie, ubicación, precio y estado, y puede pedir información por WhatsApp.

Es un sitio estático (HTML, CSS y JavaScript), no necesita instalar nada.

## Verlo en tu computadora

En PowerShell, dentro de la carpeta del proyecto:

```powershell
python -m http.server 8080
```

Abre <http://localhost:8080> en el navegador. Para detenerlo presiona `Ctrl + C`.

Si `python` no existe, usa `py -m http.server 8080` o, con Node.js, `npx.cmd serve .`

## Qué editar

| Quiero cambiar… | Archivo |
| --- | --- |
| WhatsApp, teléfono, correo o ubicación | `assets/js/config.js` |
| Estado o precio de un lote | `data/lotes.js` |
| Textos de la página | `index.html` |
| Colores y estilos | `assets/css/estilos.css` |

Para marcar un lote como vendido, busca su número en `data/lotes.js` y cambia `"estado":"disponible"` por `"estado":"vendido"` (o `"apartado"`).

## Origen de los datos

Las formas, superficies y precios de los lotes salen del plano `PLANO_PARA_MOSTRAR_LOTES_28_LOTES.pdf` (Plano de Fracción "A", PF-1/1, agosto 2025).

Videos (cada uno tiene versión de escritorio 1920×1080 y versión vertical `-movil` 1080×1920 para celular):

| Archivo | Origen | Dónde se usa |
| --- | --- | --- |
| `hero.mp4` / `hero-movil.mp4` | `BosquesAmador_4K.mp4`, segundos 0 a 15 | Portada |
| `bosque.mp4` / `bosque-movil.mp4` | `H_orbita.mp4`, segundos 20 a 40 | Área común |
| `acceso.mp4` / `acceso-movil.mp4` | `H_orbita.mp4`, de 1:10 a 1:30 | Contacto |

Fotos:

| Archivo | Origen | Dónde se usa |
| --- | --- | --- |
| `predio-lotes.jpg` | `BA_plano.jpeg`, sin los baches de la carretera | El lugar (lotes simulados encima) |
| `vista-carretera.jpg` | `BA_esquina.jpeg` | Vista desde la carretera |

## Lotes sobre la foto del predio

`assets/js/plano.js` dibuja los lotes sobre `predio-lotes.jpg` (pixeles de la imagen de 2000 × 1440):

- `ESQUINAS_FOTO`: cuatro puntos que definen la perspectiva. Son la línea interior de los lotes 1 al 9, la orilla de los lotes 20 al 28 y el final del lote 19, junto a la camioneta.
- `ORILLA_CARRETERA`: la orilla del asfalto. Los lotes 1 al 9 llegan hasta ella dejando `BANQUETA_M` (1.5 m) de banqueta.
- `AREA_FOTO`: el contorno del área común sobre el bosque.

## Estructura

```
index.html              Página
assets/css/estilos.css  Estilos
assets/js/config.js     Contacto y ubicación
assets/js/plano.js      Plano interactivo y videos
assets/img/             Plano, foto aérea del predio (predio.jpg) y favicon
assets/video/           Clips de video y sus imágenes fijas
data/lotes.js           Datos de los 28 lotes y del área común
```

## Lotes sobre la foto del predio

En la sección "El lugar", `assets/js/plano.js` dibuja los lotes sobre la foto `predio.jpg` (tomada de `BA_plano.jpeg`) con una transformación de perspectiva. Si cambias la foto, ajusta `ESQUINAS_FOTO`: las cuatro esquinas del predio en pixeles de la imagen de 2000 × 1440 (lote 1 en la carretera, fin de la calle principal, esquina junto al bosque a la altura de la camioneta, y fin de la carretera junto al área común).
