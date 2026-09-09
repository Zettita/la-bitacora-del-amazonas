// Worker de Cloudflare: intermediario seguro entre el formulario publicado
// y la API de GitHub.
//
// Por que existe: GitHub Pages es sitio estatico puro, no puede guardar
// secretos. Este Worker si puede (Cloudflare los guarda cifrados), asi que
// es el unico lugar donde vive el token real de GitHub. Los amigos que
// cargan partidas solo necesitan una clave de grupo simple, no una cuenta
// de GitHub ni un token propio.
//
// Como desplegarlo: Cloudflare Dashboard -> Workers & Pages -> Create ->
// Create Worker -> pegar este archivo entero como el codigo -> Deploy.
// Despues en Settings -> Variables and Secrets agregar:
//   GITHUB_OWNER    (texto)   ej: Zettita
//   GITHUB_REPO     (texto)   ej: la-bitacora-del-amazonas
//   GITHUB_BRANCH   (texto)   ej: main
//   ALLOWED_ORIGIN  (texto)   ej: https://zettita.github.io  (recomendado)
//   CLAVE_GRUPO     (secreto) la clave que van a tipear tus amigos
//   GITHUB_TOKEN    (secreto) fine-grained PAT con Contents: Read and write
//                              acotado UNICAMENTE a este repo
//
// El README del proyecto tiene el paso a paso completo.

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'POST') {
      return jsonResp({ error: 'Metodo no permitido' }, 405, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResp({ error: 'El cuerpo no es JSON valido' }, 400, cors);
    }

    if (!env.CLAVE_GRUPO || String(body.clave || '').trim() !== env.CLAVE_GRUPO.trim()) {
      return jsonResp({ error: 'Clave incorrecta' }, 401, cors);
    }

    const cfg = {
      owner: env.GITHUB_OWNER,
      repo: env.GITHUB_REPO,
      branch: env.GITHUB_BRANCH || 'main',
      token: env.GITHUB_TOKEN,
    };
    const autor = String(body.autor || '').trim();

    if (body.accion === 'editar_imagen_jugador') {
      const jugadorId = String(body.jugadorId || '').trim();
      if (!jugadorId) return jsonResp({ error: 'Falta el id del jugador' }, 400, cors);
      if (!body.imagenDatos) return jsonResp({ error: 'Falta la imagen' }, 400, cors);
      try {
        const resultado = await editarImagenJugador(cfg, jugadorId, body.imagenDatos, autor);
        return jsonResp(resultado, 200, cors);
      } catch (err) {
        return jsonResp({ error: err.message }, 500, cors);
      }
    }

    if (body.accion === 'agregar_jugador') {
      const nombre = String(body.nombre || '').trim();
      const id = String(body.id || '').trim();
      if (!nombre || !id) return jsonResp({ error: 'Falta el nombre' }, 400, cors);
      try {
        const resultado = await agregarJugador(cfg, {
          id, nombre,
          rolPreferido: String(body.rolPreferido || '').trim(),
          imagenDatos: body.imagenDatos,
        }, autor);
        return jsonResp(resultado, 200, cors);
      } catch (err) {
        return jsonResp({ error: err.message }, 500, cors);
      }
    }

    if (body.accion === 'eliminar_jugador') {
      const id = String(body.id || '').trim();
      if (!id) return jsonResp({ error: 'Falta el id del jugador' }, 400, cors);
      try {
        const resultado = await eliminarJugador(cfg, id, autor);
        return jsonResp(resultado, 200, cors);
      } catch (err) {
        return jsonResp({ error: err.message }, 500, cors);
      }
    }

    if (body.accion === 'crear_torneo') {
      const torneo = body.torneo || {};
      if (!torneo.id || !torneo.nombre) return jsonResp({ error: 'Falta el id o el nombre del torneo' }, 400, cors);
      try {
        const resultado = await crearTorneo(cfg, torneo, autor);
        return jsonResp(resultado, 200, cors);
      } catch (err) {
        return jsonResp({ error: err.message }, 500, cors);
      }
    }

    if (body.accion === 'guardar_torneo') {
      const torneo = body.torneo || {};
      if (!torneo.id) return jsonResp({ error: 'Falta el id del torneo' }, 400, cors);
      try {
        const resultado = await guardarTorneo(cfg, torneo, autor);
        return jsonResp(resultado, 200, cors);
      } catch (err) {
        return jsonResp({ error: err.message }, 500, cors);
      }
    }

    if (body.accion === 'eliminar_torneo') {
      const id = String(body.id || '').trim();
      if (!id) return jsonResp({ error: 'Falta el id del torneo' }, 400, cors);
      try {
        const resultado = await eliminarTorneo(cfg, id, autor);
        return jsonResp(resultado, 200, cors);
      } catch (err) {
        return jsonResp({ error: err.message }, 500, cors);
      }
    }

    const fecha = String(body.fecha || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return jsonResp({ error: 'Fecha invalida, se espera AAAA-MM-DD' }, 400, cors);
    }
    const accion = body.accion === 'reemplazar' ? 'reemplazar' : 'agregar';
    const partidas = Array.isArray(body.partidas) ? body.partidas : [];
    if (accion === 'agregar' && partidas.length === 0) {
      return jsonResp({ error: 'La sesion no tiene partidas' }, 400, cors);
    }

    const payload = {
      fecha,
      titulo: String(body.titulo || '').trim(),
      notas: String(body.notas || '').trim(),
      partidas,
      autor,
    };

    try {
      const resultado = accion === 'reemplazar'
        ? await reemplazarSesion(cfg, payload)
        : await guardarSesion(cfg, payload);
      return jsonResp(resultado, 200, cors);
    } catch (err) {
      return jsonResp({ error: err.message }, 500, cors);
    }
  },
};

