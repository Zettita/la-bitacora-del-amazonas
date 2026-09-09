let jugadoresRoster = [];
let destacadosRoster = [];
let contadorPartidas = 0;

const MAX_JUGADORES_POR_PARTIDA = 5;

const contenedorPartidas = document.getElementById('partidas-contenedor');
const tplPartida = document.getElementById('tpl-partida');
const tplFilaJugador = document.getElementById('tpl-fila-jugador');
const tplDestacadoCard = document.getElementById('tpl-destacado-card');

function normalizarTexto(s){
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/gi, '').toLowerCase();
}

// El campo de campeón es de texto libre (para poder tipear campeones que
// todavía no están en LoL Classic), así que dos cargas del mismo campeón
// pueden quedar con distinta mayúscula/tilde ("Garen" vs "GAREN") y
// contarse como campeones distintos en las estadísticas. Si lo tipeado
// coincide (sin importar mayúsculas/tildes) con uno de la lista clásica,
// se guarda siempre con esa misma grafía oficial.
function normalizarNombreCampeon(texto){
  const valor = (texto || '').trim();
  if(!valor) return '';
  const norm = normalizarTexto(valor);
  const oficial = CAMPEONES_CLASICOS.find(c => normalizarTexto(c) === norm);
  return oficial || valor;
}

