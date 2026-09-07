# La Bitácora del Amazonas

Crónica de las partidas de LoL de la banda: quién sale mejor, quién se la carga al equipo, quién trollea y quién es medio ancla. Un sitio estático (sin build) que lee los datos de archivos JSON versionados en este repo — cada partida cargada es un commit, y la web publicada se actualiza sola al pushear.

## Cómo se ve

- **El Salón de la Fama**: ranking histórico de MVPs, cargadas, trolleos, anclas y mejor winrate.
- **La Crónica**: línea de tiempo de "capítulos" (días de juego), cada uno con sus partidas, campeones, KDA, premios y comentarios.

## Cómo agregar una nueva sesión (con el formulario)

La forma más fácil es con el formulario incluido, que escribe el JSON por vos:

1. Arrancá el servidor local (doble click en `cargar-partidas.bat`, o corré `python herramientas/servidor.py` desde la carpeta del proyecto).
2. Abrí `http://localhost:8420/herramientas/cargar.html`.
3. Completá la fecha, cargá una o más partidas (podés destildar a alguien si no jugó esa partida, o agregar un invitado suelto), y tocá **Guardar sesión**.
4. Eso escribe directo `data/sessions/<fecha>.json` y actualiza `data/manifest.json`. Refrescá `index.html` (o el link "Volver a la crónica") para verlo.
5. Commiteá y pusheá los cambios (ver abajo) para que se reflejen en el sitio publicado.

El servidor solo corre en tu máquina — es una herramienta de carga, no hace falta para que la web publicada funcione.

## Cómo agregar una sesión desde la web publicada (sin servidor local)

`herramientas/cargar.html` también funciona abierto directo desde GitHub Pages (por ejemplo `https://zettita.github.io/la-bitacora-del-amazonas/herramientas/cargar.html`). Ahí no hay ningún servidor propio corriendo, así que en vez de eso el formulario le manda los datos a un **Worker de Cloudflare** (un pequeño servidor gratuito) que es el único lugar que conoce el token real de GitHub y hace el commit por vos. La página detecta sola en qué modo está (mira si el link es `localhost` o no).

Con este esquema, tus amigos **no necesitan cuenta de GitHub ni ningún token** — solo una clave de grupo simple, como una contraseña de wifi.

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
         "modo": "Ranked Solo/Duo",
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

Están definidos en `data/players.json`: `xero`, `tutte`, `jonan`, `saukoz`, `zetta`. Si se suma alguien nuevo al grupo, agregalo ahí primero (`{"id": "nuevo", "nombre": "Nuevo"}`).

### Los `premios` disponibles

| id      | Significado                        |
|---------|-------------------------------------|
| `mvp`   | El mejor jugador de la partida       |
| `carry` | Se la cargó al equipo al hombro      |
| `troll` | Trolleó / jugó para el otro equipo   |
| `ancla` | Peor desempeño / lastró al equipo    |

Un jugador puede tener ninguno, uno, o varios premios en la misma partida (ej: `["troll", "ancla"]`).

### Nombres de campeón

Escribilos como en el juego ("Kai'Sa", "Dr. Mundo", "Wukong", etc.) — la web se encarga de mapearlos al ícono correcto. Si algún campeón no carga el ícono, muestra las iniciales del jugador como respaldo, así que nunca rompe el diseño.

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
index.html                página principal
css/style.css              estilos (tema crónica/diario)
js/app.js                   carga los datos y arma el salón de la fama + la línea de tiempo
data/players.json           roster de jugadores
data/manifest.json          lista de sesiones a cargar
data/sessions/*.json        una sesión (día de juego) por archivo
herramientas/cargar.html    formulario para cargar una sesión
herramientas/cargar.js       lógica del formulario (arma el JSON y decide a qué backend mandarlo)
herramientas/cargar.css      estilos del formulario
herramientas/proxy-remoto.js  cliente: le manda la sesión al Worker de Cloudflare (modo publicado)
herramientas/cloudflare-worker.js  código del Worker: intermediario seguro que hace el commit en GitHub
herramientas/servidor.py     servidor local: sirve el sitio y guarda lo que llega del formulario
cargar-partidas.bat          atajo para Windows: arranca el servidor con doble click
```
