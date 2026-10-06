# Publicación en Chrome Web Store y Firefox Add-ons

Lista de pasos para quien publique en nombre de USIV. Publicar es una acción pública: hazlo solo cuando la extensión se haya probado a mano en ambos navegadores.

## Antes de publicar

- [ ] `npm test`, `npm run typecheck` y `npm run lint:firefox` sin errores.
- [ ] Prueba manual en Chrome y Firefox: instalar, abrir Configuración › Uso, ver el panel, minimizar, arrastrar, cerrar y reabrir desde el popup, modo Demo, ingreso manual y borrar datos.
- [ ] Publicar [PRIVACY.md](../PRIVACY.md) en una URL estable (GitHub o una página en usiv.cl).
- [ ] Capturas de 1280×800 (panel sobre claude.ai, popup, opciones) **con datos Demo**, sin conversaciones visibles.
- [ ] Subir `version` en `package.json` en cada envío.

## Chrome Web Store

1. Registrar la cuenta de desarrollador con la cuenta Google de USIV (pago único de US$5) en <https://chrome.google.com/webstore/devconsole>.
2. Verificar el dominio `usiv.cl` en Google Search Console para que el editor aparezca como verificado.
3. Ejecutar `npm run zip` y subir `.output/usiv-usage-meter-<versión>-chrome.zip`.
4. Ficha:
   - **Categoría:** Productividad.
   - **Propósito único:** "Mostrar al usuario el uso de su plan de Claude leyendo la vista de uso de claude.ai."
   - **Justificación de `https://claude.ai/*`:** "Necesario para mostrar el panel en claude.ai y leer los porcentajes de la vista Configuración › Uso. No se accede a ningún otro sitio."
   - **`storage`:** "Guardar localmente las cifras leídas y las preferencias."
   - **`alarms`:** "Actualizar cada minuto el indicador de dato desactualizado."
   - **Código remoto:** No.
   - **Uso de datos:** no se recolecta ninguna categoría; marcar las tres certificaciones de uso limitado.
   - **Política de privacidad:** la URL publicada.
5. Al pedir acceso a un host, la primera revisión puede tardar más que lo habitual.

## Firefox Add-ons (AMO)

1. Crear una cuenta en <https://addons.mozilla.org/developers/> con el correo de USIV.
2. Ejecutar `npm run zip:firefox`. Se generan el paquete de la extensión y el **zip de fuentes**; AMO pide las fuentes porque el código va empaquetado por Vite.
3. Subir el paquete como **listado** (o *unlisted* para una distribución privada firmada).
4. Notas para el revisor: "Build: `npm ci && npm run build:firefox` con Node 22. Salida en `.output/firefox-mv3`."
5. El manifest ya declara `data_collection_permissions: none` y el ID `usage-meter@usiv.cl`, que no hay que cambiar después de publicar.

## Textos de la ficha

**Nombre:** USIV Usage Meter

**Resumen (es):** Ve el uso de tu plan de Claude (sesión, semana y créditos) en un panel flotante. Privado: nada sale de tu navegador.

**Descripción (es):**

> USIV Usage Meter te muestra cuánto llevas usado de tu plan de Claude sin tener que abrir la configuración a cada rato.
>
> • Panel flotante en claude.ai con la sesión actual, el límite semanal, los créditos y el gasto adicional.
> • Porcentaje de la sesión en el icono, visible desde cualquier pestaña.
> • Cuenta regresiva hasta el próximo reinicio.
> • Alertas al 50, 80 y 100 % (configurables).
> • Tema claro u oscuro, panel arrastrable y minimizable.
>
> Privacidad primero: solo lee las cifras de la vista Configuración › Uso cuando tú la abres. No lee conversaciones, no usa APIs internas, no tiene telemetría y nada sale de tu navegador. Código abierto.
>
> Herramienta independiente, gratuita, hecha por USIV (usiv.cl). No está afiliada, patrocinada ni respaldada por Anthropic. Claude es una marca de Anthropic.

**Summary (en):** See your Claude plan usage (session, week and credits) in a floating panel. Private: nothing leaves your browser.