// Buscador de campeón: al enfocar o escribir muestra los 60 campeones de
// LoL Classic (con su ícono) filtrados por lo tipeado; un click en una
// opción completa el campo.
function initCampeonPicker(raiz, claseInput = 'j-campeon'){
  const input = raiz.querySelector(`.${claseInput}`);
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

// Redimensiona/comprime una foto elegida del disco a un JPEG chico (lado
// mayor = maxDim) antes de mandarla, para no pesar el repo aunque suban una
// foto de varios MB de un celular.
function comprimirImagen(archivo, maxDim = 200, calidad = 0.82){
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo procesar la imagen'));
      img.onload = () => {
        let { width, height } = img;
        if(width >= height){
          if(width > maxDim){ height = Math.round(height * maxDim / width); width = maxDim; }
        }else{
          if(height > maxDim){ width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', calidad));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

async function cargarRoster(){
  try{
    jugadoresRoster = await fetch('../data/players.json', { cache: 'no-store' }).then(r => r.json());
  }catch(e){
    jugadoresRoster = [];
  }
  try{
    destacadosRoster = await fetch('../data/destacados.json', { cache: 'no-store' }).then(r => r.json());
  }catch(e){
    destacadosRoster = [];
  }
}

function slugify(nombre){
  return nombre.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'jugador';
}

function idsUsadosEnPartida(bloque, filaExcluida){
  const ids = new Set();
  bloque.querySelectorAll('.v3-fila-jugador').forEach(fila => {
    if(fila === filaExcluida) return;
    const valor = fila.querySelector('.j-select').value;
    if(valor) ids.add(valor);
  });
  return ids;
}

function poblarSelectJugador(select, idsUsados){
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

function refrescarSelectsDePartida(bloque){
  bloque.querySelectorAll('.v3-fila-jugador').forEach(fila => {
    const select = fila.querySelector('.j-select');
    poblarSelectJugador(select, idsUsadosEnPartida(bloque, fila));
  });
}

function refrescarTodosLosSelects(){
  contenedorPartidas.querySelectorAll('.bloque-partida').forEach(bloque => refrescarSelectsDePartida(bloque));
  poblarSelectEliminar();
}

function actualizarBotonAgregar(bloque){
  const cant = bloque.querySelectorAll('.v3-fila-jugador').length;
  const btn = bloque.querySelector('.btn-agregar-jugador');
  btn.disabled = cant >= MAX_JUGADORES_POR_PARTIDA;
  btn.textContent = cant >= MAX_JUGADORES_POR_PARTIDA ? 'Máximo 5 jugadores' : '+ Agregar jugador';
}

// Foto de un jugador ya existente en el roster: se guarda al toque (no
// espera al submit de la sesión), porque es un dato del roster, no de la
// partida que se está cargando. `refs` son los elementos ya ubicados en el
// DOM (la fila del jugador y la fila de edición van en <tr> separados).
function initEditarFoto(refs){
  const { btnEditar, filaEditar, fotoActual, sinFoto, inputImagen, previewImagen, btnGuardar, estado, select } = refs;

  btnEditar.addEventListener('click', () => {
    filaEditar.hidden = !filaEditar.hidden;
    if(filaEditar.hidden) return;

    const jugador = jugadoresRoster.find(j => j.id === select.value);
    if(jugador && jugador.imagen){
      fotoActual.src = `../${jugador.imagen}`;
      fotoActual.hidden = false;
      sinFoto.hidden = true;
    }else{
      fotoActual.hidden = true;
      sinFoto.hidden = false;
    }
    inputImagen.value = '';
    delete inputImagen.dataset.dataurl;
    previewImagen.hidden = true;
    estado.textContent = '';
  });

  inputImagen.addEventListener('change', async () => {
    const archivo = inputImagen.files[0];
    delete inputImagen.dataset.dataurl;
    previewImagen.hidden = true;
    if(!archivo) return;
    try{
      const dataUrl = await comprimirImagen(archivo);
      inputImagen.dataset.dataurl = dataUrl;
      previewImagen.src = dataUrl;
      previewImagen.hidden = false;
    }catch(e){
      estado.textContent = 'No se pudo procesar esa imagen, probá con otra.';
      inputImagen.value = '';
    }
  });

  btnGuardar.addEventListener('click', async () => {
    const dataUrl = inputImagen.dataset.dataurl;
    if(!dataUrl){
      estado.textContent = 'Elegí una foto primero.';
      return;
    }
    const jugadorId = select.value;
    btnGuardar.disabled = true;
    estado.textContent = 'Guardando...';
    try{
      const data = await guardarEnBackend(
        { accion: 'editar_imagen_jugador', jugadorId, imagenDatos: dataUrl },
        { endpointLocal: '/api/editar-imagen-jugador' }
      );
      const jugador = jugadoresRoster.find(j => j.id === jugadorId);
      if(jugador) jugador.imagen = data.imagen;
      fotoActual.src = `../${data.imagen}?t=${Date.now()}`;
      fotoActual.hidden = false;
      sinFoto.hidden = true;
      previewImagen.hidden = true;
      inputImagen.value = '';
      delete inputImagen.dataset.dataurl;
      estado.textContent = '✓ Guardada';
    }catch(err){
      const pista = esModoLocal() ? ' ¿Está corriendo herramientas/servidor.py?' : '';
      estado.textContent = `Error: ${err.message}.${pista}`;
    }finally{
      btnGuardar.disabled = false;
    }
  });
}

// Crea la fila de un jugador dentro de la tabla de una partida (más la fila
// oculta de "editar foto" que la acompaña). Devuelve un fragmento con las
// dos <tr> listas para insertar juntas en el <tbody>.
function crearFilaJugador(bloque){
  const nodo = tplFilaJugador.content.cloneNode(true);
  const fila = nodo.querySelector('.v3-fila-jugador');
  const filaEditar = nodo.querySelector('.v3-fila-editar-foto');
  const select = fila.querySelector('.j-select');
  const btnEditarFoto = fila.querySelector('.btn-editar-foto');

  poblarSelectJugador(select, idsUsadosEnPartida(bloque, fila));
  initCampeonPicker(fila);
  initEditarFoto({
    btnEditar: btnEditarFoto,
    filaEditar,
    fotoActual: filaEditar.querySelector('.ef-foto-actual'),
    sinFoto: filaEditar.querySelector('.ef-sin-foto'),
    inputImagen: filaEditar.querySelector('.ef-imagen'),
    previewImagen: filaEditar.querySelector('.ef-imagen-preview'),
    btnGuardar: filaEditar.querySelector('.btn-guardar-foto'),
    estado: filaEditar.querySelector('.ef-estado'),
    select,
  });

  select.addEventListener('change', () => {
    const esExistente = !!select.value;
    btnEditarFoto.hidden = !esExistente;
    filaEditar.hidden = true;
    if(esExistente){
      const jugador = jugadoresRoster.find(j => j.id === select.value);
      const rolSelect = fila.querySelector('.j-rol');
      if(jugador && jugador.rolPreferido && !rolSelect.value) rolSelect.value = jugador.rolPreferido;
    }
    refrescarSelectsDePartida(bloque);
  });

  fila.querySelectorAll('.mini-premio').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('on'));
  });

  fila.querySelector('.btn-quitar-jugador').addEventListener('click', () => {
    fila.remove();
    filaEditar.remove();
    refrescarSelectsDePartida(bloque);
    actualizarBotonAgregar(bloque);
  });

  const frag = document.createDocumentFragment();
  frag.appendChild(fila);
  frag.appendChild(filaEditar);
  return frag;
}

function agregarFilaJugador(bloque){
  const tbody = bloque.querySelector('.jugadores-tbody');
  if(tbody.querySelectorAll('.v3-fila-jugador').length >= MAX_JUGADORES_POR_PARTIDA) return;
  tbody.appendChild(crearFilaJugador(bloque));
  actualizarBotonAgregar(bloque);
}

// ---------- Alta rápida de jugador (form aparte, no forma parte de la sesión) ----------

function mostrarEstadoAlta(texto, tipo){
  const el = document.getElementById('alta-jugador-estado');
  el.textContent = texto;
  el.className = 'estado-guardado' + (tipo ? ` ${tipo}` : '');
}

async function manejarAltaJugador(ev){
  ev.preventDefault();

  const inputNombre = document.getElementById('nj-nombre-rapida');
  const nombre = inputNombre.value.trim();
  if(!nombre){
    mostrarEstadoAlta('Escribí un nombre.', 'error');
    return;
  }
  const id = slugify(nombre);
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
    refrescarTodosLosSelects();

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

// ---------- Eliminar jugador del roster (form aparte, no toca sesiones) ----------

function poblarSelectEliminar(){
  const select = document.getElementById('elim-jugador-select');
  const valorPrevio = select.value;
  select.innerHTML = '<option value="" disabled selected>Elegí un jugador</option>';
  jugadoresRoster.forEach(j => {
    const opt = document.createElement('option');
    opt.value = j.id;
    opt.textContent = j.nombre;
    select.appendChild(opt);
  });
  if(jugadoresRoster.some(j => j.id === valorPrevio)) select.value = valorPrevio;
}

function mostrarEstadoEliminar(texto, tipo){
  const el = document.getElementById('eliminar-jugador-estado');
  el.textContent = texto;
  el.className = 'estado-guardado' + (tipo ? ` ${tipo}` : '');
}

async function manejarEliminarJugador(ev){
  ev.preventDefault();

  const select = document.getElementById('elim-jugador-select');
  const id = select.value;
  if(!id) return;

  const jugador = jugadoresRoster.find(j => j.id === id);
  const nombre = jugador ? jugador.nombre : id;
  if(!confirm(`¿Eliminar a ${nombre} del roster? Esto no se puede deshacer.`)) return;

  const btn = document.getElementById('btn-eliminar-jugador');
  btn.disabled = true;
  mostrarEstadoEliminar('Eliminando...', '');

  try{
    await guardarEnBackend({ accion: 'eliminar_jugador', id }, { endpointLocal: '/api/eliminar-jugador' });
    jugadoresRoster = jugadoresRoster.filter(j => j.id !== id);
    refrescarTodosLosSelects();
    mostrarEstadoEliminar(`✓ ${nombre} se sacó del roster.`, 'ok');
  }catch(err){
    const pista = esModoLocal() ? ' ¿Está corriendo herramientas/servidor.py?' : '';
    mostrarEstadoEliminar(`Error: ${err.message}.${pista}`, 'error');
  }finally{
    btn.disabled = false;
  }
}

function initEliminarJugador(){
  poblarSelectEliminar();
  document.getElementById('form-eliminar-jugador').addEventListener('submit', manejarEliminarJugador);
}

// ---------- Personajes destacados (gente ajena al grupo, no compañeros) ----------

function idsDestacadosUsados(bloque, tarjetaExcluida){
  const ids = new Set();
  bloque.querySelectorAll('.destacado-card').forEach(tarjeta => {
    if(tarjeta === tarjetaExcluida) return;
    const valor = tarjeta.querySelector('.d-select').value;
    if(valor && valor !== '__nuevo__') ids.add(valor);
  });
  return ids;
}

function poblarSelectDestacado(select, idsUsados){
  const valorPrevio = select.value;
  select.innerHTML = '<option value="">Elegí un personaje...</option>';

  destacadosRoster.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.nombre;
    opt.disabled = idsUsados.has(d.id);
    select.appendChild(opt);
  });

  const optNuevo = document.createElement('option');
  optNuevo.value = '__nuevo__';
  optNuevo.textContent = '+ Nuevo personaje...';
  select.appendChild(optNuevo);

  select.value = valorPrevio || '';
}

function refrescarSelectsDeDestacados(bloque){
  bloque.querySelectorAll('.destacado-card').forEach(tarjeta => {
    const select = tarjeta.querySelector('.d-select');
    poblarSelectDestacado(select, idsDestacadosUsados(bloque, tarjeta));
  });
}

function crearTarjetaDestacado(bloque){
  const nodo = tplDestacadoCard.content.cloneNode(true);
  const tarjeta = nodo.querySelector('.destacado-card');
  const select = tarjeta.querySelector('.d-select');
  const zonaNuevo = tarjeta.querySelector('.jc-nuevo-jugador');

  poblarSelectDestacado(select, idsDestacadosUsados(bloque, null));
  initCampeonPicker(tarjeta, 'd-campeon');

  select.addEventListener('change', () => {
    zonaNuevo.hidden = select.value !== '__nuevo__';
    refrescarSelectsDeDestacados(bloque);
  });

  tarjeta.querySelector('.btn-quitar-jugador').addEventListener('click', () => {
    tarjeta.remove();
    refrescarSelectsDeDestacados(bloque);
  });

  return tarjeta;
}

function agregarTarjetaDestacado(bloque){
  bloque.querySelector('.destacados-form').appendChild(crearTarjetaDestacado(bloque));
}

function agregarBloquePartida(){
  contadorPartidas++;
  const nodo = tplPartida.content.cloneNode(true);
  const bloque = nodo.querySelector('.bloque-partida');
  bloque.querySelector('.num-partida').textContent = contadorPartidas;

  bloque.querySelector('.btn-agregar-jugador').addEventListener('click', () => agregarFilaJugador(bloque));
  bloque.querySelector('.btn-agregar-destacado').addEventListener('click', () => agregarTarjetaDestacado(bloque));
  bloque.querySelector('.btn-quitar-partida').addEventListener('click', () => {
    bloque.remove();
    renumerarPartidas();
  });

  contenedorPartidas.appendChild(bloque);
  actualizarBotonAgregar(bloque);
}

function renumerarPartidas(){
  const bloques = contenedorPartidas.querySelectorAll('.bloque-partida');
  bloques.forEach((b, i) => { b.querySelector('.num-partida').textContent = i + 1; });
  contadorPartidas = bloques.length;
}

function leerJugadoresDePartida(bloque){
  const jugadores = [];

  bloque.querySelectorAll('.v3-fila-jugador').forEach(fila => {
    const jugadorId = fila.querySelector('.j-select').value;
    if(!jugadorId) return;

    const premios = Array.from(fila.querySelectorAll('.mini-premio.on')).map(el => el.dataset.premio);
    const k = fila.querySelector('.j-k').value;
    const d = fila.querySelector('.j-d').value;
    const a = fila.querySelector('.j-a').value;

    const jugador = {
      jugador: jugadorId,
      campeon: normalizarNombreCampeon(fila.querySelector('.j-campeon').value),
      rol: fila.querySelector('.j-rol').value,
      kda: { k: Number(k)||0, d: Number(d)||0, a: Number(a)||0 },
      premios,
    };
    const comentario = fila.querySelector('.j-comentario').value.trim();
    if(comentario) jugador.comentario = comentario;

    jugadores.push(jugador);
  });

  return jugadores;
}

function leerDestacadosDePartida(bloque){
  const destacados = [];

  bloque.querySelectorAll('.destacado-card').forEach(tarjeta => {
    const select = tarjeta.querySelector('.d-select');
    let destacadoId, nuevoDestacado;

    if(select.value === '__nuevo__'){
      const nombre = tarjeta.querySelector('.nd-nombre').value.trim();
      if(!nombre) return;
      destacadoId = slugify(nombre);
      nuevoDestacado = { nombre };
    }else if(select.value){
      destacadoId = select.value;
    }else{
      return;
    }

    const k = tarjeta.querySelector('.d-k').value;
    const d = tarjeta.querySelector('.d-d').value;
    const a = tarjeta.querySelector('.d-a').value;

    const destacado = {
      destacado: destacadoId,
      campeon: normalizarNombreCampeon(tarjeta.querySelector('.d-campeon').value),
      rol: tarjeta.querySelector('.d-rol').value,
      kda: { k: Number(k)||0, d: Number(d)||0, a: Number(a)||0 },
    };
    const comentario = tarjeta.querySelector('.d-comentario').value.trim();
    if(comentario) destacado.comentario = comentario;
    if(nuevoDestacado) destacado.nuevo_destacado = nuevoDestacado;

    destacados.push(destacado);
  });

  return destacados;
}

function leerPartidas(){
  return Array.from(contenedorPartidas.querySelectorAll('.bloque-partida')).map(bloque => {
    const partida = {
      resultado: bloque.querySelector('.p-resultado').value,
      duracion: bloque.querySelector('.p-duracion').value.trim(),
      jugadores: leerJugadoresDePartida(bloque),
    };
    const destacados = leerDestacadosDePartida(bloque);
    if(destacados.length) partida.destacados = destacados;
    return partida;
  });
}

function hayDestacadoNuevoSinNombre(){
  return Array.from(document.querySelectorAll('.destacado-card')).some(tarjeta => {
    const select = tarjeta.querySelector('.d-select');
    return select.value === '__nuevo__' && !tarjeta.querySelector('.nd-nombre').value.trim();
  });
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

  if(hayDestacadoNuevoSinNombre()){
    mostrarMensaje('Hay un personaje destacado nuevo sin nombre completado — completalo o quitá esa tarjeta.', 'error');
    return;
  }

  const partidas = leerPartidas();
  if(partidas.length === 0){
    mostrarMensaje('Agregá al menos una partida.', 'error');
    return;
  }
  const sinJugadores = partidas.some(p => p.jugadores.length === 0);
  if(sinJugadores){
    mostrarMensaje('Hay una partida sin jugadores cargados.', 'error');
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

    await cargarRoster();
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
  initAltaJugador();
  initEliminarJugador();
  actualizarIndicadorModo();

  document.getElementById('btn-agregar-partida').addEventListener('click', agregarBloquePartida);
  document.getElementById('form-sesion').addEventListener('submit', manejarSubmit);

  const hoy = new Date();
  const iso = new Date(hoy.getTime() - hoy.getTimezoneOffset()*60000).toISOString().slice(0,10);
  document.getElementById('fecha').value = iso;
})();
