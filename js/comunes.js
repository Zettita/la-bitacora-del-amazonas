// Cosas compartidas entre la crónica (js/app.js) y las herramientas de
// carga/eliminación: catálogo de premios, mapeo de nombres de campeón a
// íconos, e iniciales de respaldo.

const PREMIOS_INFO = {
  mvp:       { label: 'MVP',       icono: '🏆' },
  killer:    { label: 'Killer',    icono: '🗡️' },
  ayudante:  { label: 'Ayudante',  icono: '🤝' },
  goblin:    { label: 'Goblin',    icono: '💰' },
  centinela: { label: 'Centinela', icono: '👁️' },
  granjero:  { label: 'Granjero',  icono: '🌾' },
  ancla:     { label: 'Ancla',     icono: '⚓' },
  feeder:    { label: 'Feeder',    icono: '💀' },
};

// Objeto {killer:0, ayudante:0, ...} listo para acumular conteos — todo lo
// que arranca un contador de premios en cero parte de acá, así al agregar o
// sacar un premio del catálogo no hay que tocar cada lugar que lo usa.
function premiosEnCero(){
  return Object.fromEntries(Object.keys(PREMIOS_INFO).map(k => [k, 0]));
}

// ---------- Cálculo de premios de una partida ----------
// Compartido entre herramientas/cargar.js (carga) y herramientas/eliminar.js
// (edición de una partida ya guardada) — ambos arman filas con las mismas
// clases (.j-select, .j-k, .j-d, .j-a, .j-cs, .j-oro, .j-vision) así que la
// misma lógica de cálculo sirve para las dos pantallas.

// Ratio tipo KDA clásico ((kills+asistencias)/muertes) que decide MVP (el
// más alto) y Ancla (el más bajo). Terminar sin morir ni una vez es "KDA
// Perfecto" — como en el cliente de LoL, op.gg, u.gg, etc., donde no se
// calcula como un número (dividir por cero no da un ratio real) sino que
// vale más que cualquier partida con muertes. Por eso un 0 en muertes usa
// una base bien alta (por encima de cualquier ratio real posible) más los
// kills+asistencias, para poder seguir desempatando entre varias partidas
// "Perfectas" de la misma noche por quién aportó más.
const BASE_KDA_PERFECTO = 1000;
function ratioKda(fila){
  const k = Number(fila.querySelector('.j-k').value) || 0;
  const d = Number(fila.querySelector('.j-d').value) || 0;
  const a = Number(fila.querySelector('.j-a').value) || 0;
  return d === 0 ? BASE_KDA_PERFECTO + k + a : (k + a) / d;
}

// Una fila "cuenta" para MVP/Ancla solo si tiene algo cargado de K/D/A —
// si está en blanco (nadie tipeó nada) no es una partida "perfecta", es
// simplemente un dato que falta, y no debería competir por ninguno de los
// dos premios.
function tieneStatsDeCombate(fila){
  const k = Number(fila.querySelector('.j-k').value) || 0;
  const d = Number(fila.querySelector('.j-d').value) || 0;
  const a = Number(fila.querySelector('.j-a').value) || 0;
  return k > 0 || d > 0 || a > 0;
}

// Cómo se calcula cada premio: `valor` da el número a comparar entre las
// filas de la partida, `mejor` dice si gana el más alto o el más bajo, y
// `elegible` (opcional) filtra qué filas entran en la comparación.
const CRITERIOS_PREMIO = {
  mvp:       { valor: ratioKda, mejor: 'max', elegible: tieneStatsDeCombate },
  killer:    { valor: fila => Number(fila.querySelector('.j-k').value) || 0, mejor: 'max' },
  ayudante:  { valor: fila => Number(fila.querySelector('.j-a').value) || 0, mejor: 'max' },
  goblin:    { valor: fila => Number(fila.querySelector('.j-oro').value) || 0, mejor: 'max' },
  centinela: { valor: fila => Number(fila.querySelector('.j-vision').value) || 0, mejor: 'max' },
  granjero:  { valor: fila => Number(fila.querySelector('.j-cs').value) || 0, mejor: 'max' },
  ancla:     { valor: ratioKda, mejor: 'min', elegible: tieneStatsDeCombate },
  feeder:    { valor: fila => Number(fila.querySelector('.j-d').value) || 0, mejor: 'max' },
};

