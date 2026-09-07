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

let DDRAGON_VERSION = '14.23.1';
fetch('https://ddragon.leagueoflegends.com/api/versions.json')
  .then(r => r.json())
  .then(v => { if(Array.isArray(v) && v[0]) DDRAGON_VERSION = v[0]; })
  .catch(() => {});

function champKey(nombre){
  if(!nombre) return null;
  const limpio = nombre.trim().toLowerCase();
  if(CAMPEON_ESPECIALES[limpio]) return CAMPEON_ESPECIALES[limpio];
  return nombre.trim().split(/[\s'".]+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

function champIconUrl(nombre){
  const key = champKey(nombre);
  if(!key) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${key}.png`;
}

function iniciales(nombre){
  return (nombre || '?').trim().slice(0,2).toUpperCase();
}

function formatFecha(iso){
  try{
    const [y,m,d] = iso.split('-').map(Number);
    const fecha = new Date(y, m-1, d);
    return fecha.toLocaleDateString('es-AR', { day:'numeric', month:'long', year:'numeric' });
  }catch(e){ return iso; }
}
