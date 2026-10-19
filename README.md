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

Las formas, superficies y precios de los lotes salen del plano `PLANO_PARA_MOSTRAR_LOTES_28_LOTES.pdf` (Plano de Fracción "A", PF-1/1, agosto 2025). Los videos son recortes del video del dron `BosquesAmador_HD.mp4`:

| Archivo | Segundos del video original | Dónde se usa |
| --- | --- | --- |
| `hero.mp4` / `hero-movil.mp4` | 0 a 15 (letrero "Bienvenidos a Zacatlán") | Portada |
| `terreno.mp4` | 20 a 32 | El lugar |
| `bosque.mp4` | 48 al final | Área común |
| `acceso.mp4` | 40 a 47 | Contacto |

## Estructura

```
index.html              Página
assets/css/estilos.css  Estilos
assets/js/config.js     Contacto y ubicación
assets/js/plano.js      Plano interactivo y videos
assets/img/             Plano y favicon
assets/video/           Clips de video y sus imágenes fijas
data/lotes.js           Datos de los 28 lotes y del área común
```