// Premios 100% automáticos: para cada uno, el/los jugador/es con el mejor
// valor de su criterio en ESA partida se lo llevan (empate incluido, se lo
// llevan todos). Si nadie cargó nada para un premio de "el más alto gana"
// (máximo en 0), o si ninguna fila es elegible, esa partida no lo otorga.
// No dependen de otras partidas ni de otras sesiones — solo de las filas
// cargadas acá.
//
// Con un solo jugador cargado no hay con quién comparar, así que esa
// partida no reparte ningún premio (aunque sus stats sí cuentan para el
// perfil, como cualquier partida). Hace falta un mínimo de 2.
const MIN_JUGADORES_PARA_PREMIOS = 2;

function calcularPremiosDePartida(bloque, filas){
  filas = filas || Array.from(bloque.querySelectorAll('.v3-fila-jugador'));
  const premiosPorFila = filas.map(() => []);

  const cantidadJugadores = filas.filter(fila => fila.querySelector('.j-select').value).length;
  if(cantidadJugadores < MIN_JUGADORES_PARA_PREMIOS) return premiosPorFila;

  Object.keys(PREMIOS_INFO).forEach(key => {
    const criterio = CRITERIOS_PREMIO[key];
    if(!criterio) return;

    const indicesElegibles = filas
      .map((_, i) => i)
      .filter(i => !criterio.elegible || criterio.elegible(filas[i]));
    if(!indicesElegibles.length) return;

    const valores = indicesElegibles.map(i => criterio.valor(filas[i]));
    const objetivo = criterio.mejor === 'min' ? Math.min(...valores) : Math.max(...valores);
    if(criterio.mejor === 'max' && objetivo <= 0) return;

    indicesElegibles.forEach((i, idx) => { if(valores[idx] === objetivo) premiosPorFila[i].push(key); });
  });

  return premiosPorFila;
}

// Repinta la celda de premios de cada fila de la partida según los datos
// actuales — se llama en cada tipeo de K/D/A/CS/Oro/Visión y al agregar o
// quitar un jugador de la partida.
function actualizarPremiosVisualesPartida(bloque){
  const filas = Array.from(bloque.querySelectorAll('.v3-fila-jugador'));
  const premiosPorFila = calcularPremiosDePartida(bloque, filas);

  filas.forEach((fila, i) => {
    const celda = fila.querySelector('.v3-premios-cell');
    celda.innerHTML = premiosPorFila[i].length
      ? premiosPorFila[i].map(key => `<span class="mini-premio-auto" title="${PREMIOS_INFO[key].label}">${PREMIOS_INFO[key].icono}</span>`).join('')
      : '<span class="mini-premio-vacio">—</span>';
  });
}

const CAMPEON_ESPECIALES = {
  "wukong": "MonkeyKing", "kaisa": "Kaisa", "kai'sa": "Kaisa",
  "khazix": "Khazix", "kha'zix": "Khazix",
  "velkoz": "Velkoz", "vel'koz": "Velkoz",
  "chogath": "Chogath", "cho'gath": "Chogath",
  "reksai": "RekSai", "rek'sai": "RekSai",
  "kogmaw": "KogMaw", "kog'maw": "KogMaw",
  "belveth": "Belveth", "bel'veth": "Belveth",
  "ksante": "KSante", "k'sante": "KSante",
  "leblanc": "Leblanc",
  "dr. mundo": "DrMundo", "dr mundo": "DrMundo",
  "master yi": "MasterYi", "maestro yi": "MasterYi",
  "miss fortune": "MissFortune",
  "twisted fate": "TwistedFate",
  "tahm kench": "TahmKench",
  "jarvan iv": "JarvanIV",
  "xin zhao": "XinZhao",
  "renata glasc": "Renata", "renata": "Renata",
  "nunu & willump": "Nunu", "nunu y willump": "Nunu", "nunu": "Nunu",
  "lee sin": "LeeSin",
  "aurelion sol": "AurelionSol",
};

