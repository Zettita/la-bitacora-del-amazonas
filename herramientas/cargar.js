let jugadoresRoster = [];
let destacadosRoster = [];
let contadorPartidas = 0;

const MAX_JUGADORES_POR_PARTIDA = 5;

const contenedorPartidas = document.getElementById('partidas-contenedor');
const tplPartida = document.getElementById('tpl-partida');
const tplJugadorCard = document.getElementById('tpl-jugador-card');
const tplDestacadoCard = document.getElementById('tpl-destacado-card');

function normalizarTexto(s){
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/gi, '').toLowerCase();
}

// Buscador de campeón: al enfocar o escribir muestra los 60 campeones de
// LoL Classic (con su ícono) filtrados por lo tipeado; un click en una
// opción completa el campo.
function initCampeonPicker(raiz){
  const input = raiz.querySelector('.j-campeon');
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

function idsUsadosEnPartida(bloque, tarjetaExcluida){
  const ids = new Set();
  bloque.querySelectorAll('.jugador-card').forEach(tarjeta => {
    if(tarjeta === tarjetaExcluida) return;
    const valor = tarjeta.querySelector('.j-select').value;
    if(valor && valor !== '__nuevo__') ids.add(valor);
  });
  return ids;
}

function poblarSelectJugador(select, idsUsados){
  const valorPrevio = select.value;
  select.innerHTML = '<option value="">Elegí un jugador...</option>';

  jugadoresRoster.forEach(j => {
    const opt = document.createElement('option');
    opt.value = j.id;
    opt.textContent = j.nombre;
    opt.disabled = idsUsados.has(j.id);
    select.appendChild(opt);
  });

  const optNuevo = document.createElement('option');
  optNuevo.value = '__nuevo__';
  optNuevo.textContent = '+ Nuevo jugador...';
  select.appendChild(optNuevo);

  select.value = valorPrevio || '';
}

function refrescarSelectsDePartida(bloque){
  bloque.querySelectorAll('.jugador-card').forEach(tarjeta => {
    const select = tarjeta.querySelector('.j-select');
    poblarSelectJugador(select, idsUsadosEnPartida(bloque, tarjeta));
  });
}

function actualizarBotonAgregar(bloque){
  const cant = bloque.querySelectorAll('.jugador-card').length;
  const btn = bloque.querySelector('.btn-agregar-jugador');
  btn.disabled = cant >= MAX_JUGADORES_POR_PARTIDA;
  btn.textContent = cant >= MAX_JUGADORES_POR_PARTIDA ? 'Máximo 5 jugadores' : '+ Agregar jugador';
}

function crearTarjetaJugador(bloque){
  const nodo = tplJugadorCard.content.cloneNode(true);
  const tarjeta = nodo.querySelector('.jugador-card');
  const select = tarjeta.querySelector('.j-select');
  const zonaNuevo = tarjeta.querySelector('.jc-nuevo-jugador');

  poblarSelectJugador(select, idsUsadosEnPartida(bloque, null));
  initCampeonPicker(tarjeta);

  const inputImagen = tarjeta.querySelector('.nj-imagen');
  const previewImagen = tarjeta.querySelector('.nj-imagen-preview');
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
      mostrarMensaje('No se pudo procesar esa imagen, probá con otra.', 'error');
      inputImagen.value = '';
    }
  });

  select.addEventListener('change', () => {
    zonaNuevo.hidden = select.value !== '__nuevo__';
    if(select.value && select.value !== '__nuevo__'){
      const jugador = jugadoresRoster.find(j => j.id === select.value);
      const rolSelect = tarjeta.querySelector('.j-rol');
      if(jugador && jugador.rolPreferido && !rolSelect.value) rolSelect.value = jugador.rolPreferido;
    }
    refrescarSelectsDePartida(bloque);
  });

  tarjeta.querySelector('.btn-quitar-jugador').addEventListener('click', () => {
    tarjeta.remove();
    refrescarSelectsDePartida(bloque);
    actualizarBotonAgregar(bloque);
  });

  return tarjeta;
}

