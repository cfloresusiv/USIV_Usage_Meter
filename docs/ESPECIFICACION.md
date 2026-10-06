# USIV Usage Meter: especificación v1

Reemplaza a la idea inicial ("Claude Meter", de uso personal). Recoge las decisiones tomadas al convertirla en una herramienta pública, gratuita y promocional de USIV.

## Objetivo

Que cualquier persona con un plan de Claude (Free, Pro, Max o Team) vea su consumo mientras trabaja en el navegador, con una herramienta instalable desde Chrome Web Store y Firefox Add-ons que sea **honesta sobre qué mide y cuándo**, **privada por diseño** y que deje una buena impresión de USIV.

## Decisiones

| Tema | Decisión | Motivo |
| --- | --- | --- |
| Nombre | **USIV Usage Meter**; "Claude" solo en la descripción, con un descargo de responsabilidad | Evitar el uso de una marca ajena como nombre del producto (políticas de las tiendas y de la marca) |
| Navegadores | Chrome y Firefox desde un mismo código, con WXT y MV3 | En Firefox el background es una event page y el ID de la extensión es aleatorio por instalación; WXT abstrae ambas diferencias |
| Fuente de datos | Lectura **pasiva** de la vista oficial de uso, más ingreso manual y Demo | Los endpoints internos se descartaron por ser frágiles, por los términos de uso y por el riesgo reputacional |
| Admin API y servicio local | **Fuera de la v1** | El público objetivo no tiene una organización con clave Admin ni instalaría Node |
| Historial, CSV y conversión a CLP | Fuera de la v1 | Alcance; se pueden evaluar según la adopción |
| Telemetría | Ninguna | Es el argumento de confianza y simplifica la revisión en las tiendas |
| Promoción | Crédito discreto "Hecho por USIV" con enlace (UTM) en el panel, el popup y las opciones | Sin publicidad inyectada en claude.ai (prohibida por las políticas de las tiendas) |
| Marca | Logo, paleta y descripción tomados de usiv.cl | Navy `#0A2E44`/`#10294D`, cian `#2DAFCF`, teal `#71C4C8` y Roboto |

## Fuente real (verificada el 6 de octubre de 2026)

La vista de uso hoy es un modal en `https://claude.ai/new#settings/usage` (la ruta `/settings/usage` redirige ahí). Su estructura accesible:

- `h2` "Tu uso" con una insignia del plan como elemento hermano.
- Filas con `role="meter"`, `aria-valuenow` (0–100) y `aria-labelledby` apuntando a la etiqueta ("Sesión actual", "Esta semana"); el texto de reinicio es hermano de la etiqueta.
- `h3` "Créditos de sesiones en la nube": barra (porcentaje usado), "Quedan USD X de USD Y" y "Vence …".
- `h3` "Créditos de uso": saldo y `h4` "Límite de gasto mensual" con "USD a de USD b este mes".
- `h3` "Uso de esta semana por producto": barras por producto (Claude Code, Chats, Cowork, Otro). Es un **desglose**, no una cuota.

El adaptador se basa en roles y encabezados, nunca en clases CSS. Si algo no se reconoce, el campo es `null`, se registra en `missing` y la cobertura pasa a `partial`.

## Reglas que se mantienen de la idea original

- Los errores no son ceros; un dato ausente se muestra como *No disponible*.
- Fuera de la vista de uso se muestra la última observación y pasa a *Desactualizado* a los 15 minutos (configurable).
- Al vencer el reinicio se muestra *Reinicio pendiente de verificar* y no se pone la cuota en 0 %.
- Los datos manuales y Demo se guardan por separado y van etiquetados; Demo nunca se activa solo.
- Una observación nueva no reemplaza al dato manual activo sin una acción del usuario.
- Las alertas se generan una vez por métrica, período y umbral, deduplicadas entre pestañas y reinicios; no se generan desde Demo ni desde datos manuales salvo que el usuario lo habilite.
- No se usa `innerHTML` con texto externo, y todo lo que llega por mensajería se valida y se acota.

## Siguientes versiones (no comprometidas)

1. Notificaciones del sistema, opcionales y con permiso pedido al activarlas.
2. Historial de 30 días con exportación a CSV.
3. Statusline para Claude Code (otro canal; no forma parte de la extensión).
4. Admin API para organizaciones, solo si aparece demanda real.
