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
  "master yi": "MasterYi",
  "miss fortune": "MissFortune",
  "twisted fate": "TwistedFate",
  "tahm kench": "TahmKench",
  "jarvan iv": "JarvanIV",
  "xin zhao": "XinZhao",
  "renata glasc": "Renata", "renata": "Renata",
  "nunu & willump": "Nunu", "nunu": "Nunu",
  "lee sin": "LeeSin",
  "aurelion sol": "AurelionSol",
};

// Íconos "clásicos": fijamos una versión vieja (parche 4.20, fin de Season 4 /
// noviembre 2014) para el look old-school. Los campeones lanzados después de
// esa fecha no existen ahí, así que hay un segundo intento con la versión
// actual antes de caer en las iniciales — ver avatarHtml() más abajo.
const DDRAGON_VERSION_CLASICA = '4.20.2';
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

function champIconUrl(nombre, version){
  const key = champKey(nombre);
  if(!key) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${key}.png`;
}

function iniciales(nombre){
  return (nombre || '?').trim().slice(0,2).toUpperCase();
}

// Arma el <img> del campeón con fallback en cascada: ícono clásico (2014) ->
// ícono actual (por si el campeón es más nuevo que esa versión) -> iniciales.
function avatarHtml(nombreJugador, campeon){
  const clasica = champIconUrl(campeon, DDRAGON_VERSION_CLASICA);
  const inic = iniciales(nombreJugador);
  if(!clasica){
    return `<div class="jugador-avatar-fallback">${inic}</div>`;
  }
  const actual = champIconUrl(campeon, DDRAGON_VERSION_ACTUAL);
  return `<img class="jugador-avatar" src="${clasica}" alt="${campeon || ''}" data-actual="${actual}" data-iniciales="${inic}" onerror="manejarErrorAvatar(this)">`;
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

function formatFecha(iso){
  try{
    const [y,m,d] = iso.split('-').map(Number);
    const fecha = new Date(y, m-1, d);
    return fecha.toLocaleDateString('es-AR', { day:'numeric', month:'long', year:'numeric' });
  }catch(e){ return iso; }
}