function agregarTarjetaJugador(bloque){
  const contJugadores = bloque.querySelector('.jugadores-form');
  if(contJugadores.querySelectorAll('.jugador-card').length >= MAX_JUGADORES_POR_PARTIDA) return;
  contJugadores.appendChild(crearTarjetaJugador(bloque));
  actualizarBotonAgregar(bloque);
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
  const inputNombre = tarjeta.querySelector('.nd-nombre');

  poblarSelectDestacado(select, idsDestacadosUsados(bloque, null));

  select.addEventListener('change', () => {
    inputNombre.hidden = select.value !== '__nuevo__';
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

  bloque.querySelector('.btn-agregar-jugador').addEventListener('click', () => agregarTarjetaJugador(bloque));
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

  bloque.querySelectorAll('.jugador-card').forEach(tarjeta => {
    const select = tarjeta.querySelector('.j-select');
    let jugadorId, nuevoJugador;

    if(select.value === '__nuevo__'){
      const nombre = tarjeta.querySelector('.nj-nombre').value.trim();
      if(!nombre) return;
      jugadorId = slugify(nombre);
      nuevoJugador = { nombre };
      const rolPreferido = tarjeta.querySelector('.nj-rol-preferido').value;
      if(rolPreferido) nuevoJugador.rolPreferido = rolPreferido;
      const imagenDatos = tarjeta.querySelector('.nj-imagen').dataset.dataurl;
      if(imagenDatos) nuevoJugador.imagenDatos = imagenDatos;
    }else if(select.value){
      jugadorId = select.value;
    }else{
      return;
    }

    const premios = Array.from(tarjeta.querySelectorAll('.premio-check input:checked')).map(c => c.value);
    const k = tarjeta.querySelector('.j-k').value;
    const d = tarjeta.querySelector('.j-d').value;
    const a = tarjeta.querySelector('.j-a').value;

    const jugador = {
      jugador: jugadorId,
      campeon: tarjeta.querySelector('.j-campeon').value.trim(),
      rol: tarjeta.querySelector('.j-rol').value,
      kda: { k: Number(k)||0, d: Number(d)||0, a: Number(a)||0 },
      premios,
    };
    const comentario = tarjeta.querySelector('.j-comentario').value.trim();
    if(comentario) jugador.comentario = comentario;
    if(nuevoJugador) jugador.nuevo_jugador = nuevoJugador;

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

    const destacado = { destacado: destacadoId };
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

function hayTarjetaNuevaSinNombre(){
  const jugadorSinNombre = Array.from(document.querySelectorAll('.jugador-card')).some(tarjeta => {
    const select = tarjeta.querySelector('.j-select');
    return select.value === '__nuevo__' && !tarjeta.querySelector('.nj-nombre').value.trim();
  });
  const destacadoSinNombre = Array.from(document.querySelectorAll('.destacado-card')).some(tarjeta => {
    const select = tarjeta.querySelector('.d-select');
    return select.value === '__nuevo__' && !tarjeta.querySelector('.nd-nombre').value.trim();
  });
  return jugadorSinNombre || destacadoSinNombre;
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

  if(hayTarjetaNuevaSinNombre()){
    mostrarMensaje('Hay un jugador o personaje nuevo sin nombre completado — completalo o quitá esa tarjeta.', 'error');
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
  actualizarIndicadorModo();

  document.getElementById('btn-agregar-partida').addEventListener('click', agregarBloquePartida);
  document.getElementById('form-sesion').addEventListener('submit', manejarSubmit);

  const hoy = new Date();
  const iso = new Date(hoy.getTime() - hoy.getTimezoneOffset()*60000).toISOString().slice(0,10);
  document.getElementById('fecha').value = iso;
})();
