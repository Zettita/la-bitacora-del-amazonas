// Armar torneos nuevos y cargar sus resultados. El armado del bracket, el
// avance de ganadores y el render del cuadro/podio viven en comunes.js
// (compartidos con js/torneos.js, la página pública).

let jugadoresRoster = [];
let jugadoresPorId = {};
// Torneos ya publicados en el repo (siempre cerrados: es la única forma en
// que un torneo llega ahí). Se cargan una vez del sitio.
let torneosCommiteados = [];
// Torneos todavía en juego: viven solo en este navegador (localStorage),
// nunca pisan el repo hasta que se tocan "Finalizar torneo" — así ni crear
// el torneo ni anotar cada resultado dispara un commit/llamada al Worker.
let torneosBorrador = [];

const TORNEOS_BORRADOR_KEY = 'bitacora_torneos_borrador';

function cargarBorradoresTorneos(){
  try{
    return JSON.parse(localStorage.getItem(TORNEOS_BORRADOR_KEY)) || [];
  }catch(e){
    return [];
  }
}

function guardarBorradoresTorneos(){
  localStorage.setItem(TORNEOS_BORRADOR_KEY, JSON.stringify(torneosBorrador));
}

function normalizarTextoTn(s){
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function slugifyTn(nombre){
  return nombre.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'torneo';
}

async function cargarDatosIniciales(){
  const sinCache = { cache: 'no-store' };
  const [jugadoresArr, manifest] = await Promise.all([
    fetch('../data/players.json', sinCache).then(r => r.json()).catch(() => []),
    fetch('../data/torneos-manifest.json', sinCache).then(r => r.json()).catch(() => []),
  ]);
  jugadoresRoster = jugadoresArr;
  jugadoresPorId = {};
  jugadoresArr.forEach(j => { jugadoresPorId[j.id] = j; });

  torneosCommiteados = [];
  for(const archivo of manifest){
    try{
      const t = await fetch(`../data/torneos/${archivo}`, sinCache).then(r => r.json());
      torneosCommiteados.push(t);
    }catch(e){
      console.warn('No se pudo cargar el torneo', archivo, e);
    }
  }

  torneosBorrador = cargarBorradoresTorneos();
}

// ---------- Alta rápida de jugador (por si alguien viene solo para el torneo) ----------

function slugifyJugadorTn(nombre){
  return nombre.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'jugador';
}

function mostrarEstadoAlta(texto, tipo){
  const el = document.getElementById('alta-jugador-estado');
  el.textContent = texto;
  el.className = 'estado-guardado' + (tipo ? ` ${tipo}` : '');
}

// Un jugador nuevo tiene que aparecer sin perder lo que ya se venía
// completando: en modo individual se agrega como opción a todos los
// selects ya armados, y en equipos se agrega un chip nuevo a cada tarjeta.
function agregarJugadorAlaUIDeParticipantes(jugador){
  const modo = document.getElementById('tn-modo').value;

  if(modo === 'individual'){
    poblarSelectsIndividual();
    return;
  }

  document.querySelectorAll('.tn-equipo-jugadores').forEach(cont => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tn-chip-jugador';
    chip.dataset.id = jugador.id;
    chip.textContent = jugador.nombre;
    chip.addEventListener('click', () => {
      chip.classList.toggle('on');
      refrescarChipsEquipos();
    });
    cont.appendChild(chip);
  });
}

