# Política de privacidad — USIV Usage Meter

*Última actualización: 6 de octubre de 2026*

USIV Usage Meter es una extensión gratuita de USIV Asesorías Tecnológicas ([usiv.cl](https://usiv.cl)).

## Resumen

**No recolectamos, transmitimos, vendemos ni compartimos ningún dato.** La extensión funciona por completo dentro de tu navegador y no tiene servidores, cuentas, analítica ni telemetría.

## Qué datos procesa

Cuando abres la vista **Configuración › Uso** de claude.ai, la extensión lee únicamente las cifras agregadas que esa vista muestra:

- nombre del plan (por ejemplo, "Pro");
- porcentajes de uso de la sesión, de la semana y otros límites visibles;
- textos y horas de reinicio;
- saldos y límites de créditos que aparezcan en esa vista;
- porcentaje de uso semanal por producto, si aparece.

**No lee** conversaciones, prompts, archivos, proyectos, nombres, correos, cookies ni tokens de sesión, ni interviene las solicitudes de red de la página.

## Dónde se guardan

En el almacenamiento local de la extensión (`storage.local`), solo en tu dispositivo. También se guardan tus preferencias, la posición del panel y qué alertas ya se mostraron.

## Cómo eliminarlos

En las opciones de la extensión, usa **Borrar datos / cambiar cuenta**. Al desinstalar la extensión, el navegador elimina todos sus datos.

## Permisos

- `storage`: guardar localmente lo descrito arriba.
- `alarms`: recalcular cada minuto si el dato está desactualizado y, si el refresco automático está activo, abrir la vista de uso en una pestaña inactiva que se cierra tras leerla.
- Acceso a `https://claude.ai/*`: mostrar el panel y leer la vista de uso.

## Enlaces externos

El enlace "Hecho por USIV" abre usiv.cl en una pestaña nueva. Ese sitio tiene su propia política.

## Contacto

Puedes abrir un issue en [github.com/cfloresusiv/USIV_Usage_Meter](https://github.com/cfloresusiv/USIV_Usage_Meter/issues) o escribir a través de [usiv.cl](https://usiv.cl).

---

# Privacy policy — USIV Usage Meter (English)

**We do not collect, transmit, sell or share any data.** The extension runs entirely in your browser, with no servers, accounts, analytics or telemetry.

When you open **Settings › Usage** on claude.ai, it reads only the aggregate figures shown there: plan name, usage percentages, reset times, credit balances and limits, and the weekly usage share by product. It does **not** read conversations, prompts, files, projects, names, emails, cookies or session tokens, and it does not intercept the page's network requests.

The data is stored in the extension's local storage on your device only. You can delete it at any time with **Clear data / switch account** in the extension options, and uninstalling the extension removes it.

Permissions: `storage` (local storage), `alarms` (recompute staleness every minute and, when auto-refresh is on, open the usage view in an inactive tab that closes after reading it), and access to `https://claude.ai/*` (show the panel and read the usage view).