// Íconos "clásicos": Riot relanzó los 60 campeones originales del juego en
// el modo "LoL Classic" (https://www.leagueoflegends.com/es-es/classic/champions/),
// cada uno con su propio tile cuadrado (reskin "Jade"). Usamos esos mismos
// tiles como ícono — es el modo que juega el grupo, así que en teoría todo
// campeón que se cargue va a estar ahí. El número junto al nombre es el id
// de esa skin "Jade" particular (no es igual para todos).
const JADE_CLASSIC_TILE = {
  Ahri: 301, Alistar: 301, Amumu: 0, Anivia: 0, Annie: 301, Ashe: 0,
  Blitzcrank: 0, Brand: 0, Chogath: 0, Corki: 0, DrMundo: 301, Evelynn: 301,
  Ezreal: 301, Fiddlesticks: 301, Gangplank: 301, Garen: 301, Gragas: 0,
  Heimerdinger: 301, Janna: 0, JarvanIV: 0, Jax: 301, Karthus: 301,
  Kassadin: 301, Katarina: 301, Kayle: 0, KogMaw: 0, LeeSin: 301, Leona: 0,
  Lulu: 0, Lux: 0, MasterYi: 301, Malphite: 0, Malzahar: 0, MissFortune: 0,
  Morgana: 301, Nasus: 301, Nidalee: 301, Nunu: 301, Olaf: 0, Pantheon: 301,
  Rammus: 0, Ryze: 301, Shaco: 0, Singed: 0, Sion: 301, Sivir: 0,
  Skarner: 301, Sona: 0, Soraka: 301, Taric: 301, Teemo: 301, Tristana: 301,
  Tryndamere: 0, TwistedFate: 301, Twitch: 301, Vayne: 0, Veigar: 0,
  Warwick: 301, MonkeyKing: 0, Zilean: 0,
};

// El archivo del tile de Wukong se llama "Wukong", pero champKey() lo
// resuelve a "MonkeyKing" (la clave real que usa Data Dragon para ese
// campeón en todos los demás endpoints).
const JADE_CLASSIC_ARCHIVO = { MonkeyKing: 'Wukong' };

// Nombres "lindos" (como se escriben en el juego, en español) de los mismos
// 60 campeones de JADE_CLASSIC_TILE — para armar el buscador de campeón en
// el formulario de carga (ver herramientas/cargar.js).
const CAMPEONES_CLASICOS = [
  'Ahri', 'Alistar', 'Amumu', 'Anivia', 'Annie', 'Ashe', 'Blitzcrank',
  'Brand', "Cho'Gath", 'Corki', 'Dr. Mundo', 'Evelynn', 'Ezreal',
  'Fiddlesticks', 'Gangplank', 'Garen', 'Gragas', 'Heimerdinger', 'Janna',
  'Jarvan IV', 'Jax', 'Karthus', 'Kassadin', 'Katarina', 'Kayle', "Kog'Maw",
  'Lee Sin', 'Leona', 'Lulu', 'Lux', 'Maestro Yi', 'Malphite', 'Malzahar',
  'Miss Fortune', 'Morgana', 'Nasus', 'Nidalee', 'Nunu y Willump', 'Olaf',
  'Pantheon', 'Rammus', 'Ryze', 'Shaco', 'Singed', 'Sion', 'Sivir',
  'Skarner', 'Sona', 'Soraka', 'Taric', 'Teemo', 'Tristana', 'Tryndamere',
  'Twisted Fate', 'Twitch', 'Vayne', 'Veigar', 'Warwick', 'Wukong', 'Zilean',
];

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
// opción completa el campo. Usado en herramientas/cargar.js (carga) y
// herramientas/eliminar.js (edición de una partida ya guardada).
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

let DDRAGON_VERSION_ACTUAL = '14.23.1';
fetch('https://ddragon.leagueoflegends.com/api/versions.json')
  .then(r => r.json())
  .then(v => { if(Array.isArray(v) && v[0]) DDRAGON_VERSION_ACTUAL = v[0]; })
  .catch(() => {});

