let sesionActual = null;
let archivoActual = null;
let jugadoresPorId = {};
let jugadoresRoster = [];
let destacadosPorId = {};
let idxEnEdicion = null;

const MAX_JUGADORES_POR_PARTIDA = 5;
const tplPartidaEditar = document.getElementById('tpl-partida-editar');
const tplFilaJugadorEditar = document.getElementById('tpl-fila-jugador-editar');

async function cargarJugadores(){
  try{
    jugadoresRoster = await fetch('../data/players.json', { cache: 'no-store' }).then(r => r.json());
    jugadoresPorId = {};
    jugadoresRoster.forEach(j => jugadoresPorId[j.id] = j.nombre);
  }catch(e){
    jugadoresRoster = [];
    jugadoresPorId = {};
  }
  try{
    const arr = await fetch('../data/destacados.json', { cache: 'no-store' }).then(r => r.json());
    destacadosPorId = {};
    arr.forEach(d => destacadosPorId[d.id] = d.nombre);
  }catch(e){
    destacadosPorId = {};
  }
}

function renderDestacadoFilaEliminar(d){
  const nombre = destacadosPorId[d.destacado] || d.destacado;
  const kda = d.kda ? `${d.kda.k ?? 0}/${d.kda.d ?? 0}/${d.kda.a ?? 0}` : '';
  const avatarMarkup = avatarHtml(nombre, d.campeon);
  const comentarioHtml = d.comentario ? `<div class="jugador-comentario">"${d.comentario}"</div>` : '';

  return `
    <div class="jugador-fila">
      ${avatarMarkup}
      <div class="jugador-info">
        <div class="jugador-nombre">🎭 ${nombre}</div>
        <div class="jugador-rol">${d.rol || ''}${d.rol && d.campeon ? ' · ' : ''}<span class="jugador-campeon">${d.campeon || ''}</span></div>
      </div>
      <div class="jugador-kda">${kda}</div>
      ${comentarioHtml}
    </div>
  `;
}

