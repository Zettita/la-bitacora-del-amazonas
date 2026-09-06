#!/usr/bin/env python3
"""Servidor local para la bitacora: sirve el sitio y guarda las sesiones
que se cargan desde herramientas/cargar.html directo en data/sessions/.

Uso:
    python herramientas/servidor.py [puerto]

Despues abrir http://localhost:8420/herramientas/cargar.html
"""
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

FECHA_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def leer_json(ruta, default):
    if not os.path.exists(ruta):
        return default
    with open(ruta, "r", encoding="utf-8") as f:
        return json.load(f)


def escribir_json(ruta, datos):
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)
        f.write("\n")


def slug(nombre):
    s = nombre.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "invitado"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=RAIZ, **kwargs)

    def do_POST(self):
        if self.path != "/api/guardar-sesion":
            self.send_json(404, {"error": "Ruta no encontrada"})
            return

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

        partidas_nuevas = cuerpo.get("partidas") or []
        if not partidas_nuevas:
            self.send_json(400, {"error": "La sesion no tiene partidas"})
            return

        titulo = str(cuerpo.get("titulo", "")).strip()
        notas = str(cuerpo.get("notas", "")).strip()

        # Da de alta jugadores invitados que todavia no esten en el roster
        players = leer_json(PLAYERS_PATH, [])
        ids_existentes = {p["id"] for p in players}
        cambio_roster = False
        for partida in partidas_nuevas:
            for j in partida.get("jugadores", []):
                jid = j.get("jugador")
                jnombre = j.get("nombre_invitado")
                if jid and jid not in ids_existentes and jnombre:
                    players.append({"id": jid, "nombre": jnombre})
                    ids_existentes.add(jid)
                    cambio_roster = True
                j.pop("nombre_invitado", None)
        if cambio_roster:
            escribir_json(PLAYERS_PATH, players)

        os.makedirs(SESSIONS_DIR, exist_ok=True)
        archivo = f"{fecha}.json"
        ruta_sesion = os.path.join(SESSIONS_DIR, archivo)

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