function jsonResp(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  });
}

function utf8ToB64(str) {
  const bytes = new TextEncoder().encode(str);
  let binario = '';
  bytes.forEach((b) => (binario += String.fromCharCode(b)));
  return btoa(binario);
}

function b64ToUtf8(b64) {
  const binario = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function ghFetch(cfg, path, opciones = {}) {
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
  return fetch(url, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'la-bitacora-del-amazonas-worker',
      ...(opciones.headers || {}),
    },
  });
}

// Devuelve {sha, datos} si el archivo existe, o null si no existe (404).
async function ghObtenerArchivo(cfg, path) {
  const resp = await ghFetch(cfg, `${path}?ref=${encodeURIComponent(cfg.branch)}`);
  if (resp.status === 404) return null;
  if (resp.status === 401 || resp.status === 403) {
    throw new Error('El GITHUB_TOKEN configurado en el Worker no es valido o no tiene permiso sobre el repo.');
  }
  if (!resp.ok) throw new Error(`GitHub devolvio ${resp.status} al leer ${path}`);
  const json = await resp.json();
  return { sha: json.sha, datos: JSON.parse(b64ToUtf8(json.content)) };
}

async function ghGuardarArchivo(cfg, path, datosObjeto, shaPrevia, mensaje) {
  const body = {
    message: mensaje,
    content: utf8ToB64(JSON.stringify(datosObjeto, null, 2) + '\n'),
    branch: cfg.branch,
  };
  if (shaPrevia) body.sha = shaPrevia;

  const resp = await ghFetch(cfg, path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (resp.status === 409) {
    throw new Error('Alguien guardo otra sesion justo ahora (conflicto de version). Probá guardar de nuevo.');
  }
  if (!resp.ok) {
    const detalle = await resp.json().catch(() => ({}));
    throw new Error(detalle.message || `GitHub devolvio ${resp.status} al guardar ${path}`);
  }
  return resp.json();
}

// sha del archivo en `path` si existe, o null (no intenta parsear el
// contenido como JSON, a diferencia de ghObtenerArchivo - sirve para
// binarios como las fotos de jugador).
async function ghShaSiExiste(cfg, path) {
  const resp = await ghFetch(cfg, `${path}?ref=${encodeURIComponent(cfg.branch)}`);
  if (resp.status === 404) return null;
  if (!resp.ok) return null;
  const json = await resp.json();
  return json.sha;
}

async function ghGuardarBinario(cfg, path, base64Content, shaPrevia, mensaje) {
  const body = { message: mensaje, content: base64Content, branch: cfg.branch };
  if (shaPrevia) body.sha = shaPrevia;

  const resp = await ghFetch(cfg, path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const detalle = await resp.json().catch(() => ({}));
    throw new Error(detalle.message || `GitHub devolvio ${resp.status} al guardar ${path}`);
  }
  return resp.json();
}

const EXT_POR_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

// Decodifica un data:URL (ya viene comprimido del lado del navegador) y lo
// sube como img/jugadores/<id>.<ext>. Devuelve la ruta relativa, o null si
// el data URL no tiene el formato esperado.
async function guardarImagenJugador(cfg, jugadorId, dataUrl, firma) {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl || '');
  if (!match) return null;
  const ext = EXT_POR_MIME[match[1]] || 'jpg';
  const ruta = `img/jugadores/${jugadorId}.${ext}`;
  const shaPrevia = await ghShaSiExiste(cfg, ruta);
  await ghGuardarBinario(cfg, ruta, match[2], shaPrevia, `Sube foto de jugador${firma}`);
  return ruta;
}

