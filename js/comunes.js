// Cosas compartidas entre la crónica (js/app.js) y las herramientas de
// carga/eliminación: catálogo de premios, mapeo de nombres de campeón a
// íconos, e iniciales de respaldo.

const PREMIOS_INFO = {
  mvp:   { label: 'MVP',              icono: '🏆' },
  carry: { label: 'Se la cargó',      icono: '💪' },
  troll: { label: 'Trolleo',          icono: '🤡' },
  ancla: { label: 'Ancla',            icono: '⚓' },
};

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

function formatFecha(iso){
  try{
    const [y,m,d] = iso.split('-').map(Number);
    const fecha = new Date(y, m-1, d);
    return fecha.toLocaleDateString('es-AR', { day:'numeric', month:'long', year:'numeric' });
  }catch(e){ return iso; }
}
