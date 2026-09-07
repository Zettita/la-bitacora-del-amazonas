let jugadoresRoster = [];
let contadorPartidas = 0;

const contenedorPartidas = document.getElementById('partidas-contenedor');
const tplPartida = document.getElementById('tpl-partida');
const tplJugador = document.getElementById('tpl-jugador');
const tplInvitado = document.getElementById('tpl-invitado');

function normalizarTexto(s){
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/gi, '').toLowerCase();
}

// Buscador de campeón: al enfocar o escribir muestra los 60 campeones de
// LoL Classic (con su ícono) filtrados por lo tipeado; un click en una
// opción completa el campo.
function initCampeonPicker(fila){
  const input = fila.querySelector('.j-campeon');
  const picker = input.closest('.campeon-picker');
  const opciones = picker.querySelector('.campeon-opciones');
  let resaltado = -1;

  function pintar(filtro){
    const norm = normalizarTexto(filtro);
    const coincidencias = CAMPEONES_CLASICOS.filter(c => normalizarTexto(c).includes(norm));
    resaltado = coincidencias.length ? 0 : -1;
    opciones.innerHTML = coincidencias.length
      ? coincidencias.map((c, i) => `
          <div class="campeon-opcion${i === 0 ? ' resaltada' : ''}" data-nombre="${c}">
            <img src="${classicTileUrl(c) || ''}" alt="" loading="lazy">
            <span>${c}</span>
          </div>
        `).join('')
      : '<div class="campeon-sin-resultados">Sin resultados</div>';
  }

  function abrir(){
    pintar(input.value);
    opciones.hidden = false;
  }
  function cerrar(){
    opciones.hidden = true;
  }
  function marcarResaltado(nuevoIndice){
    const items = opciones.querySelectorAll('.campeon-opcion');
    if(!items.length) return;
    resaltado = (nuevoIndice + items.length) % items.length;
    items.forEach((el, i) => el.classList.toggle('resaltada', i === resaltado));
    items[resaltado].scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('focus', abrir);
  input.addEventListener('input', abrir);
  input.addEventListener('blur', () => setTimeout(cerrar, 150));

  input.addEventListener('keydown', (ev) => {
    if(opciones.hidden && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')){
      abrir();
      return;
    }
    if(ev.key === 'ArrowDown'){ ev.preventDefault(); marcarResaltado(resaltado + 1); }
    else if(ev.key === 'ArrowUp'){ ev.preventDefault(); marcarResaltado(resaltado - 1); }
    else if(ev.key === 'Enter'){
      const item = opciones.querySelectorAll('.campeon-opcion')[resaltado];
      if(item){ ev.preventDefault(); input.value = item.dataset.nombre; cerrar(); }
    }else if(ev.key === 'Escape'){
      cerrar();
    }
  });

  opciones.addEventListener('mousedown', (ev) => {
    const opt = ev.target.closest('.campeon-opcion');
    if(!opt) return;
    input.value = opt.dataset.nombre;
    cerrar();
    input.focus();
  });
}

async function cargarRoster(){
  try{
    jugadoresRoster = await fetch('../data/players.json', { cache: 'no-store' }).then(r => r.json());
  }catch(e){
    jugadoresRoster = [];
  }
}

function crearFilaJugador(jugador){
  const nodo = tplJugador.content.cloneNode(true);
  const fila = nodo.querySelector('.jugador-form-fila');
  fila.dataset.jugadorId = jugador.id;
  fila.querySelector('.j-nombre-roster').textContent = jugador.nombre;

  const check = fila.querySelector('.j-participo');
  check.addEventListener('change', () => fila.classList.toggle('desactivado', !check.checked));
  initCampeonPicker(fila);

  return fila;
}

function crearFilaInvitado(){
  const nodo = tplInvitado.content.cloneNode(true);
  const fila = nodo.querySelector('.jugador-form-fila');
  const check = fila.querySelector('.inv-participo');
  const nombre = fila.querySelector('.inv-nombre');
  const actualizar = () => fila.classList.toggle('desactivado', !check.checked);
  check.addEventListener('change', actualizar);
  nombre.addEventListener('input', () => { if(nombre.value.trim()) check.checked = true; actualizar(); });
  actualizar();
  initCampeonPicker(fila);
  return fila;
}

function agregarBloquePartida(){
  contadorPartidas++;
  const nodo = tplPartida.content.cloneNode(true);
  const bloque = nodo.querySelector('.bloque-partida');
  bloque.dataset.indice = contadorPartidas;
  bloque.querySelector('.num-partida').textContent = contadorPartidas;

  const contJugadores = bloque.querySelector('.jugadores-form');
  jugadoresRoster.forEach(j => contJugadores.appendChild(crearFilaJugador(j)));
  contJugadores.appendChild(crearFilaInvitado());

  bloque.querySelector('.btn-quitar-partida').addEventListener('click', () => {
    bloque.remove();
    renumerarPartidas();
  });

  contenedorPartidas.appendChild(bloque);
}

function renumerarPartidas(){
  const bloques = contenedorPartidas.querySelectorAll('.bloque-partida');
  bloques.forEach((b, i) => { b.querySelector('.num-partida').textContent = i + 1; });
  contadorPartidas = bloques.length;
}

function leerJugadoresDePartida(bloque){
  const jugadores = [];

  bloque.querySelectorAll('.jugador-form-fila').forEach(fila => {
    const esInvitado = fila.classList.contains('jugador-invitado');
    const participo = esInvitado
      ? fila.querySelector('.inv-participo').checked
      : fila.querySelector('.j-participo').checked;
    if(!participo) return;

    let jugadorId, nombreInvitado;
    if(esInvitado){
      const nombre = fila.querySelector('.inv-nombre').value.trim();
      if(!nombre) return;
      jugadorId = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'invitado';
      nombreInvitado = nombre;
    }else{
      jugadorId = fila.dataset.jugadorId;
    }

    const premios = Array.from(fila.querySelectorAll('.premio-check input:checked')).map(c => c.value);
    const k = fila.querySelector('.j-k').value;
    const d = fila.querySelector('.j-d').value;
    const a = fila.querySelector('.j-a').value;

    const jugador = {
      jugador: jugadorId,
      campeon: fila.querySelector('.j-campeon').value.trim(),
      rol: fila.querySelector('.j-rol').value,
      kda: { k: Number(k)||0, d: Number(d)||0, a: Number(a)||0 },
      premios,
    };
    const comentario = fila.querySelector('.j-comentario').value.trim();
    if(comentario) jugador.comentario = comentario;
    if(nombreInvitado) jugador.nombre_invitado = nombreInvitado;

    jugadores.push(jugador);
  });

  return jugadores;
}

function leerPartidas(){
  return Array.from(contenedorPartidas.querySelectorAll('.bloque-partida')).map(bloque => ({
    resultado: bloque.querySelector('.p-resultado').value,
    duracion: bloque.querySelector('.p-duracion').value.trim(),
    modo: bloque.querySelector('.p-modo').value.trim(),
    jugadores: leerJugadoresDePartida(bloque),
  }));
}

function mostrarMensaje(texto, tipo){
  const el = document.getElementById('mensaje');
  el.textContent = texto;
  el.className = `mensaje ${tipo}`;
  el.hidden = false;
  el.scrollIntoView({ behavior:'smooth', block:'start' });
}

async function manejarSubmit(ev){
  ev.preventDefault();

  const fecha = document.getElementById('fecha').value;
  if(!fecha){
    mostrarMensaje('Falta la fecha de la sesión.', 'error');
    return;
  }

  const partidas = leerPartidas();
  if(partidas.length === 0){
    mostrarMensaje('Agregá al menos una partida.', 'error');
    return;
  }
  const sinJugadores = partidas.some(p => p.jugadores.length === 0);
  if(sinJugadores){
    mostrarMensaje('Hay una partida sin ningún jugador marcado como participante.', 'error');
    return;
  }

  const payload = {
    fecha,
    titulo: document.getElementById('titulo').value.trim(),
    notas: document.getElementById('notas').value.trim(),
    partidas,
  };

  const estado = document.getElementById('estado-guardado');
  estado.textContent = 'Guardando...';

  try{
    const data = await guardarEnBackend(payload, { endpointLocal: '/api/guardar-sesion' });

    estado.textContent = '';
    const notaCommit = esModoLocal()
      ? 'Ahora podés hacer git add / commit / push.'
      : 'Se subió como commit directo al repo — en un minuto lo va a reflejar el sitio publicado.';
    mostrarMensaje(`Guardado en data/sessions/${data.archivo} (${data.partidas_en_la_sesion} partida(s) en total ese día). ${notaCommit}`, 'ok');

    contenedorPartidas.innerHTML = '';
    contadorPartidas = 0;
    agregarBloquePartida();
    document.getElementById('titulo').value = '';
    document.getElementById('notas').value = '';
  }catch(err){
    estado.textContent = '';
    const pista = esModoLocal() ? ' ¿Está corriendo herramientas/servidor.py?' : '';
    mostrarMensaje(`No se pudo guardar: ${err.message}.${pista}`, 'error');
  }
}

(async function init(){
  await cargarRoster();
  agregarBloquePartida();
  initConfigProxy();
  actualizarIndicadorModo();

  document.getElementById('btn-agregar-partida').addEventListener('click', agregarBloquePartida);
  document.getElementById('form-sesion').addEventListener('submit', manejarSubmit);

  const hoy = new Date();
  const iso = new Date(hoy.getTime() - hoy.getTimezoneOffset()*60000).toISOString().slice(0,10);
  document.getElementById('fecha').value = iso;
})();