async function ghEliminarArchivo(cfg, path, sha, mensaje) {
  const resp = await ghFetch(cfg, path, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: mensaje, sha, branch: cfg.branch }),
  });
  if (!resp.ok) {
    const detalle = await resp.json().catch(() => ({}));
    throw new Error(detalle.message || `GitHub devolvio ${resp.status} al eliminar ${path}`);
  }
  return resp.json();
}

// Sobrescribe la sesion de un dia con la lista de partidas recibida (por
// ejemplo, la misma lista menos una que se quiso borrar). Si la lista viene
// vacia, borra el archivo entero y lo saca del manifest.
async function reemplazarSesion(cfg, payload) {
  const archivo = `${payload.fecha}.json`;
  const rutaSesion = `data/sessions/${archivo}`;
  const firma = payload.autor ? ` (por ${payload.autor})` : '';

  const existente = await ghObtenerArchivo(cfg, rutaSesion);

  if (payload.partidas.length === 0) {
    if (existente) {
      await ghEliminarArchivo(cfg, rutaSesion, existente.sha, `Elimina sesion ${payload.fecha}${firma}`);
    }
    const manifestFile = await ghObtenerArchivo(cfg, 'data/manifest.json');
    const manifest = manifestFile ? manifestFile.datos : [];
    const idx = manifest.indexOf(archivo);
    if (idx !== -1) {
      manifest.splice(idx, 1);
      await ghGuardarArchivo(cfg, 'data/manifest.json', manifest, manifestFile.sha, `Quita ${archivo} del manifest${firma}`);
    }
    return { ok: true, archivo, partidas_en_la_sesion: 0, eliminada: true };
  }

  payload.partidas.forEach((p, i) => { p.numero = i + 1; });
  const sesion = {
    fecha: payload.fecha,
    titulo: payload.titulo || 'Noche de juego',
    notas: payload.notas || '',
    partidas: payload.partidas,
  };

  await ghGuardarArchivo(cfg, rutaSesion, sesion, existente ? existente.sha : undefined, `Elimina una partida de ${payload.fecha}${firma}`);

  return { ok: true, archivo, partidas_en_la_sesion: sesion.partidas.length, eliminada: false };
}

// Reemplaza la foto de un jugador que ya está en el roster (a diferencia de
// guardarImagenJugador, que solo sube el archivo, esto también actualiza
// players.json y borra la foto vieja si tenía una extensión distinta).
async function editarImagenJugador(cfg, jugadorId, imagenDatos, autor) {
  const playersFile = await ghObtenerArchivo(cfg, 'data/players.json');
  const players = playersFile ? playersFile.datos : [];
  const jugador = players.find((p) => p.id === jugadorId);
  if (!jugador) throw new Error('Ese jugador no existe en el roster');

  const firma = autor ? ` (por ${autor})` : '';
  const rutaVieja = jugador.imagen;
  const rutaNueva = await guardarImagenJugador(cfg, jugadorId, imagenDatos, firma);
  if (!rutaNueva) throw new Error('La imagen no tiene un formato valido');

  if (rutaVieja && rutaVieja !== rutaNueva) {
    const shaVieja = await ghShaSiExiste(cfg, rutaVieja);
    if (shaVieja) await ghEliminarArchivo(cfg, rutaVieja, shaVieja, `Borra foto vieja de jugador${firma}`);
  }

  jugador.imagen = rutaNueva;
  await ghGuardarArchivo(cfg, 'data/players.json', players, playersFile ? playersFile.sha : undefined, `Actualiza foto de jugador${firma}`);

  return { ok: true, imagen: rutaNueva };
}

