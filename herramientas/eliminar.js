let sesionActual = null;
let archivoActual = null;
let jugadoresPorId = {};

async function cargarJugadores(){
  try{
    const arr = await fetch('../data/players.json', { cache: 'no-store' }).then(r => r.json());
    jugadoresPorId = {};
    arr.forEach(j => jugadoresPorId[j.id] = j.nombre);
  }catch(e){
    jugadoresPorId = {};
  }
}

async function poblarSelector(){
  const select = document.getElementById('selector-fecha');
  let manifest = [];
  try{
    manifest = await fetch('../data/manifest.json', { cache: 'no-store' }).then(r => r.json());
  }catch(e){ /* queda vacio */ }

  if(manifest.length === 0){
    select.innerHTML = '<option value="">No hay sesiones cargadas todavía</option>';
    return;
  }

  const archivosOrdenados = [...manifest].sort().reverse();
  select.innerHTML = '<option value="">Elegí una sesión...</option>';
  for(const archivo of archivosOrdenados){
    let etiqueta = archivo.replace('.json', '');
    try{
      const s = await fetch(`../data/sessions/${archivo}`, { cache: 'no-store' }).then(r => r.json());
      const cant = (s.partidas || []).length;
      etiqueta = `${formatFecha(s.fecha)} — ${s.titulo || 'Noche de juego'} (${cant} partida${cant === 1 ? '' : 's'})`;
    }catch(e){ /* dejamos la etiqueta por defecto */ }
    const opt = document.createElement('option');
    opt.value = archivo;
    opt.textContent = etiqueta;
    select.appendChild(opt);
  }
}

function renderJugadorFilaEliminar(j){
  const nombre = jugadoresPorId[j.jugador] || j.jugador;
  const iconUrl = champIconUrl(j.campeon);
  const kda = j.kda ? `${j.kda.k ?? 0}/${j.kda.d ?? 0}/${j.kda.a ?? 0}` : '';
  const premiosHtml = (j.premios || []).map(p => {
    const info = PREMIOS_INFO[p];
    return info ? `<span class="premio ${p}">${info.icono} ${info.label}</span>` : '';
  }).join('');
  const avatarHtml = iconUrl
    ? `<img class="jugador-avatar" src="${iconUrl}" alt="${j.campeon || ''}" onerror="this.outerHTML='<div class=&quot;jugador-avatar-fallback&quot;>${iniciales(nombre)}</div>'">`
    : `<div class="jugador-avatar-fallback">${iniciales(nombre)}</div>`;
  const comentarioHtml = j.comentario ? `<div class="jugador-comentario">"${j.comentario}"</div>` : '';

  return `
    <div class="jugador-fila">
      ${avatarHtml}
      <div class="jugador-info">
        <div class="jugador-nombre">${nombre} ${premiosHtml ? `<span class="jugador-premios">${premiosHtml}</span>` : ''}</div>
        <div class="jugador-rol">${j.rol || ''}${j.rol && j.campeon ? ' · ' : ''}<span class="jugador-campeon">${j.campeon || ''}</span></div>
      </div>
      <div class="jugador-kda">${kda}</div>
      ${comentarioHtml}
    </div>
  `;
}

function renderPartidasMostradas(){
  const cont = document.getElementById('partidas-mostradas');
  cont.innerHTML = '';
  (sesionActual.partidas || []).forEach((p, idx) => {
    const resultadoClase = p.resultado === 'Victoria' ? 'victoria' : 'derrota';
    const meta = [p.modo, p.duracion].filter(Boolean).join(' · ');
    const filas = (p.jugadores || []).map(renderJugadorFilaEliminar).join('');

    const div = document.createElement('div');
    div.className = 'partida-eliminar';
    div.innerHTML = `
      <div class="partida-eliminar-header">
        <span class="partida-numero">Partida ${p.numero ?? idx + 1}</span>
        <span class="badge-resultado ${resultadoClase}">${p.resultado || '?'}</span>
        ${meta ? `<span class="partida-eliminar-meta">${meta}</span>` : ''}
        <button type="button" class="btn-quitar-partida-mostrada">✕ Eliminar esta partida</button>
      </div>
      <div class="jugadores-tabla">${filas}</div>
    `;
    div.querySelector('.btn-quitar-partida-mostrada').addEventListener('click', () => eliminarPartida(idx));
    cont.appendChild(div);
  });
}

