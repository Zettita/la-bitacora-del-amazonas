#!/usr/bin/env python3
"""Servidor local para la bitacora: sirve el sitio y guarda las sesiones
que se cargan desde herramientas/cargar.html directo en data/sessions/.

Uso:
    python herramientas/servidor.py [puerto]

Despues abrir http://localhost:8420/herramientas/cargar.html
"""
import base64
import http.server
import json
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(RAIZ, "data")
SESSIONS_DIR = os.path.join(DATA_DIR, "sessions")
MANIFEST_PATH = os.path.join(DATA_DIR, "manifest.json")
PLAYERS_PATH = os.path.join(DATA_DIR, "players.json")
DESTACADOS_PATH = os.path.join(DATA_DIR, "destacados.json")
IMG_JUGADORES_DIR = os.path.join(RAIZ, "img", "jugadores")

FECHA_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
DATA_URL_RE = re.compile(r"^data:([^;]+);base64,(.+)$", re.DOTALL)
EXT_POR_MIME = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}


def guardar_imagen_jugador(jugador_id, data_url):
    """Decodifica una imagen data:URL (ya comprimida del lado del navegador)
    y la guarda como img/jugadores/<id>.<ext>. Devuelve la ruta relativa, o
    None si el data URL no tiene el formato esperado."""
    m = DATA_URL_RE.match(data_url or "")
    if not m:
        return None
    ext = EXT_POR_MIME.get(m.group(1), "jpg")
    os.makedirs(IMG_JUGADORES_DIR, exist_ok=True)
    with open(os.path.join(IMG_JUGADORES_DIR, f"{jugador_id}.{ext}"), "wb") as f:
        f.write(base64.b64decode(m.group(2)))
    return f"img/jugadores/{jugador_id}.{ext}"


def leer_json(ruta, default):
    if not os.path.exists(ruta):
        return default
    with open(ruta, "r", encoding="utf-8") as f:
        return json.load(f)


