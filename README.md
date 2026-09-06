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

## Estructura del proyecto

```
index.html                página principal
css/style.css              estilos (tema crónica/diario)
js/app.js                   carga los datos y arma el salón de la fama + la línea de tiempo
data/players.json           roster de jugadores
data/manifest.json          lista de sesiones a cargar
data/sessions/*.json        una sesión (día de juego) por archivo
herramientas/cargar.html    formulario para cargar una sesión
herramientas/cargar.js       lógica del formulario (arma el JSON y lo manda al servidor)
herramientas/cargar.css      estilos del formulario
herramientas/servidor.py     servidor local: sirve el sitio y guarda lo que llega del formulario
cargar-partidas.bat          atajo para Windows: arranca el servidor con doble click
```