function champKey(nombre){
  if(!nombre) return null;
  const limpio = nombre.trim().toLowerCase();
  if(CAMPEON_ESPECIALES[limpio]) return CAMPEON_ESPECIALES[limpio];
  return nombre.trim().split(/[\s'".]+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

function classicTileUrl(nombre){
  const key = champKey(nombre);
  if(!key || !(key in JADE_CLASSIC_TILE)) return null;
  const archivo = JADE_CLASSIC_ARCHIVO[key] || key;
  return `https://ddragon.leagueoflegends.com/cdn/img/mode/classic/champion/tiles/Jade_${archivo}_${JADE_CLASSIC_TILE[key]}.jpg`;
}

// Splash art grande del mismo skin "Jade" de LoL Classic, recortado
// "centered" (el personaje queda centrado en el cuadro en vez de corrido
// a un costado) — para usar como fondo de pantalla o de carta.
function classicSplashUrl(nombre){
  const key = champKey(nombre);
  if(!key || !(key in JADE_CLASSIC_TILE)) return null;
  const archivo = JADE_CLASSIC_ARCHIVO[key] || key;
  return `https://ddragon.leagueoflegends.com/cdn/img/mode/classic/champion/centered/Jade_${archivo}_${JADE_CLASSIC_TILE[key]}.jpg`;
}

function champIconUrl(nombre, version){
  const key = champKey(nombre);
  if(!key) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${key}.png`;
}

// Splash art (imagen grande, skin base) de un campeón — para usar como
// fondo, no como ícono. No depende de la versión de Data Dragon.
function champSplashUrl(nombre){
  const key = champKey(nombre);
  if(!key) return null;
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${key}_0.jpg`;
}

function iniciales(nombre){
  return (nombre || '?').trim().slice(0,2).toUpperCase();
}

// Arma el <img> del campeón con fallback en cascada: tile de LoL Classic ->
// ícono actual (por si el campeón todavía no está en ese modo) -> iniciales.
function avatarHtml(nombreJugador, campeon){
  const key = champKey(campeon);
  const inic = iniciales(nombreJugador);
  if(!key){
    return `<div class="jugador-avatar-fallback">${inic}</div>`;
  }
  const actual = champIconUrl(campeon, DDRAGON_VERSION_ACTUAL);
  const principal = classicTileUrl(campeon) || actual;
  return `<img class="jugador-avatar" src="${principal}" alt="${campeon || ''}" data-actual="${actual}" data-iniciales="${inic}" onerror="manejarErrorAvatar(this)">`;
}

function manejarErrorAvatar(img){
  if(!img.dataset.intento){
    img.dataset.intento = '1';
    img.src = img.dataset.actual;
    return;
  }
  const div = document.createElement('div');
  div.className = 'jugador-avatar-fallback';
  div.textContent = img.dataset.iniciales;
  img.replaceWith(div);
}

// Menú hamburguesa del nav fijo en pantallas chicas (ver @media en css/style.css)
(function initNavMovil(){
  const burger = document.querySelector('.nav-burger');
  const links = document.querySelector('.nav-links');
  if(!burger || !links) return;
  burger.addEventListener('click', () => {
    const abierto = links.classList.toggle('abierto');
    burger.setAttribute('aria-expanded', abierto ? 'true' : 'false');
  });
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    links.classList.remove('abierto');
    burger.setAttribute('aria-expanded', 'false');
  }));
})();

// Redimensiona/comprime una foto elegida del disco a un JPEG chico (lado
// mayor = maxDim) antes de mandarla, para no pesar el repo aunque suban una
// foto de varios MB de un celular. Usada por la alta rápida de jugador, que
// vive tanto en herramientas/cargar.js como en herramientas/torneo.js.
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

function formatFecha(iso){
  try{
    const [y,m,d] = iso.split('-').map(Number);
    const fecha = new Date(y, m-1, d);
    return fecha.toLocaleDateString('es-AR', { day:'numeric', month:'long', year:'numeric' });
  }catch(e){ return iso; }
}

// ---------- Torneos: armado del bracket, avance de ganadores y render ----------
// Compartido entre herramientas/torneo.js (armar/editar) y js/torneos.js
// (mostrar en la web publicada), para no duplicar la lógica del cuadro.

// A partir de la lista de participantes (ya en el orden en que se van a
// emparejar) arma la ronda inicial y deja las rondas siguientes como
// casilleros vacíos hasta llegar a la final. `cantidad` siempre es potencia
// de 2 (4, 8 o 16), así que no hace falta contemplar "byes".
function armarBracketInicial(participantes){
  const ronda0 = [];
  for(let i = 0; i < participantes.length; i += 2){
    ronda0.push({ a: participantes[i].id, b: participantes[i + 1].id, ganador: null });
  }
  const rondas = [ronda0];
  let cantidadPartidos = ronda0.length / 2;
  while(cantidadPartidos >= 1){
    rondas.push(Array.from({ length: cantidadPartidos }, () => ({ a: null, b: null, ganador: null })));
    cantidadPartidos /= 2;
  }
  const tercerPuesto = participantes.length >= 4 ? { a: null, b: null, ganador: null } : null;
  return { rondas, tercerPuesto };
}