function mostrarMensaje(texto, tipo){
  const el = document.getElementById('mensaje');
  el.textContent = texto;
  el.className = `mensaje ${tipo}`;
  el.hidden = false;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function guardarSesionActual(){
  const payload = {
    fecha: sesionActual.fecha,
    titulo: sesionActual.titulo || '',
    notas: sesionActual.notas || '',
    partidas: sesionActual.partidas || [],
    accion: 'reemplazar',
  };
  return guardarEnBackend(payload, { endpointLocal: '/api/guardar-sesion' });
}

async function volverASeleccionVacia(){
  document.getElementById('zona-sesion').hidden = true;
  sesionActual = null;
  archivoActual = null;
  await poblarSelector();
  document.getElementById('selector-fecha').value = '';
}

async function eliminarPartida(idx){
  if(!confirm('¿Eliminar esta partida? No se puede deshacer desde acá.')) return;
  const copiaOriginal = sesionActual.partidas;
  sesionActual.partidas = sesionActual.partidas.filter((_, i) => i !== idx);
  try{
    const data = await guardarSesionActual();
    if(data.eliminada){
      mostrarMensaje('Esa era la última partida — se eliminó toda la sesión.', 'ok');
      await volverASeleccionVacia();
    }else{
      mostrarMensaje(`Partida eliminada. Quedan ${data.partidas_en_la_sesion} en esta sesión.`, 'ok');
      renderPartidasMostradas();
      await poblarSelector();
      document.getElementById('selector-fecha').value = archivoActual;
    }
  }catch(err){
    sesionActual.partidas = copiaOriginal;
    mostrarMensaje(`No se pudo eliminar: ${err.message}`, 'error');
  }
}

async function eliminarSesionCompleta(){
  if(!sesionActual) return;
  if(!confirm('¿Eliminar esta sesión completa, con todas sus partidas? No se puede deshacer desde acá.')) return;
  const original = sesionActual.partidas;
  sesionActual.partidas = [];
  try{
    await guardarSesionActual();
    mostrarMensaje('Sesión eliminada por completo.', 'ok');
    await volverASeleccionVacia();
  }catch(err){
    sesionActual.partidas = original;
    mostrarMensaje(`No se pudo eliminar: ${err.message}`, 'error');
  }
}

async function manejarSeleccion(){
  const archivo = document.getElementById('selector-fecha').value;
  if(!archivo){
    document.getElementById('zona-sesion').hidden = true;
    sesionActual = null;
    archivoActual = null;
    return;
  }
  archivoActual = archivo;
  try{
    sesionActual = await fetch(`../data/sessions/${archivo}`, { cache: 'no-store' }).then(r => r.json());
  }catch(e){
    mostrarMensaje('No se pudo cargar esa sesión.', 'error');
    return;
  }
  document.getElementById('sesion-titulo-mostrado').textContent = sesionActual.titulo || 'Noche de juego';
  document.getElementById('sesion-fecha-mostrada').textContent = formatFecha(sesionActual.fecha);
  renderPartidasMostradas();
  document.getElementById('zona-sesion').hidden = false;
}

(async function init(){
  await cargarJugadores();
  await poblarSelector();
  initConfigProxy();
  actualizarIndicadorModo();

  document.getElementById('selector-fecha').addEventListener('change', manejarSeleccion);
  document.getElementById('btn-eliminar-todo').addEventListener('click', eliminarSesionCompleta);
})();
