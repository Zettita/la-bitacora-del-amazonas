# La Bitácora del Amazonas

Crónica de las partidas de LoL de la banda: quién sale mejor, quién se la carga al equipo, quién trollea y quién es medio ancla. Un sitio estático (sin build) que lee los datos de archivos JSON versionados en este repo — cada partida cargada es un commit, y la web publicada se actualiza sola al pushear.

## Cómo se ve

- **El Salón de la Fama**: ranking histórico de MVPs, cargadas, trolleos, anclas y mejor winrate.
- **La Crónica**: línea de tiempo de "capítulos" (días de juego), cada uno con sus partidas, campeones, KDA, premios y comentarios.

## Cómo eliminar una partida (si algo se cargó mal)

Adrede **no existe** una forma de editar una partida ya cargada — es fácil que eso termine pisando el dato real por error. Si algo salió mal, se elimina y se vuelve a cargar bien desde `cargar.html`.

Para eso está `herramientas/eliminar.html` (link "🗑️ Eliminar una partida" desde la crónica o el formulario de carga):

1. Elegís la sesión (día) de una lista desplegable.
2. Ves sus partidas, cada una con un botón **"✕ Eliminar esta partida"**.
3. También hay un botón para **"🗑️ Eliminar toda la sesión"** de una.
4. Usa la misma conexión (servidor local, o URL + clave del Worker) que `cargar.html` — si ya la configuraste ahí en ese navegador, en `eliminar.html` ya está lista.

Funciona en los dos modos (local y publicado) igual que la carga.

## Cómo agregar una nueva sesión (con el formulario)

La forma más fácil es con el formulario incluido, que escribe el JSON por vos:

1. Arrancá el servidor local (doble click en `cargar-partidas.bat`, o corré `python herramientas/servidor.py` desde la carpeta del proyecto).
2. Abrí `http://localhost:8420/herramientas/cargar.html`.
3. Si falta alguien en el roster, sumalo primero arriba de todo en **"👤 Alta rápida de jugador"** (nombre, línea preferida e imagen opcionales) — queda guardado al toque, sin esperar a guardar la sesión.
4. Completá la fecha, y por cada partida tocá **"+ Agregar jugador"** para sumar una fila a la planilla (hasta 5 por partida) y elegir quién es del desplegable. El campo de campeón tiene su propio buscador con ícono. Tocá **Guardar sesión** cuando termines.
5. Eso escribe directo `data/sessions/<fecha>.json` y actualiza `data/manifest.json`. Refrescá `index.html` (o el link "Volver a la crónica") para verlo.
6. Commiteá y pusheá los cambios (ver abajo) para que se reflejen en el sitio publicado.

El servidor solo corre en tu máquina — es una herramienta de carga, no hace falta para que la web publicada funcione.

## Cómo agregar una sesión desde la web publicada (sin servidor local)

`herramientas/cargar.html` también funciona abierto directo desde GitHub Pages (por ejemplo `https://zettita.github.io/la-bitacora-del-amazonas/herramientas/cargar.html`). Ahí no hay ningún servidor propio corriendo, así que en vez de eso el formulario le manda los datos a un **Worker de Cloudflare** (un pequeño servidor gratuito) que es el único lugar que conoce el token real de GitHub y hace el commit por vos. La página detecta sola en qué modo está (mira si el link es `localhost` o no).

Con este esquema, tus amigos **no necesitan cuenta de GitHub ni ningún token** — solo una clave de grupo simple, como una contraseña de wifi.

> **Importante:** el código del Worker (`herramientas/cloudflare-worker.js`) vive pegado a mano en el dashboard de Cloudflare — no se auto-despliega desde este repo. Cada vez que ese archivo cambie acá (por ejemplo, cuando se agregó soporte para eliminar partidas), hay que volver a copiarlo entero y pegarlo en **Edit code → Save and deploy** en el Worker para que el cambio se aplique.

### Desplegar el Worker (lo hacés una sola vez, vos)