function participanteTorneoPorId(torneo, id){
  return (torneo.participantes || []).find(p => p.id === id) || null;
}

// Escribe un participante en un casillero de un partido. Si eso invalida al
// ganador que ya estaba anotado ahí (porque ya no es ninguno de los dos
// lados), lo deshace y sigue deshaciendo en cascada hacia las rondas
// siguientes que dependían de ese resultado.
function fijarCasilleroTorneo(torneo, rondaIdx, matchIdx, lado, participanteId){
  const ronda = torneo.rondas[rondaIdx];
  const match = ronda && ronda[matchIdx];
  if(!match || match[lado] === participanteId) return;
  match[lado] = participanteId;
  if(match.ganador && match.ganador !== match.a && match.ganador !== match.b){
    match.ganador = null;
    propagarGanadorTorneo(torneo, rondaIdx, matchIdx, null);
  }
}

function propagarGanadorTorneo(torneo, rondaIdx, matchIdx, ganadorId){
  const siguienteRondaIdx = rondaIdx + 1;
  if(!torneo.rondas[siguienteRondaIdx]) return;
  const lado = matchIdx % 2 === 0 ? 'a' : 'b';
  fijarCasilleroTorneo(torneo, siguienteRondaIdx, Math.floor(matchIdx / 2), lado, ganadorId);
}

// Los perdedores de las dos semifinales (la ronda anterior a la final) son
// quienes juegan el 3er puesto — se recalcula cada vez que se elige un
// ganador, por si corrigen una semifinal ya jugada.
function actualizarTercerPuestoTorneo(torneo){
  if(!torneo.tercerPuesto) return;
  const semis = torneo.rondas[torneo.rondas.length - 2];
  if(!semis) return;
  const perdedorDe = (m) => (m && m.ganador) ? (m.a === m.ganador ? m.b : m.a) : null;
  ['a', 'b'].forEach((lado, i) => {
    const nuevo = perdedorDe(semis[i]);
    const tp = torneo.tercerPuesto;
    if(tp[lado] !== nuevo){
      tp[lado] = nuevo;
      if(tp.ganador && tp.ganador !== tp.a && tp.ganador !== tp.b) tp.ganador = null;
    }
  });
}

function elegirGanadorTorneo(torneo, rondaIdx, matchIdx, ganadorId){
  const match = torneo.rondas[rondaIdx][matchIdx];
  if(match.a !== ganadorId && match.b !== ganadorId) return;
  match.ganador = ganadorId;
  propagarGanadorTorneo(torneo, rondaIdx, matchIdx, ganadorId);
  actualizarTercerPuestoTorneo(torneo);
}

function elegirGanadorTercerPuestoTorneo(torneo, ganadorId){
  const tp = torneo.tercerPuesto;
  if(!tp || (tp.a !== ganadorId && tp.b !== ganadorId)) return;
  tp.ganador = ganadorId;
}

function torneoTerminado(torneo){
  const final = torneo.rondas[torneo.rondas.length - 1][0];
  return !!(final && final.ganador);
}

// Todos los puestos del podio ya están decididos (final + 3er puesto, si
// corresponde) — recién ahí tiene sentido habilitar "Finalizar torneo".
function torneoListoParaCerrar(torneo){
  if(!torneoTerminado(torneo)) return false;
  return !torneo.tercerPuesto || !!torneo.tercerPuesto.ganador;
}

// Chips chiquitos con la foto (o iniciales) de cada jugador de un
// participante — un jugador solo si es individual, dos o más si es equipo.
function miniAvataresTorneoHtml(idsJugadores, jugadoresPorId, prefijoImg){
  return (idsJugadores || []).map(id => {
    const j = jugadoresPorId ? jugadoresPorId[id] : null;
    const nombre = j ? j.nombre : id;
    const contenido = (j && j.imagen)
      ? `<img src="${prefijoImg || ''}${j.imagen}" alt="${nombre}">`
      : iniciales(nombre);
    return `<span class="mini-avatar" title="${nombre}">${contenido}</span>`;
  }).join('');
}

function nombreRondaTorneo(totalRondas, idx){
  const desdeFinal = totalRondas - 1 - idx;
  if(desdeFinal === 0) return '🏆 Final';
  if(desdeFinal === 1) return 'Semifinal';
  if(desdeFinal === 2) return 'Cuartos de final';
  return `Ronda ${idx + 1}`;
}