async function manejarAltaJugador(ev){
  ev.preventDefault();

  const inputNombre = document.getElementById('nj-nombre-rapida');
  const nombre = inputNombre.value.trim();
  if(!nombre){
    mostrarEstadoAlta('Escribí un nombre.', 'error');
    return;
  }
  const id = slugifyJugadorTn(nombre);
  if(jugadoresRoster.some(j => j.id === id)){
    mostrarEstadoAlta('Ya hay un jugador con ese nombre en el roster.', 'error');
    return;
  }

  const rolPreferido = document.getElementById('nj-rol-rapida').value;
  const inputImagen = document.getElementById('nj-imagen-rapida');
  const payload = { accion: 'agregar_jugador', id, nombre };
  if(rolPreferido) payload.rolPreferido = rolPreferido;
  if(inputImagen.dataset.dataurl) payload.imagenDatos = inputImagen.dataset.dataurl;

  const btn = document.getElementById('btn-alta-jugador');
  btn.disabled = true;
  mostrarEstadoAlta('Guardando...', '');

  try{
    const data = await guardarEnBackend(payload, { endpointLocal: '/api/agregar-jugador' });
    jugadoresRoster.push(data.jugador);
    jugadoresPorId[data.jugador.id] = data.jugador;
    agregarJugadorAlaUIDeParticipantes(data.jugador);

    inputNombre.value = '';
    document.getElementById('nj-rol-rapida').value = '';
    inputImagen.value = '';
    delete inputImagen.dataset.dataurl;
    document.getElementById('nj-preview-rapida').hidden = true;
    mostrarEstadoAlta(`✓ ${data.jugador.nombre} se sumó al roster.`, 'ok');
  }catch(err){
    const pista = esModoLocal() ? ' ¿Está corriendo herramientas/servidor.py?' : '';
    mostrarEstadoAlta(`Error: ${err.message}.${pista}`, 'error');
  }finally{
    btn.disabled = false;
  }
}

function initAltaJugador(){
  document.getElementById('form-alta-jugador').addEventListener('submit', manejarAltaJugador);

  const inputImagen = document.getElementById('nj-imagen-rapida');
  const preview = document.getElementById('nj-preview-rapida');
  inputImagen.addEventListener('change', async () => {
    const archivo = inputImagen.files[0];
    delete inputImagen.dataset.dataurl;
    preview.hidden = true;
    if(!archivo) return;
    try{
      const dataUrl = await comprimirImagen(archivo);
      inputImagen.dataset.dataurl = dataUrl;
      preview.src = dataUrl;
      preview.hidden = false;
    }catch(e){
      mostrarEstadoAlta('No se pudo procesar esa imagen, probá con otra.', 'error');
      inputImagen.value = '';
    }
  });
}

// ---------- Crear torneo ----------

function regenerarParticipantesUI(){
  const modo = document.getElementById('tn-modo').value;
  const cantidad = Number(document.getElementById('tn-cantidad').value);
  const cont = document.getElementById('tn-participantes');

  if(modo === 'individual'){
    cont.innerHTML = `<div class="tn-part-individual">${
      Array.from({ length: cantidad }, (_, i) => `
        <select class="tn-part-jugador" data-slot="${i}" required>
          <option value="">Jugador ${i + 1}...</option>
        </select>
      `).join('')
    }</div>`;
    poblarSelectsIndividual();
    cont.querySelectorAll('.tn-part-jugador').forEach(sel => {
      sel.addEventListener('change', poblarSelectsIndividual);
    });
  }else{
    cont.innerHTML = Array.from({ length: cantidad }, (_, i) => `
      <div class="tn-equipo-card" data-slot="${i}">
        <input type="text" class="tn-equipo-nombre" placeholder="Nombre del equipo ${i + 1}" maxlength="30" required>
        <div class="tn-equipo-jugadores">
          ${jugadoresRoster.map(j => `<button type="button" class="tn-chip-jugador" data-id="${j.id}">${j.nombre}</button>`).join('')}
        </div>
      </div>
    `).join('');
    cont.querySelectorAll('.tn-chip-jugador').forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('on');
        refrescarChipsEquipos();
      });
    });
  }
}

function poblarSelectsIndividual(){
  const selects = Array.from(document.querySelectorAll('.tn-part-jugador'));
  const usados = new Set(selects.map(s => s.value).filter(Boolean));
  selects.forEach(sel => {
    const previo = sel.value;
    sel.innerHTML = `<option value="">Jugador ${Number(sel.dataset.slot) + 1}...</option>` +
      jugadoresRoster.map(j => `<option value="${j.id}" ${usados.has(j.id) && j.id !== previo ? 'disabled' : ''}>${j.nombre}</option>`).join('');
    sel.value = previo;
  });
}

