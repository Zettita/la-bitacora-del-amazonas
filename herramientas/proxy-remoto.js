// Guarda sesiones a traves de un Worker de Cloudflare que hace de
// intermediario seguro con GitHub (ver herramientas/cloudflare-worker.js).
//
// Quien carga partidas desde la web publicada NO necesita cuenta de GitHub
// ni ningun token: solo la URL del Worker y una clave de grupo compartida.
// El token real de GitHub vive unicamente como secreto dentro del Worker.

const PROXY_CONFIG_KEY = 'bitacora_proxy_config';

function proxyCargarConfig(){
  try{
    return JSON.parse(localStorage.getItem(PROXY_CONFIG_KEY)) || {};
  }catch(e){
    return {};
  }
}

function proxyGuardarConfig(cfg){
  localStorage.setItem(PROXY_CONFIG_KEY, JSON.stringify(cfg));
}

function proxyBorrarConfig(){
  localStorage.removeItem(PROXY_CONFIG_KEY);
}

function proxyConfigCompleta(cfg){
  return !!(cfg && cfg.url && cfg.clave);
}

async function guardarSesionProxy(cfg, payload){
  let resp;
  try{
    resp = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, clave: cfg.clave, autor: cfg.autor || '' }),
    });
  }catch(e){
    throw new Error('No se pudo contactar al servidor. Revisá la URL configurada.');
  }

  const data = await resp.json().catch(() => ({}));
  if(!resp.ok){
    if(resp.status === 401) throw new Error('Clave incorrecta.');
    throw new Error(data.error || `El servidor respondió ${resp.status}`);
  }
  return data;
}
