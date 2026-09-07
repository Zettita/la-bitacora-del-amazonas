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

    const fecha = String(body.fecha || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return jsonResp({ error: 'Fecha invalida, se espera AAAA-MM-DD' }, 400, cors);
    }
    const accion = body.accion === 'reemplazar' ? 'reemplazar' : 'agregar';
    const partidas = Array.isArray(body.partidas) ? body.partidas : [];
    if (accion === 'agregar' && partidas.length === 0) {
      return jsonResp({ error: 'La sesion no tiene partidas' }, 400, cors);
    }

    const cfg = {
      owner: env.GITHUB_OWNER,
      repo: env.GITHUB_REPO,
      branch: env.GITHUB_BRANCH || 'main',
      token: env.GITHUB_TOKEN,
    };
    const payload = {
      fecha,
      titulo: String(body.titulo || '').trim(),
      notas: String(body.notas || '').trim(),
      partidas,
      autor: String(body.autor || '').trim(),
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

  // 2) Dar de alta invitados nuevos en el roster, si aparece alguno
  const invitados = [];
  sesion.partidas.forEach((p) => p.jugadores.forEach((j) => {
    if (j.nombre_invitado) invitados.push({ id: j.jugador, nombre: j.nombre_invitado });
    delete j.nombre_invitado;
  }));
  if (invitados.length) {
    const playersFile = await ghObtenerArchivo(cfg, 'data/players.json');
    const players = playersFile ? playersFile.datos : [];
    const idsExistentes = new Set(players.map((p) => p.id));
    let cambio = false;
    invitados.forEach((inv) => {
      if (!idsExistentes.has(inv.id)) {
        players.push(inv);
        idsExistentes.add(inv.id);
        cambio = true;
      }
    });
    if (cambio) {
      await ghGuardarArchivo(cfg, 'data/players.json', players, playersFile ? playersFile.sha : undefined, `Suma invitado a la bitacora${firma}`);
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
