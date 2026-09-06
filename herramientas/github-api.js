// Guarda partidas commiteando directo al repo vía la API de GitHub.
// Se usa cuando la página NO corre en localhost (o sea, cuando está publicada
// en GitHub Pages) — ahí no hay ningún servidor propio disponible.
//
// El token nunca sale del navegador de quien lo pega: viaja únicamente en el
// header Authorization de los pedidos a api.github.com, y se guarda solo en
// el localStorage de ese navegador.

const GH_CONFIG_KEY = 'bitacora_github_config';
const GH_API_BASE = (window.__GH_API_BASE_OVERRIDE__ || 'https://api.github.com');

function ghCargarConfig(){
  try{
    return JSON.parse(localStorage.getItem(GH_CONFIG_KEY)) || {};
  }catch(e){
    return {};
  }
}

function ghGuardarConfig(cfg){
  localStorage.setItem(GH_CONFIG_KEY, JSON.stringify(cfg));
}

function ghBorrarConfig(){
  localStorage.removeItem(GH_CONFIG_KEY);
}

function ghConfigCompleta(cfg){
  return !!(cfg && cfg.owner && cfg.repo && cfg.token);
}

function utf8ToB64(str){
  const bytes = new TextEncoder().encode(str);
  let binario = '';
  bytes.forEach(b => binario += String.fromCharCode(b));
  return btoa(binario);
}

function b64ToUtf8(b64){
  const binario = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binario, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function ghFetch(cfg, path, opciones = {}){
  const url = `${GH_API_BASE}/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
  const resp = await fetch(url, {
    ...opciones,
    headers: {
      'Authorization': `Bearer ${cfg.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opciones.headers || {}),
    },
  });
  return resp;
}

// Devuelve {sha, datos} si el archivo existe, o null si no existe (404).
async function ghObtenerArchivo(cfg, path){
  const resp = await ghFetch(cfg, `${path}?ref=${encodeURIComponent(cfg.branch || 'main')}`);
  if(resp.status === 404) return null;
  if(resp.status === 401 || resp.status === 403){
    throw new Error('El token no es válido o no tiene permiso sobre este repo (revisá el scope: Contents → Read and write).');
  }
  if(!resp.ok){
    throw new Error(`GitHub devolvió ${resp.status} al leer ${path}`);
  }
  const json = await resp.json();
  return { sha: json.sha, datos: JSON.parse(b64ToUtf8(json.content)) };
}

async function ghGuardarArchivo(cfg, path, datosObjeto, shaPrevia, mensaje){
  const body = {
    message: mensaje,
    content: utf8ToB64(JSON.stringify(datosObjeto, null, 2) + '\n'),
    branch: cfg.branch || 'main',
  };
  if(shaPrevia) body.sha = shaPrevia;

  const resp = await ghFetch(cfg, path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if(resp.status === 409){
    throw new Error('Alguien guardó otra sesión justo ahora (conflicto de versión). Probá guardar de nuevo.');
  }
  if(resp.status === 401 || resp.status === 403){
    throw new Error('El token no es válido o no tiene permiso de escritura sobre este repo.');
  }
  if(!resp.ok){
    const detalle = await resp.json().catch(() => ({}));
    throw new Error(detalle.message || `GitHub devolvió ${resp.status} al guardar ${path}`);
  }
  return resp.json();
}

async function guardarSesionGithub(cfg, payload){
  const archivo = `${payload.fecha}.json`;
  const rutaSesion = `data/sessions/${archivo}`;

  // 1) Mezclar con la sesion existente de ese dia, si ya habia una
  const existente = await ghObtenerArchivo(cfg, rutaSesion);
  let sesion;
  if(existente){
    sesion = existente.datos;
    const previas = sesion.partidas || [];
    const base = Math.max(0, ...previas.map(p => p.numero || 0));
    payload.partidas.forEach((p, i) => { p.numero = base + i + 1; });
    sesion.partidas = previas.concat(payload.partidas);
    if(payload.titulo) sesion.titulo = payload.titulo;
    if(payload.notas) sesion.notas = payload.notas;
  }else{
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
  sesion.partidas.forEach(p => p.jugadores.forEach(j => {
    if(j.nombre_invitado) invitados.push({ id: j.jugador, nombre: j.nombre_invitado });
    delete j.nombre_invitado;
  }));
  if(invitados.length){
    const playersFile = await ghObtenerArchivo(cfg, 'data/players.json');
    const players = playersFile ? playersFile.datos : [];
    const idsExistentes = new Set(players.map(p => p.id));
    let cambio = false;
    invitados.forEach(inv => {
      if(!idsExistentes.has(inv.id)){
        players.push(inv);
        idsExistentes.add(inv.id);
        cambio = true;
      }
    });
    if(cambio){
      await ghGuardarArchivo(cfg, 'data/players.json', players, playersFile ? playersFile.sha : undefined, `Suma invitado a la bitacora (${payload.fecha})`);
    }
  }

  // 3) Guardar la sesion
  await ghGuardarArchivo(cfg, rutaSesion, sesion, existente ? existente.sha : undefined, `Agrega sesion ${payload.fecha}`);

  // 4) Registrar el archivo en el manifest si todavia no estaba
  const manifestFile = await ghObtenerArchivo(cfg, 'data/manifest.json');
  const manifest = manifestFile ? manifestFile.datos : [];
  if(!manifest.includes(archivo)){
    manifest.push(archivo);
    await ghGuardarArchivo(cfg, 'data/manifest.json', manifest, manifestFile ? manifestFile.sha : undefined, `Registra ${archivo} en el manifest`);
  }

  return { archivo, partidas_en_la_sesion: sesion.partidas.length };
}