function renderDestacadosEliminar(destacadosPartida){
  if(!destacadosPartida || !destacadosPartida.length) return '';
  const filas = destacadosPartida.map(renderDestacadoFilaEliminar).join('');
  return `
    <div class="destacados-partida">
      <div class="destacados-titulo">Personajes destacados</div>
      <div class="jugadores-tabla">${filas}</div>
    </div>
  `;
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
  const kda = j.kda ? `${j.kda.k ?? 0}/${j.kda.d ?? 0}/${j.kda.a ?? 0}` : '';
  const premiosHtml = (j.premios || []).map(p => {
    const info = PREMIOS_INFO[p];
    return info ? `<span class="premio ${p}">${info.icono} ${info.label}</span>` : '';
  }).join('');
  const avatarMarkup = avatarHtml(nombre, j.campeon);
  const comentarioHtml = j.comentario ? `<div class="jugador-comentario">"${j.comentario}"</div>` : '';

  return `
    <div class="jugador-fila">
      ${avatarMarkup}
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
    if(idx === idxEnEdicion){
      cont.appendChild(crearFormularioEdicionPartida(p, idx));
      return;
    }

    const resultadoClase = p.resultado === 'Victoria' ? 'victoria' : 'derrota';
    const meta = [p.modo, p.duracion].filter(Boolean).join(' · ');
    const filas = (p.jugadores || []).map(renderJugadorFilaEliminar).join('');
    const otraEnEdicion = idxEnEdicion !== null;

    const div = document.createElement('div');
    div.className = 'partida-eliminar';
    div.innerHTML = `
      <div class="partida-eliminar-header">
        <span class="partida-numero">Partida ${p.numero ?? idx + 1}</span>
        <span class="badge-resultado ${resultadoClase}">${p.resultado || '?'}</span>
        ${meta ? `<span class="partida-eliminar-meta">${meta}</span>` : ''}
        <button type="button" class="btn-editar-partida-mostrada" ${otraEnEdicion ? 'disabled' : ''}>✏️ Editar</button>
        <button type="button" class="btn-quitar-partida-mostrada" ${otraEnEdicion ? 'disabled' : ''}>✕ Eliminar esta partida</button>
      </div>
      <div class="jugadores-tabla">${filas}</div>
      ${renderDestacadosEliminar(p.destacados)}
    `;
    div.querySelector('.btn-quitar-partida-mostrada').addEventListener('click', () => eliminarPartida(idx));
    div.querySelector('.btn-editar-partida-mostrada').addEventListener('click', () => {
      idxEnEdicion = idx;
      renderPartidasMostradas();
    });
    cont.appendChild(div);
  });
}

// ---------- Edición de una partida ya guardada ----------
// Reusa el cálculo de premios y el buscador de campeón de comunes.js (los
// mismos que herramientas/cargar.js), armando filas con las mismas clases
// (.j-select, .j-k, .j-d, etc.) para que calcularPremiosDePartida funcione
// sin cambios.

function idsUsadosEnEdicion(bloque, filaExcluida){
  const ids = new Set();
  bloque.querySelectorAll('.v3-fila-jugador').forEach(fila => {
    if(fila === filaExcluida) return;
    const valor = fila.querySelector('.j-select').value;
    if(valor) ids.add(valor);
  });
  return ids;
}

function poblarSelectJugadorEdicion(select, idsUsados){
  const valorPrevio = select.value;
  select.innerHTML = '<option value="">Elegí...</option>';
  jugadoresRoster.forEach(j => {
    const opt = document.createElement('option');
    opt.value = j.id;
    opt.textContent = j.nombre;
    opt.disabled = idsUsados.has(j.id);
    select.appendChild(opt);
  });
  select.value = valorPrevio || '';
}

function refrescarSelectsDeEdicion(bloque){
  bloque.querySelectorAll('.v3-fila-jugador').forEach(fila => {
    const select = fila.querySelector('.j-select');
    poblarSelectJugadorEdicion(select, idsUsadosEnEdicion(bloque, fila));
  });
}

function crearFilaJugadorEdicion(bloque, datosJugador){
  const nodo = tplFilaJugadorEditar.content.cloneNode(true);
  const fila = nodo.querySelector('.v3-fila-jugador');
  const select = fila.querySelector('.j-select');

  poblarSelectJugadorEdicion(select, idsUsadosEnEdicion(bloque));
  initCampeonPicker(fila);

  if(datosJugador){
    fila.querySelector('.j-campeon').value = datosJugador.campeon || '';
    fila.querySelector('.j-rol').value = datosJugador.rol || '';
    fila.querySelector('.j-k').value = datosJugador.kda?.k ?? '';
    fila.querySelector('.j-d').value = datosJugador.kda?.d ?? '';
    fila.querySelector('.j-a').value = datosJugador.kda?.a ?? '';
    fila.querySelector('.j-cs').value = datosJugador.cs ?? '';
    fila.querySelector('.j-oro').value = datosJugador.oro ?? '';
    fila.querySelector('.j-vision').value = datosJugador.vision ?? '';
    fila.querySelector('.j-comentario').value = datosJugador.comentario || '';
    select.value = datosJugador.jugador || '';
  }

  select.addEventListener('change', () => refrescarSelectsDeEdicion(bloque));
  fila.querySelector('.btn-quitar-jugador').addEventListener('click', () => {
    fila.remove();
    refrescarSelectsDeEdicion(bloque);
    actualizarPremiosVisualesPartida(bloque);
  });

  return fila;
}

function leerJugadoresDeEdicion(bloque){
  const filas = Array.from(bloque.querySelectorAll('.v3-fila-jugador'));
  const premiosPorFila = calcularPremiosDePartida(bloque, filas);
  const jugadores = [];

  filas.forEach((fila, i) => {
    const jugadorId = fila.querySelector('.j-select').value;
    if(!jugadorId) return;

    const k = fila.querySelector('.j-k').value;
    const d = fila.querySelector('.j-d').value;
    const a = fila.querySelector('.j-a').value;
    const cs = fila.querySelector('.j-cs').value;
    const oro = fila.querySelector('.j-oro').value;
    const vision = fila.querySelector('.j-vision').value;

    const jugador = {
      jugador: jugadorId,
      campeon: normalizarNombreCampeon(fila.querySelector('.j-campeon').value),
      rol: fila.querySelector('.j-rol').value,
      kda: { k: Number(k)||0, d: Number(d)||0, a: Number(a)||0 },
      cs: Number(cs)||0,
      oro: Number(oro)||0,
      vision: Number(vision)||0,
      premios: premiosPorFila[i],
    };
    const comentario = fila.querySelector('.j-comentario').value.trim();
    if(comentario) jugador.comentario = comentario;

    jugadores.push(jugador);
  });

  return jugadores;
}

function crearFormularioEdicionPartida(partida, idx){
  const nodo = tplPartidaEditar.content.cloneNode(true);
  const bloque = nodo.querySelector('.bloque-partida');

  bloque.querySelector('.pe-numero').textContent = partida.numero ?? idx + 1;
  bloque.querySelector('.p-resultado').value = partida.resultado === 'Derrota' ? 'Derrota' : 'Victoria';

  const tbody = bloque.querySelector('.jugadores-tbody');
  (partida.jugadores || []).forEach(j => tbody.appendChild(crearFilaJugadorEdicion(bloque, j)));

  bloque.querySelector('.btn-agregar-jugador').addEventListener('click', () => {
    if(tbody.querySelectorAll('.v3-fila-jugador').length >= MAX_JUGADORES_POR_PARTIDA) return;
    tbody.appendChild(crearFilaJugadorEdicion(bloque, null));
    actualizarPremiosVisualesPartida(bloque);
  });
  tbody.addEventListener('input', (ev) => {
    if(ev.target.matches('.j-k, .j-d, .j-a, .j-cs, .j-oro, .j-vision')) actualizarPremiosVisualesPartida(bloque);
  });

  bloque.querySelector('.btn-cancelar-edicion').addEventListener('click', () => {
    idxEnEdicion = null;
    renderPartidasMostradas();
  });
  bloque.querySelector('.btn-guardar-edicion').addEventListener('click', () => guardarEdicionPartida(bloque, idx));

  actualizarPremiosVisualesPartida(bloque);
  return bloque;
}

async function guardarEdicionPartida(bloque, idx){
  const jugadores = leerJugadoresDeEdicion(bloque);
  const estado = bloque.querySelector('.pe-estado');
  if(!jugadores.length){
    estado.textContent = 'La partida necesita al menos un jugador.';
    estado.className = 'pe-estado estado-guardado error';
    return;
  }

  const resultado = bloque.querySelector('.p-resultado').value;
  const original = sesionActual.partidas[idx];
  const copiaOriginal = sesionActual.partidas;
  sesionActual.partidas = sesionActual.partidas.map((p, i) => i === idx ? { ...original, resultado, jugadores } : p);

  const btnGuardar = bloque.querySelector('.btn-guardar-edicion');
  btnGuardar.disabled = true;
  estado.textContent = 'Guardando...';
  estado.className = 'pe-estado estado-guardado';
  try{
    await guardarSesionActual();
    idxEnEdicion = null;
    mostrarMensaje('Partida actualizada.', 'ok');
    renderPartidasMostradas();
  }catch(err){
    sesionActual.partidas = copiaOriginal;
    btnGuardar.disabled = false;
    estado.textContent = `No se pudo guardar: ${err.message}`;
    estado.className = 'pe-estado estado-guardado error';
  }
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
  idxEnEdicion = null;
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
  idxEnEdicion = null;
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
