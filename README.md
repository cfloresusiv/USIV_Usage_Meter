<p align="center"><img src="brand/logoUsiv.png" width="96" alt="USIV"></p>

# USIV Usage Meter

Extensión gratuita para **Chrome** y **Firefox** que muestra el uso de tu plan de Claude (sesión actual, límite semanal, créditos y gasto adicional) en un panel flotante dentro de claude.ai y en el icono de la barra del navegador.

Hecha por [USIV](https://usiv.cl). Herramienta independiente: no está afiliada, patrocinada ni respaldada por Anthropic. Claude es una marca de Anthropic.

## Qué hace y qué no

| Hace | No hace |
| --- | --- |
| Lee las cifras visibles en **Configuración › Uso** de claude.ai cuando tú abres esa vista | No lee conversaciones, proyectos ni archivos |
| Muestra la última lectura en el panel, el popup y el badge del icono (porcentaje de la sesión) | No usa APIs internas, cookies ni tokens de sesión |
| Se **actualiza solo** cada 10 minutos (configurable, 0 = nunca) abriendo la vista de uso en una pestaña inactiva que se cierra tras leerla | No consulta APIs en segundo plano |
| Marca el dato como **Desactualizado** pasados 15 minutos (configurable) | |
| Avisa al cruzar umbrales (50/80/100 % por defecto), una vez por período | No envía datos a ningún servidor; no tiene telemetría |
| Permite ingreso **manual** y un modo **Demo** separado y etiquetado | No convierte el uso del plan en dinero ni inventa ceros |

Fuera de la página de uso lo que ves es la **última observación**, no una medición continua. Cuando vence la hora de reinicio se muestra *Reinicio pendiente de verificar* en vez de volver a 0 %.

## Instalación para desarrollo

Requisitos: Node.js 22 o superior.

```powershell
npm install
npm run build            # Chrome  -> .output/chrome-mv3
npm run build:firefox    # Firefox -> .output/firefox-mv3
```

**Chrome:** abre `chrome://extensions`, activa *Modo de desarrollador*, pulsa *Cargar descomprimida* y elige `.output/chrome-mv3`.

**Firefox:** abre `about:debugging#/runtime/this-firefox`, pulsa *Cargar complemento temporal…* y elige `.output/firefox-mv3/manifest.json`. Se descarga al cerrar Firefox; para una instalación permanente hay que firmarlo en AMO (ver [docs/PUBLICACION.md](docs/PUBLICACION.md)). Si Firefox no concedió el acceso a claude.ai, el popup muestra el botón **Permitir acceso a claude.ai**.

Luego inicia sesión en claude.ai y abre **Configuración › Uso** (o el botón *Abrir uso de Claude* del popup). El panel se llena en un segundo.

Con recarga en caliente: `npm run dev` (Chrome) o `npm run dev:firefox`.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm test` | Pruebas unitarias (Vitest + happy-dom) con fixtures sintéticos |
| `npm run typecheck` | Verificación de tipos de TypeScript |
| `npm run build` / `npm run build:firefox` | Builds de producción |
| `npm run zip` / `npm run zip:firefox` | Paquetes `.zip` para las tiendas (Firefox incluye el zip de fuentes) |
| `npm run lint:firefox` | `web-ext lint` sobre el build de Firefox |
| `powershell scripts/make-icons.ps1` | Regenera los íconos desde `brand/logoUsiv.png` |

## Permisos

| Permiso | Motivo |
| --- | --- |
| `storage` | Guardar en este navegador las cifras leídas y tus preferencias |
| `alarms` | Recalcular cada minuto si el dato está desactualizado (badge) y programar el refresco automático |
| `https://claude.ai/*` | Mostrar el panel y leer la vista de uso |

No se solicitan `tabs`, `cookies`, `<all_urls>`, historial ni portapapeles.

## Datos guardados y cómo borrarlos

Todo queda en `storage.local` de la extensión: el último snapshot observado, el manual y el demo (cifras agregadas), las preferencias, la posición del panel y las claves de alertas ya mostradas. Nada se sincroniza ni se envía fuera. En **Configuración › Tus datos** puedes exportarlo a JSON o borrarlo con **Borrar datos / cambiar cuenta**. Desinstalar la extensión también lo elimina.

Política completa: [PRIVACY.md](PRIVACY.md).

## Arquitectura

```
src/
  entrypoints/
    background.ts   Service worker (Chrome) / event page (Firefox): valida, guarda, alertas, badge
    content.ts      Panel en Shadow DOM + lector acotado de la vista de uso
    popup/          Resumen desde cualquier pestaña (no lee la pestaña activa)
    options/        Fuente de datos, ingreso manual, preferencias, exportar/borrar
  lib/
    parse-usage.ts  Adaptador: roles ARIA (role="meter", aria-valuenow, aria-labelledby) y encabezados
    reset-time.ts   Textos de reinicio en español/inglés -> hora local
    amounts.ts      Importes como decimales en texto (sin pérdida de precisión)
    validate.ts     Validación estricta de todo lo que llega por mensajería o storage
    alerts.ts       Umbrales deduplicados por métrica, período y umbral
  ui/               Panel, resumen compartido y tema con la paleta USIV
```

El adaptador **no depende de clases CSS** y solo se activa mientras la URL es `/settings/usage` (o el modal `#settings/usage`). Si Anthropic cambia esa vista y un campo no se reconoce, se muestra *No disponible* y la cobertura como *Parcial*: nunca se inventa un 0.

## Estado de validación

- **Automatizado:** 35 pruebas (lector en español e inglés, campos ausentes, reinicios, importes, validación, alertas, panel).
- **Estructura real:** el lector se diseñó sobre la vista de uso de una cuenta Pro real (octubre 2026, interfaz en español); los fixtures reproducen esa estructura con cifras inventadas.
- **Pendiente:** prueba manual en Chrome y Firefox con la extensión cargada, y lectura con interfaz en inglés y planes Max/Team.

## Licencia

MIT © USIV Asesorías Tecnológicas.