// Un jugador ya elegido en OTRO equipo queda deshabilitado (no se puede
// repetir integrante entre equipos de un mismo torneo).
function refrescarChipsEquipos(){
  const tarjetas = Array.from(document.querySelectorAll('.tn-equipo-card'));
  const elegidosPorTarjeta = tarjetas.map(t => new Set(
    Array.from(t.querySelectorAll('.tn-chip-jugador.on')).map(c => c.dataset.id)
  ));
  tarjetas.forEach((t, i) => {
    t.querySelectorAll('.tn-chip-jugador').forEach(chip => {
      const elegidoEnOtra = elegidosPorTarjeta.some((set, j) => j !== i && set.has(chip.dataset.id));
      chip.disabled = elegidoEnOtra && !chip.classList.contains('on');
    });
  });
}

function mostrarMensajeCrear(texto, tipo){
  const el = document.getElementById('mensaje-crear');
  el.textContent = texto;
  el.className = `mensaje ${tipo}`;
  el.hidden = false;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function leerParticipantesFormulario(){
  const modo = document.getElementById('tn-modo').value;

  if(modo === 'individual'){
    const selects = Array.from(document.querySelectorAll('.tn-part-jugador'));
    const ids = selects.map(s => s.value);
    if(ids.some(id => !id)) return { error: 'Elegí un jugador en cada casillero.' };
    if(new Set(ids).size !== ids.length) return { error: 'Un mismo jugador no puede estar dos veces.' };
    return {
      participantes: ids.map((id, i) => ({
        id: `p${i}`,
        nombre: jugadoresPorId[id] ? jugadoresPorId[id].nombre : id,
        jugadores: [id],
      })),
    };
  }

  const tarjetas = Array.from(document.querySelectorAll('.tn-equipo-card'));
  const equipos = tarjetas.map(t => ({
    nombre: t.querySelector('.tn-equipo-nombre').value.trim(),
    jugadores: Array.from(t.querySelectorAll('.tn-chip-jugador.on')).map(c => c.dataset.id),
  }));
  if(equipos.some(e => !e.nombre)) return { error: 'Ponele nombre a todos los equipos.' };
  if(equipos.some(e => e.jugadores.length === 0)) return { error: 'Cada equipo necesita al menos un jugador.' };

  return {
    participantes: equipos.map((e, i) => ({ id: `p${i}`, nombre: e.nombre, jugadores: e.jugadores })),
  };
}

function manejarCrearTorneo(ev){
  ev.preventDefault();

  const nombre = document.getElementById('tn-nombre').value.trim();
  const fecha = document.getElementById('tn-fecha').value;
  const modo = document.getElementById('tn-modo').value;
  if(!nombre || !fecha){
    mostrarMensajeCrear('Faltan el nombre o la fecha.', 'error');
    return;
  }

  const lectura = leerParticipantesFormulario();
  if(lectura.error){
    mostrarMensajeCrear(lectura.error, 'error');
    return;
  }

  let base = slugifyTn(nombre);
  let id = base;
  let sufijo = 2;
  const idsExistentes = new Set([...torneosBorrador, ...torneosCommiteados].map(t => t.id));
  while(idsExistentes.has(id)){
    id = `${base}-${sufijo}`;
    sufijo++;
  }

  const { rondas, tercerPuesto } = armarBracketInicial(lectura.participantes);
  const torneo = {
    id, nombre, fecha, modo,
    participantes: lectura.participantes,
    rondas, tercerPuesto,
    cerrado: false,
  };

  // Todavía no se toca el Worker/GitHub acá: el torneo se arma y se juega
  // por completo en este navegador (localStorage), y recién sube al repo
  // con un único commit cuando se toca "Finalizar torneo" más abajo.
  torneosBorrador.push(torneo);
  guardarBorradoresTorneos();
  poblarSelectTorneos();

  mostrarMensajeCrear(`✓ Torneo "${nombre}" armado acá en tu navegador. Anotá los resultados abajo — recién se sube al sitio cuando toques "Finalizar torneo".`, 'ok');
  document.getElementById('form-crear-torneo').reset();
  regenerarParticipantesUI();

  // Abre directo el editor de resultados de este torneo recién creado, sin
  // que haga falta elegirlo del desplegable de "Cargar resultados".
  const selectResultados = document.getElementById('te-select');
  selectResultados.value = torneo.id;
  selectResultados.dispatchEvent(new Event('change', { bubbles: true }));
  document.getElementById('te-zona').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- Cargar resultados ----------

function poblarSelectTorneos(){
  const select = document.getElementById('te-select');
  const valorPrevio = select.value;

  const grupos = [];
  if(torneosBorrador.length){
    grupos.push(`<optgroup label="En curso (sin publicar todavía)">${
      torneosBorrador.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('')
    }</optgroup>`);
  }
  if(torneosCommiteados.length){
    grupos.push(`<optgroup label="Publicados">${
      torneosCommiteados.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('')
    }</optgroup>`);
  }

  select.innerHTML = '<option value="">Elegí un torneo...</option>' + grupos.join('');
  if([...torneosBorrador, ...torneosCommiteados].some(t => t.id === valorPrevio)) select.value = valorPrevio;
}

function mostrarMensajeEditar(texto, tipo){
  const el = document.getElementById('mensaje-editar');
  el.textContent = texto;
  el.className = `mensaje ${tipo}`;
  el.hidden = false;
}

function renderTorneoEnEdicion(torneo){
  const estado = torneo.cerrado ? ' · 🔒 Publicado y cerrado' : ' · 📝 Sin publicar (solo en este navegador)';
  document.getElementById('te-meta').textContent =
    `${formatFecha(torneo.fecha)} · ${torneo.modo === 'equipos' ? 'Por equipos' : 'Individual'}${estado}`;

  const podioWrap = document.getElementById('te-podio-wrap');
  const podioHtml = renderPodioTorneoHtml(torneo, jugadoresPorId, { prefijoImg: '../' });
  const btnFinalizar = document.getElementById('btn-finalizar-torneo');
  const avisoCerrado = document.getElementById('te-cerrado-aviso');

  if(podioHtml){
    document.getElementById('te-podio').innerHTML = podioHtml;
    podioWrap.hidden = false;
  }else{
    podioWrap.hidden = true;
  }

  if(torneo.cerrado){
    btnFinalizar.hidden = true;
    document.getElementById('te-cerrado-link').href = `../torneos.html?id=${encodeURIComponent(torneo.id)}`;
    avisoCerrado.hidden = false;
  }else{
    avisoCerrado.hidden = true;
    // Solo se puede finalizar cuando ya están decididos todos los puestos
    // del podio (final + 3er puesto) — mientras se juega, se puede seguir
    // corrigiendo cualquier resultado sin restricción.
    btnFinalizar.hidden = !torneoListoParaCerrar(torneo);
  }

  document.getElementById('te-bracket').innerHTML =
    renderBracketTorneoHtml(torneo, jugadoresPorId, { interactivo: true, cerrado: !!torneo.cerrado, prefijoImg: '../' });
}

function initCargaResultados(){
  poblarSelectTorneos();

  let torneoActual = null;

  document.getElementById('te-select').addEventListener('change', (ev) => {
    const id = ev.target.value;
    document.getElementById('mensaje-editar').hidden = true;
    if(!id){
      document.getElementById('te-zona').hidden = true;
      torneoActual = null;
      return;
    }
    torneoActual = torneosBorrador.find(t => t.id === id) || torneosCommiteados.find(t => t.id === id);
    document.getElementById('te-zona').hidden = false;
    renderTorneoEnEdicion(torneoActual);
  });

  // Cada click de resultado solo toca localStorage — nunca la red — así
  // corregir varias veces seguidas no dispara pedidos en paralelo ni hace
  // un commit por click. Solo un torneo ya publicado (cerrado) deja de
  // tener botones clickeables, así que esto nunca corre sobre uno de esos.
  document.getElementById('te-bracket').addEventListener('click', (ev) => {
    const boton = ev.target.closest('.tny-clickeable');
    if(!boton || !torneoActual) return;

    const rondaIdx = Number(boton.dataset.ronda);
    const matchIdx = Number(boton.dataset.match);
    const participanteId = boton.dataset.participante;

    if(rondaIdx === -1){
      elegirGanadorTercerPuestoTorneo(torneoActual, participanteId);
    }else{
      elegirGanadorTorneo(torneoActual, rondaIdx, matchIdx, participanteId);
    }

    renderTorneoEnEdicion(torneoActual);
    guardarBorradoresTorneos();
  });

  // Único momento en que un torneo toca el Worker/GitHub: acá se manda de
  // una sola vez, ya completo y cerrado, en un solo commit.
  document.getElementById('btn-finalizar-torneo').addEventListener('click', async () => {
    if(!torneoActual || !torneoListoParaCerrar(torneoActual)) return;
    if(!confirm(`¿Finalizar "${torneoActual.nombre}"? Se sube al sitio y ya no se va a poder modificar.`)) return;

    torneoActual.cerrado = true;

    const btn = document.getElementById('btn-finalizar-torneo');
    btn.disabled = true;
    mostrarMensajeEditar('Subiendo torneo...', '');

    try{
      await guardarEnBackend({ accion: 'crear_torneo', torneo: torneoActual }, { endpointLocal: '/api/crear-torneo' });
      torneosBorrador = torneosBorrador.filter(t => t.id !== torneoActual.id);
      guardarBorradoresTorneos();
      torneosCommiteados.push(torneoActual);
      document.getElementById('mensaje-editar').hidden = true;
      poblarSelectTorneos();
      renderTorneoEnEdicion(torneoActual);
    }catch(err){
      torneoActual.cerrado = false;
      const pista = esModoLocal() ? ' ¿Está corriendo herramientas/servidor.py?' : '';
      mostrarMensajeEditar(`No se pudo finalizar: ${err.message}.${pista}`, 'error');
      renderTorneoEnEdicion(torneoActual);
    }finally{
      btn.disabled = false;
    }
  });

  document.getElementById('btn-eliminar-torneo').addEventListener('click', async () => {
    if(!torneoActual) return;
    if(!confirm(`¿Eliminar el torneo "${torneoActual.nombre}"? Esto no se puede deshacer.`)) return;

    const esBorrador = torneosBorrador.some(t => t.id === torneoActual.id);

    if(esBorrador){
      torneosBorrador = torneosBorrador.filter(t => t.id !== torneoActual.id);
      guardarBorradoresTorneos();
      torneoActual = null;
      document.getElementById('te-zona').hidden = true;
      poblarSelectTorneos();
      return;
    }

    try{
      await guardarEnBackend({ accion: 'eliminar_torneo', id: torneoActual.id }, { endpointLocal: '/api/eliminar-torneo' });
      torneosCommiteados = torneosCommiteados.filter(t => t.id !== torneoActual.id);
      torneoActual = null;
      document.getElementById('te-zona').hidden = true;
      poblarSelectTorneos();
    }catch(err){
      const pista = esModoLocal() ? ' ¿Está corriendo herramientas/servidor.py?' : '';
      mostrarMensajeEditar(`No se pudo eliminar: ${err.message}.${pista}`, 'error');
    }
  });
}

(async function init(){
  await cargarDatosIniciales();

  initConfigProxy();
  actualizarIndicadorModo();
  initAltaJugador();

  document.getElementById('tn-modo').addEventListener('change', regenerarParticipantesUI);
  document.getElementById('tn-cantidad').addEventListener('change', regenerarParticipantesUI);
  document.getElementById('form-crear-torneo').addEventListener('submit', manejarCrearTorneo);
  regenerarParticipantesUI();

  initCargaResultados();

  const hoy = new Date();
  const iso = new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  document.getElementById('tn-fecha').value = iso;
})();