// Da de alta un jugador nuevo en el roster (accion "agregar_jugador"),
// independiente de guardar una sesion.
async function agregarJugador(cfg, datos, autor) {
  const firma = autor ? ` (por ${autor})` : '';
  const playersFile = await ghObtenerArchivo(cfg, 'data/players.json');
  const players = playersFile ? playersFile.datos : [];
  if (players.some((p) => p.id === datos.id)) {
    throw new Error('Ya hay un jugador con ese nombre en el roster');
  }

  const entrada = { id: datos.id, nombre: datos.nombre };
  if (datos.rolPreferido) entrada.rolPreferido = datos.rolPreferido;
  if (datos.imagenDatos) {
    const ruta = await guardarImagenJugador(cfg, datos.id, datos.imagenDatos, firma);
    if (ruta) entrada.imagen = ruta;
  }

  players.push(entrada);
  await ghGuardarArchivo(cfg, 'data/players.json', players, playersFile ? playersFile.sha : undefined, `Suma jugador nuevo a la bitacora${firma}`);

  return { ok: true, jugador: entrada };
}

// Recorre todas las sesiones guardadas buscando si jugadorId jugo alguna
// partida — se usa para no dejar eliminar del roster a alguien que ya
// tiene historial (rompería sus stats y el timeline).
async function jugadorTienePartidas(cfg, jugadorId) {
  const manifestFile = await ghObtenerArchivo(cfg, 'data/manifest.json');
  const manifest = manifestFile ? manifestFile.datos : [];
  for (const archivo of manifest) {
    const sesionFile = await ghObtenerArchivo(cfg, `data/sessions/${archivo}`);
    if (!sesionFile) continue;
    const partidas = sesionFile.datos.partidas || [];
    for (const p of partidas) {
      for (const j of (p.jugadores || [])) {
        if (j.jugador === jugadorId) return true;
      }
    }
  }
  return false;
}

// Saca a un jugador del roster (accion "eliminar_jugador"). Rechaza el
// pedido si ya tiene partidas cargadas, y borra su foto si tenía.
async function eliminarJugador(cfg, jugadorId, autor) {
  const firma = autor ? ` (por ${autor})` : '';
  const playersFile = await ghObtenerArchivo(cfg, 'data/players.json');
  const players = playersFile ? playersFile.datos : [];
  const jugador = players.find((p) => p.id === jugadorId);
  if (!jugador) throw new Error('Ese jugador no existe en el roster');

  if (await jugadorTienePartidas(cfg, jugadorId)) {
    throw new Error('Ese jugador ya tiene partidas cargadas, no se puede eliminar del roster');
  }

  const restantes = players.filter((p) => p.id !== jugadorId);
  await ghGuardarArchivo(cfg, 'data/players.json', restantes, playersFile.sha, `Elimina jugador del roster${firma}`);

  if (jugador.imagen) {
    const shaImagen = await ghShaSiExiste(cfg, jugador.imagen);
    if (shaImagen) await ghEliminarArchivo(cfg, jugador.imagen, shaImagen, `Borra foto de jugador eliminado${firma}`);
  }

  return { ok: true };
}