1. Creá una cuenta gratis en [dash.cloudflare.com](https://dash.cloudflare.com) si no tenés.
2. **Workers & Pages → Create → Create Worker**. Ponele un nombre (ej. `bitacora-proxy`) y tocá **Deploy** (te crea un worker de ejemplo).
3. **Edit code**: borrá todo y pegá el contenido completo de [`herramientas/cloudflare-worker.js`](herramientas/cloudflare-worker.js) de este repo. **Save and deploy**.
4. En la página del Worker, andá a **Settings → Variables and Secrets** y agregá:

   | Nombre | Tipo | Valor |
   |---|---|---|
   | `GITHUB_OWNER` | Texto | `Zettita` |
   | `GITHUB_REPO` | Texto | `la-bitacora-del-amazonas` |
   | `GITHUB_BRANCH` | Texto | `main` |
   | `ALLOWED_ORIGIN` | Texto | `https://zettita.github.io` |
   | `CLAVE_GRUPO` | **Secret** | La clave que van a usar tus amigos (elegila vos, tipo contraseña) |
   | `GITHUB_TOKEN` | **Secret** | Un fine-grained PAT tuyo (ver abajo) |

5. Para el `GITHUB_TOKEN`: generalo en [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new) — "Repository access" → "Only select repositories" → elegí solo este repo; "Permissions" → "Contents" → **Read and write**. Este es el **único** token que existe, y vive solo acá, cifrado en Cloudflare — ni tus amigos ni yo lo vemos nunca.
6. Copiá la URL del Worker (algo como `https://bitacora-proxy.tu-cuenta.workers.dev`), que aparece arriba de todo en la página del Worker.

### Configurar el formulario (vos y cada amigo, una vez por navegador)

1. Abrí `herramientas/cargar.html` en el sitio publicado.
2. Desplegá "⚙️ Conexión para guardar".
3. Pegá la **URL del Worker** y la **clave del grupo** (la misma que pusiste como `CLAVE_GRUPO`). Opcionalmente tu nombre, para que quede en el mensaje del commit.
4. Guardar conexión.

Compartile a tus amigos únicamente la URL del sitio, la URL del Worker y la clave del grupo (por WhatsApp/Discord, como quieran) — nada de tokens ni cuentas de GitHub.

**Nota de seguridad:** quien tenga la clave del grupo puede cargar (o falsear) sesiones en esta bitácora, nada más — no tiene acceso al repo en sí ni a nada fuera de lo que este Worker expone. Si alguna vez querés invalidar el acceso de todos de una, basta con cambiar `CLAVE_GRUPO` en Cloudflare y volver a compartir la nueva clave.

## Cómo agregar una nueva sesión (a mano)

También podés saltear el formulario y editar el JSON directamente:

1. Creá un archivo nuevo en `data/sessions/`, con el nombre de la fecha, por ejemplo `2026-09-06.json`.
2. Completalo siguiendo este esquema:

   ```json
   {
     "fecha": "2026-09-06",
     "titulo": "Nombre corto y copado para la noche",
     "notas": "Comentario libre opcional sobre el día",
     "partidas": [
       {
         "numero": 1,
         "resultado": "Victoria",
         "duracion": "32:10",
         "jugadores": [
           {
             "jugador": "xero",
             "campeon": "Ahri",
             "rol": "MID",
             "kda": { "k": 10, "d": 2, "a": 8 },
             "premios": ["mvp", "carry"],
             "comentario": "Opcional: algo memorable que hizo"
           }
         ]
       }
     ]
   }
   ```

   Hasta 5 jugadores por partida.

3. Agregá el nombre del archivo a `data/manifest.json` (es la lista de sesiones que la web va a cargar):

   ```json
   ["2026-09-06.json"]
   ```

4. Commiteá y pusheá:

   ```bash
   git add data/
   git commit -m "Agrega sesion 2026-09-06"
   git push
   ```

   Con GitHub Pages activado, el sitio se actualiza solo unos segundos después del push.

### Los `id` de jugador válidos

Viven en `data/players.json`, con este esquema por jugador:

```json
{ "id": "xero", "nombre": "Xero", "rolPreferido": "MID", "imagen": "img/jugadores/xero.jpg" }
```

`rolPreferido` e `imagen` son opcionales. Si se suma alguien nuevo al grupo, **no hace falta editar este archivo a mano** — se agrega directo desde el bloque "👤 Alta rápida de jugador" arriba de todo en `cargar.html`; queda guardado en el roster para siempre.

La foto se elige del disco (no es un link): el navegador la redimensiona/comprime a un JPEG chico (200px de lado mayor) antes de mandarla, y el backend la guarda como archivo real en `img/jugadores/<id>.<ext>` — `imagen` en `players.json` termina siendo esa ruta relativa. Con como mucho ~10 jugadores en el grupo, el peso total es insignificante.

Para reemplazar la foto de alguien que ya tiene una, elegí a ese jugador en cualquier tarjeta de `cargar.html` y tocá el botón 📷 que aparece al lado de su nombre — se abre un mini formulario para subir la nueva foto, que se guarda al toque (no hace falta completar ni guardar la sesión entera). Si la foto vieja quedaba con otra extensión (por ejemplo `.png` y la nueva es `.jpg`), el archivo viejo se borra solo para no dejar huérfanos en `img/jugadores/`.

Para sacar a alguien del roster, usá el bloque "🗑️ Eliminar jugador" (debajo del alta rápida, en `cargar.html`). Solo funciona si ese jugador **todavía no tiene ninguna partida cargada** — si ya jugó algo, se rechaza el pedido para no dejar huérfano su historial en las sesiones guardadas; en ese caso hay que borrar primero sus partidas desde `eliminar.html`.

### Los `premios` disponibles

| id      | Significado                        |
|---------|-------------------------------------|
| `mvp`   | El mejor jugador de la partida       |
| `carry` | Se la cargó al equipo al hombro      |
| `troll` | Trolleó / jugó para el otro equipo   |
| `ancla` | Peor desempeño / lastró al equipo    |

Un jugador puede tener ninguno, uno, o varios premios en la misma partida (ej: `["troll", "ancla"]`).

### 🎭 Personajes destacados (gente ajena al grupo)

A veces se cruzan rivales o randoms memorables — un troll ajeno, alguien muy malo, o algún crack — que valen la pena registrar aunque no sean del grupo. Desde `cargar.html`, cada partida tiene su propio bloque "+ Agregar personaje destacado": elegís a alguien ya visto antes (para reconocerlo si se repite) o cargás uno nuevo con nombre libre, y cargás su campeón (con el mismo buscador con ícono), línea y KDA de esa partida, más un comentario corto de qué hizo.

Viven en `data/destacados.json` (mismo esquema chico que `players.json`: `{id, nombre}`), separado del roster del grupo — no cuentan para el Salón de la Fama ni el winrate de nadie, es puramente registro/anecdotario. Se ven en la crónica como un bloque aparte (borde punteado violeta) dentro de la partida, para diferenciarlos claramente del equipo. La idea a futuro es armarles su propio "salón de la fama" de villanos.

## Torneos

Desde `herramientas/torneo.html` se arma un cuadro de eliminación directa entre amigos: elegís nombre, fecha, modo (**individual** o **por equipos** — en equipos armás cada uno con jugadores ya existentes del roster) y cantidad de participantes (4, 8 o 16 — siempre potencia de 2, no hace falta contemplar "byes"). Al crearlo se genera el cuadro completo (todas las rondas, con las siguientes vacías hasta la final) más un partido aparte por el 3er puesto entre los perdedores de semifinal.

Después, en la misma página (se abre solo, justo debajo, apenas creás el torneo) vas tocando quién ganó cada cruce — el ganador avanza solo a la siguiente ronda. Cada click se guarda al toque, no hace falta un botón de guardar aparte, y mientras el torneo no esté cerrado podés volver a tocar cualquier partido ya definido para corregirlo (el cambio se propaga y deshace en cascada lo que ya había avanzado a partir de ahí). Cuando la final tiene ganador aparece el podio (2do a la izquierda, 1ro al centro y más alto, 3ro a la derecha).

Una vez que **todos** los puestos del podio están decididos (final + 3er puesto) aparece el botón **"🏁 Finalizar torneo"** — al tocarlo el torneo queda `cerrado`, deja de poder editarse (el cuadro pasa a ser de solo lectura, ni siquiera desde acá) y recién ahí aparece en el historial público de `torneos.html`. Mientras no esté cerrado, un torneo con el podio ya armado sigue siendo editable y no se lista en `torneos.html` — así el historial público solo muestra resultados que el admin ya confirmó como definitivos.

Los torneos son la única parte del sitio donde sí se edita el mismo registro en vez de "borrar y volver a cargar" — tiene sentido acá porque un cuadro es un documento vivo mientras el torneo está en curso (con su propio candado, "cerrado", para cuando deja de serlo), no un historial cerrado desde el vamos como las sesiones.

Viven en `data/torneos/<id>.json` (uno por torneo) + `data/torneos-manifest.json` (lista de archivos, mismo patrón que `data/manifest.json`). Esquema resumido:

```jsonc
{
  "id": "copa-de-verano",
  "nombre": "Copa de Verano", "fecha": "2026-09-15", "modo": "individual", // o "equipos"
  "cerrado": false, // true recién cuando se toca "Finalizar torneo"
  "participantes": [
    { "id": "p0", "nombre": "Zetta", "jugadores": ["zetta"] },       // individual: 1 solo id
    { "id": "p1", "nombre": "Equipo Rojo", "jugadores": ["xero","tutte"] } // equipos: 2 o más
  ],
  "rondas": [
    [ { "a": "p0", "b": "p1", "ganador": "p0" }, /* ...resto de la primera ronda... */ ],
    [ /* siguiente ronda, con "a"/"b" null hasta que avancen los ganadores */ ]
  ],
  "tercerPuesto": { "a": null, "b": null, "ganador": null }
}
```

El armado del bracket (`armarBracketInicial`), el avance de ganadores (`elegirGanadorTorneo`) y el render del cuadro/podio (`renderBracketTorneoHtml`, `renderPodioTorneoHtml`) están en `js/comunes.js`, compartidos entre `herramientas/torneo.js` (armar/editar) y `js/torneos.js` (`torneos.html`, la página pública de solo lectura).

### Nombres de campeón

Escribilos como en el juego ("Kai'Sa", "Dr. Mundo", "Wukong", etc.) — la web se encarga de mapearlos al ícono correcto.

Los íconos salen del modo [LoL Classic](https://www.leagueoflegends.com/es-es/classic/champions/) de Riot — el mismo modo que juega el grupo — que tiene un tile propio para cada uno de los 60 campeones originales. Si el campeón todavía no está en ese modo (o el nombre tiene un typo y no matchea nada), cae al ícono actual de Data Dragon, y si tampoco matchea, muestra las iniciales del jugador como último respaldo. Nunca rompe el diseño. El mapeo campeón → tile está en `JADE_CLASSIC_TILE` en [js/comunes.js](js/comunes.js) — si Riot suma más campeones a Classic, se agregan ahí a mano.

## Publicar en GitHub Pages

1. Creá un repositorio nuevo en GitHub (puede ser público o privado — Pages en repos privados requiere GitHub Pro/Team/Enterprise; si es gratis, usalo público).
2. Conectá este repo local y pusheá:

   ```bash
   git remote add origin https://github.com/<tu-usuario>/<nombre-repo>.git
   git branch -M main
   git push -u origin main
   ```

3. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, elegí `main` y carpeta `/ (root)`.
4. En un par de minutos el sitio queda publicado en `https://<tu-usuario>.github.io/<nombre-repo>/`.

De ahí en adelante, cada vez que agregues una sesión y hagas `git push`, GitHub Pages reconstruye el sitio automáticamente — no hace falta ningún paso extra.

### Si cambia el código (no los datos)

Los archivos de datos (`data/*.json`) siempre se piden sin caché, así que un F5 normal siempre trae la última sesión cargada. Pero `js/app.js`, `css/style.css` y los archivos de `herramientas/` sí pueden quedar cacheados por el navegador. Por eso `index.html` y `cargar.html` los referencian con un `?v=2` al final (`js/app.js?v=2`) — si en algún momento se edita alguno de esos archivos, hay que subir ese número (`?v=3`, etc.) en el/los HTML que lo referencian, así los navegadores lo vuelven a descargar solos sin que nadie tenga que hacer Ctrl+F5.

## Estructura del proyecto

```
index.html                    página principal
css/style.css                  estilos (tema crónica/diario)
js/comunes.js                   catálogo de premios, iconos de campeón, formato de fecha (compartido)
js/app.js                        carga los datos y arma el salón de la fama + la línea de tiempo
data/players.json               roster de jugadores
data/manifest.json              lista de sesiones a cargar
data/sessions/*.json            una sesión (día de juego) por archivo
data/torneos-manifest.json      lista de torneos a cargar
data/torneos/*.json             un torneo (cuadro + participantes) por archivo
torneos.html                     listado de torneos y, con ?id=, el cuadro + podio
js/torneos.js                    lógica de torneos.html
herramientas/torneo.html        armar un torneo nuevo y cargar sus resultados
herramientas/torneo.js           lógica propia de torneo.html
herramientas/torneo.css          estilos propios de torneo.html
herramientas/cargar.html        formulario para cargar una sesión
herramientas/cargar.js           lógica propia del formulario de carga
herramientas/eliminar.html      elegir una sesión y borrar una partida (o el día entero)
herramientas/eliminar.js         lógica propia del formulario de eliminación
herramientas/cargar.css         estilos compartidos por cargar.html y eliminar.html
herramientas/eliminar.css        estilos propios de eliminar.html
herramientas/conexion.js        compartido: decide servidor local vs Worker, panel de "Conexión"
herramientas/proxy-remoto.js     cliente: le manda la sesión al Worker de Cloudflare (modo publicado)
herramientas/cloudflare-worker.js  código del Worker: intermediario seguro que hace el commit en GitHub
herramientas/servidor.py        servidor local: sirve el sitio y guarda/edita lo que llega del formulario
cargar-partidas.bat             atajo para Windows: arranca el servidor con doble click
```