def escribir_json(ruta, datos):
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)
        f.write("\n")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=RAIZ, **kwargs)

    def do_POST(self):
        if self.path == "/api/guardar-sesion":
            self.manejar_guardar_sesion()
        elif self.path == "/api/editar-imagen-jugador":
            self.manejar_editar_imagen_jugador()
        else:
            self.send_json(404, {"error": "Ruta no encontrada"})

    def manejar_editar_imagen_jugador(self):
        largo = int(self.headers.get("Content-Length", 0))
        try:
            cuerpo = json.loads(self.rfile.read(largo).decode("utf-8"))
        except Exception:
            self.send_json(400, {"error": "El cuerpo no es JSON valido"})
            return

        jugador_id = str(cuerpo.get("jugadorId", "")).strip()
        if not jugador_id:
            self.send_json(400, {"error": "Falta el id del jugador"})
            return
        imagen_datos = cuerpo.get("imagenDatos")
        if not imagen_datos:
            self.send_json(400, {"error": "Falta la imagen"})
            return

        players = leer_json(PLAYERS_PATH, [])
        jugador = next((p for p in players if p.get("id") == jugador_id), None)
        if not jugador:
            self.send_json(404, {"error": "Ese jugador no existe en el roster"})
            return

        ruta_imagen = guardar_imagen_jugador(jugador_id, imagen_datos)
        if not ruta_imagen:
            self.send_json(400, {"error": "La imagen no tiene un formato valido"})
            return

        ruta_vieja = jugador.get("imagen")
        if ruta_vieja and ruta_vieja != ruta_imagen:
            ruta_absoluta_vieja = os.path.join(RAIZ, ruta_vieja)
            if os.path.exists(ruta_absoluta_vieja):
                os.remove(ruta_absoluta_vieja)

        jugador["imagen"] = ruta_imagen
        escribir_json(PLAYERS_PATH, players)
        self.send_json(200, {"ok": True, "imagen": ruta_imagen})

    def manejar_guardar_sesion(self):
        largo = int(self.headers.get("Content-Length", 0))
        try:
            cuerpo = json.loads(self.rfile.read(largo).decode("utf-8"))
        except Exception:
            self.send_json(400, {"error": "El cuerpo no es JSON valido"})
            return

        fecha = str(cuerpo.get("fecha", "")).strip()
        if not FECHA_RE.match(fecha):
            self.send_json(400, {"error": "Fecha invalida, se espera AAAA-MM-DD"})
            return

        accion = cuerpo.get("accion", "agregar")
        partidas_nuevas = cuerpo.get("partidas") or []
        if accion == "agregar" and not partidas_nuevas:
            self.send_json(400, {"error": "La sesion no tiene partidas"})
            return

        titulo = str(cuerpo.get("titulo", "")).strip()
        notas = str(cuerpo.get("notas", "")).strip()

        os.makedirs(SESSIONS_DIR, exist_ok=True)
        archivo = f"{fecha}.json"
        ruta_sesion = os.path.join(SESSIONS_DIR, archivo)

        if accion == "reemplazar":
            if not partidas_nuevas:
                if os.path.exists(ruta_sesion):
                    os.remove(ruta_sesion)
                manifest = leer_json(MANIFEST_PATH, [])
                if archivo in manifest:
                    manifest.remove(archivo)
                    escribir_json(MANIFEST_PATH, manifest)
                self.send_json(200, {
                    "ok": True,
                    "archivo": archivo,
                    "partidas_en_la_sesion": 0,
                    "eliminada": True,
                })
                return

            for i, p in enumerate(partidas_nuevas):
                p["numero"] = i + 1
            sesion = {
                "fecha": fecha,
                "titulo": titulo or "Noche de juego",
                "notas": notas,
                "partidas": partidas_nuevas,
            }
            escribir_json(ruta_sesion, sesion)
            self.send_json(200, {
                "ok": True,
                "archivo": archivo,
                "partidas_en_la_sesion": len(partidas_nuevas),
                "eliminada": False,
            })
            return

        # accion == "agregar" (comportamiento por defecto)

        # Da de alta jugadores nuevos que todavia no esten en el roster
        players = leer_json(PLAYERS_PATH, [])
        ids_existentes = {p["id"] for p in players}
        cambio_roster = False
        for partida in partidas_nuevas:
            for j in partida.get("jugadores", []):
                nuevo = j.pop("nuevo_jugador", None)
                jid = j.get("jugador")
                if jid and jid not in ids_existentes and nuevo and nuevo.get("nombre"):
                    entrada = {"id": jid, "nombre": nuevo["nombre"]}
                    if nuevo.get("rolPreferido"):
                        entrada["rolPreferido"] = nuevo["rolPreferido"]
                    if nuevo.get("imagenDatos"):
                        ruta_imagen = guardar_imagen_jugador(jid, nuevo["imagenDatos"])
                        if ruta_imagen:
                            entrada["imagen"] = ruta_imagen
                    players.append(entrada)
                    ids_existentes.add(jid)
                    cambio_roster = True
        if cambio_roster:
            escribir_json(PLAYERS_PATH, players)

        # Da de alta personajes destacados nuevos (gente ajena al grupo)
        destacados_roster = leer_json(DESTACADOS_PATH, [])
        ids_destacados = {d["id"] for d in destacados_roster}
        cambio_destacados = False
        for partida in partidas_nuevas:
            for d in partida.get("destacados", []):
                nuevo = d.pop("nuevo_destacado", None)
                did = d.get("destacado")
                if did and did not in ids_destacados and nuevo and nuevo.get("nombre"):
                    destacados_roster.append({"id": did, "nombre": nuevo["nombre"]})
                    ids_destacados.add(did)
                    cambio_destacados = True
        if cambio_destacados:
            escribir_json(DESTACADOS_PATH, destacados_roster)

        if os.path.exists(ruta_sesion):
            sesion = leer_json(ruta_sesion, {})
            existentes = sesion.setdefault("partidas", [])
            base = max([p.get("numero", 0) for p in existentes] or [0])
            for i, p in enumerate(partidas_nuevas):
                p["numero"] = base + i + 1
            existentes.extend(partidas_nuevas)
            if titulo:
                sesion["titulo"] = titulo
            if notas:
                sesion["notas"] = notas
            sesion["fecha"] = fecha
        else:
            for i, p in enumerate(partidas_nuevas):
                p["numero"] = i + 1
            sesion = {
                "fecha": fecha,
                "titulo": titulo or "Noche de juego",
                "notas": notas,
                "partidas": partidas_nuevas,
            }

        escribir_json(ruta_sesion, sesion)

        manifest = leer_json(MANIFEST_PATH, [])
        if archivo not in manifest:
            manifest.append(archivo)
            escribir_json(MANIFEST_PATH, manifest)

        self.send_json(200, {
            "ok": True,
            "archivo": archivo,
            "partidas_en_la_sesion": len(sesion["partidas"]),
            "eliminada": False,
        })

    def send_json(self, status, obj):
        data = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, formato, *args):
        pass


if __name__ == "__main__":
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8420
    with http.server.ThreadingHTTPServer(("localhost", puerto), Handler) as httpd:
        print(f"La bitacora esta corriendo en http://localhost:{puerto}/")
        print(f"Formulario para cargar partidas: http://localhost:{puerto}/herramientas/cargar.html")
        print("Ctrl+C para parar el servidor.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nListo, servidor detenido.")