async function guardarSesion(cfg, payload) {
  const archivo = `${payload.fecha}.json`;
  const rutaSesion = `data/sessions/${archivo}`;
  const firma = payload.autor ? ` (cargado por ${payload.autor})` : '';

  // 1) Mezclar con la sesion existente de ese dia, si ya habia una
  const existente = await ghObtenerArchivo(cfg, rutaSesion);
  let sesion;
  if (existente) {
    sesion = existente.datos;
    const previas = sesion.partidas || [];
    const base = Math.max(0, ...previas.map((p) => p.numero || 0));
    payload.partidas.forEach((p, i) => { p.numero = base + i + 1; });
    sesion.partidas = previas.concat(payload.partidas);
    if (payload.titulo) sesion.titulo = payload.titulo;
    if (payload.notas) sesion.notas = payload.notas;
  } else {
    payload.partidas.forEach((p, i) => { p.numero = i + 1; });
    sesion = {
      fecha: payload.fecha,
      titulo: payload.titulo || 'Noche de juego',
      notas: payload.notas || '',
      partidas: payload.partidas,
    };
  }

  // 2) Dar de alta personajes destacados nuevos (gente ajena al grupo)
  const nuevosDestacados = [];
  sesion.partidas.forEach((p) => (p.destacados || []).forEach((d) => {
    if (d.nuevo_destacado) nuevosDestacados.push({ id: d.destacado, datos: d.nuevo_destacado });
    delete d.nuevo_destacado;
  }));
  if (nuevosDestacados.length) {
    const destacadosFile = await ghObtenerArchivo(cfg, 'data/destacados.json');
    const destacados = destacadosFile ? destacadosFile.datos : [];
    const idsExistentes = new Set(destacados.map((d) => d.id));
    let cambio = false;
    nuevosDestacados.forEach((n) => {
      if (!idsExistentes.has(n.id)) {
        destacados.push({ id: n.id, nombre: n.datos.nombre });
        idsExistentes.add(n.id);
        cambio = true;
      }
    });
    if (cambio) {
      await ghGuardarArchivo(cfg, 'data/destacados.json', destacados, destacadosFile ? destacadosFile.sha : undefined, `Suma personaje destacado a la bitacora${firma}`);
    }
  }

  // 3) Guardar la sesion
  await ghGuardarArchivo(cfg, rutaSesion, sesion, existente ? existente.sha : undefined, `Agrega sesion ${payload.fecha}${firma}`);

  // 4) Registrar el archivo en el manifest si todavia no estaba
  const manifestFile = await ghObtenerArchivo(cfg, 'data/manifest.json');
  const manifest = manifestFile ? manifestFile.datos : [];
  if (!manifest.includes(archivo)) {
    manifest.push(archivo);
    await ghGuardarArchivo(cfg, 'data/manifest.json', manifest, manifestFile ? manifestFile.sha : undefined, `Registra ${archivo} en el manifest`);
  }

  return { ok: true, archivo, partidas_en_la_sesion: sesion.partidas.length };
}

// El bracket completo (rondas, participantes, ganadores) se arma del lado
// del cliente (torneo.js) y estas tres funciones solo lo persisten — igual
// que un torneo en papel: quien carga la web sabe mejor que el servidor
// cómo se arma un cuadro de eliminación, acá solo se guarda el resultado.

async function crearTorneo(cfg, torneo, autor) {
  const firma = autor ? ` (por ${autor})` : '';
  const ruta = `data/torneos/${torneo.id}.json`;

  const existente = await ghObtenerArchivo(cfg, ruta);
  if (existente) throw new Error('Ya existe un torneo con ese id');

  await ghGuardarArchivo(cfg, ruta, torneo, undefined, `Crea torneo "${torneo.nombre}"${firma}`);

  const manifestFile = await ghObtenerArchivo(cfg, 'data/torneos-manifest.json');
  const manifest = manifestFile ? manifestFile.datos : [];
  const archivo = `${torneo.id}.json`;
  if (!manifest.includes(archivo)) {
    manifest.push(archivo);
    await ghGuardarArchivo(cfg, 'data/torneos-manifest.json', manifest, manifestFile ? manifestFile.sha : undefined, `Registra torneo ${archivo} en el manifest${firma}`);
  }

  return { ok: true, torneo };
}

async function guardarTorneo(cfg, torneo, autor) {
  const firma = autor ? ` (por ${autor})` : '';
  const ruta = `data/torneos/${torneo.id}.json`;

  const existente = await ghObtenerArchivo(cfg, ruta);
  if (!existente) throw new Error('Ese torneo no existe');

  await ghGuardarArchivo(cfg, ruta, torneo, existente.sha, `Actualiza torneo "${torneo.nombre || torneo.id}"${firma}`);
  return { ok: true, torneo };
}

async function eliminarTorneo(cfg, torneoId, autor) {
  const firma = autor ? ` (por ${autor})` : '';
  const archivo = `${torneoId}.json`;
  const ruta = `data/torneos/${archivo}`;

  const existente = await ghObtenerArchivo(cfg, ruta);
  if (existente) {
    await ghEliminarArchivo(cfg, ruta, existente.sha, `Elimina torneo ${torneoId}${firma}`);
  }

  const manifestFile = await ghObtenerArchivo(cfg, 'data/torneos-manifest.json');
  const manifest = manifestFile ? manifestFile.datos : [];
  const idx = manifest.indexOf(archivo);
  if (idx !== -1) {
    manifest.splice(idx, 1);
    await ghGuardarArchivo(cfg, 'data/torneos-manifest.json', manifest, manifestFile.sha, `Quita ${archivo} del manifest de torneos${firma}`);
  }

  return { ok: true };
}
