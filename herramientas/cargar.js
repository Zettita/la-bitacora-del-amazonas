let jugadoresRoster = [];
let contadorPartidas = 0;

const contenedorPartidas = document.getElementById('partidas-contenedor');
const tplPartida = document.getElementById('tpl-partida');
const tplJugador = document.getElementById('tpl-jugador');
const tplInvitado = document.getElementById('tpl-invitado');

async function cargarRoster(){
  try{
    jugadoresRoster = await fetch('../data/players.json').then(r => r.json());
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
    const resp = await fetch('/api/guardar-sesion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if(!resp.ok){
      throw new Error(data.error || 'Error desconocido');
    }
    estado.textContent = '';
    mostrarMensaje(`Guardado en data/sessions/${data.archivo} (${data.partidas_en_la_sesion} partida(s) en total ese día). Ahora podés hacer git add / commit / push. También podés ver el resultado en la crónica.`, 'ok');

    contenedorPartidas.innerHTML = '';
    contadorPartidas = 0;
    agregarBloquePartida();
    document.getElementById('titulo').value = '';
    document.getElementById('notas').value = '';
  }catch(err){
    estado.textContent = '';
    mostrarMensaje(`No se pudo guardar: ${err.message}. ¿Está corriendo herramientas/servidor.py?`, 'error');
  }
}

(async function init(){
  await cargarRoster();
  agregarBloquePartida();

  document.getElementById('btn-agregar-partida').addEventListener('click', agregarBloquePartida);
  document.getElementById('form-sesion').addEventListener('submit', manejarSubmit);

  const hoy = new Date();
  const iso = new Date(hoy.getTime() - hoy.getTimezoneOffset()*60000).toISOString().slice(0,10);
  document.getElementById('fecha').value = iso;
})();