function renderPartidoTorneoHtml(torneo, rondaIdx, matchIdx, match, jugadoresPorId, opts){
  const prefijo = (opts && opts.prefijoImg) || '';
  const interactivo = !!(opts && opts.interactivo) && !(opts && opts.cerrado);

  const lado = (participanteId) => {
    if(!participanteId){
      return `<div class="tny-lado tny-vacio">?</div>`;
    }
    const p = participanteTorneoPorId(torneo, participanteId);
    const nombre = p ? p.nombre : participanteId;
    const avatares = p ? miniAvataresTorneoHtml(p.jugadores, jugadoresPorId, prefijo) : '';
    const esGanador = match.ganador === participanteId;
    // Mientras el torneo no esté cerrado, se puede volver a tocar un
    // partido ya definido para corregir un error (elige otro ganador, y
    // eso deshace en cascada lo que ya había avanzado a partir de ahí).
    const puedeElegir = interactivo && match.a && match.b;
    const clases = ['tny-lado'];
    if(esGanador) clases.push('tny-ganador');
    if(puedeElegir) clases.push('tny-clickeable');
    if(puedeElegir){
      return `<button type="button" class="${clases.join(' ')}" data-ronda="${rondaIdx}" data-match="${matchIdx}" data-participante="${participanteId}">
        <span class="tny-avatares">${avatares}</span>
        <span class="tny-nombre">${nombre}</span>
      </button>`;
    }
    return `<div class="${clases.join(' ')}">
      <span class="tny-avatares">${avatares}</span>
      <span class="tny-nombre">${nombre}</span>
    </div>`;
  };

  return `<div class="tny-partido">${lado(match.a)}${lado(match.b)}</div>`;
}

function renderBracketTorneoHtml(torneo, jugadoresPorId, opts){
  const columnas = torneo.rondas.map((ronda, rondaIdx) => `
    <div class="tny-ronda">
      <div class="tny-ronda-titulo">${nombreRondaTorneo(torneo.rondas.length, rondaIdx)}</div>
      <div class="tny-partidos">
        ${ronda.map((m, matchIdx) => renderPartidoTorneoHtml(torneo, rondaIdx, matchIdx, m, jugadoresPorId, opts)).join('')}
      </div>
    </div>
  `).join('');

  const tercerPuestoHtml = torneo.tercerPuesto ? `
    <div class="tny-ronda tny-ronda-tercer">
      <div class="tny-ronda-titulo">🥉 3er puesto</div>
      <div class="tny-partidos">
        ${renderPartidoTorneoHtml(torneo, -1, 0, torneo.tercerPuesto, jugadoresPorId, opts)}
      </div>
    </div>
  ` : '';

  return `<div class="tny-bracket">${columnas}${tercerPuestoHtml}</div>`;
}

// El "escenario": 2do a la izquierda (más bajo), 1ro al centro (el más
// alto), 3ro a la derecha (el más bajo de todos) — el orden en el que se
// arma el HTML ya deja al 1ro en el medio, sin necesitar CSS `order`.
function renderPodioTorneoHtml(torneo, jugadoresPorId, opts){
  if(!torneoTerminado(torneo)) return '';
  const prefijo = (opts && opts.prefijoImg) || '';
  const final = torneo.rondas[torneo.rondas.length - 1][0];
  const primero = final.ganador;
  const segundo = final.a === primero ? final.b : final.a;
  const tercero = torneo.tercerPuesto ? torneo.tercerPuesto.ganador : null;

  const medalla = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const bloque = (participanteId, puesto) => {
    if(!participanteId) return '';
    const p = participanteTorneoPorId(torneo, participanteId);
    const nombre = p ? p.nombre : participanteId;
    const avatares = p ? miniAvataresTorneoHtml(p.jugadores, jugadoresPorId, prefijo) : '';
    return `
      <div class="podio-torneo-puesto podio-torneo-p${puesto}">
        <div class="podio-torneo-avatares">${avatares}</div>
        <div class="podio-torneo-nombre">${nombre}</div>
        <div class="podio-torneo-escalon">${medalla[puesto]}</div>
      </div>
    `;
  };

  return `
    <div class="podio-torneo">
      ${bloque(segundo, 2)}
      ${bloque(primero, 1)}
      ${tercero ? bloque(tercero, 3) : ''}
    </div>
  `;
}
