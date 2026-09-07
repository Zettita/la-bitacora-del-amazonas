// Compartido entre cargar.html y eliminar.html: decide si guardar contra el
// servidor local (servidor.py) o contra el Worker de Cloudflare (usando la
// clave de grupo), y maneja el panel de "Conexión para guardar".
// Depende de las funciones de proxy-remoto.js (proxyCargarConfig, etc).

function esModoLocal(){
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

function actualizarIndicadorModo(){
  const el = document.getElementById('modo-actual');
  if(!el) return;
  if(esModoLocal()){
    el.textContent = '(modo local: servidor Python)';
    el.className = 'modo-actual local';
  }else{
    const cfg = proxyCargarConfig();
    el.textContent = proxyConfigCompleta(cfg) ? '(conectado)' : '(falta configurar la URL y la clave)';
    el.className = 'modo-actual github';
  }
}

function initConfigProxy(){
  const cfg = proxyCargarConfig();
  document.getElementById('proxy-url').value = cfg.url || '';
  document.getElementById('proxy-clave').value = cfg.clave || '';
  document.getElementById('proxy-autor').value = cfg.autor || '';

  if(!esModoLocal() && !proxyConfigCompleta(cfg)){
    document.getElementById('config-github').open = true;
  }

  document.getElementById('btn-guardar-config').addEventListener('click', () => {
    const nuevaCfg = {
      url: document.getElementById('proxy-url').value.trim(),
      clave: document.getElementById('proxy-clave').value.trim(),
      autor: document.getElementById('proxy-autor').value.trim(),
    };
    proxyGuardarConfig(nuevaCfg);
    document.getElementById('config-estado').textContent = 'Conexión guardada en este navegador.';
    actualizarIndicadorModo();
  });

  document.getElementById('btn-borrar-config').addEventListener('click', () => {
    proxyBorrarConfig();
    document.getElementById('proxy-clave').value = '';
    document.getElementById('config-estado').textContent = 'Clave borrada.';
    actualizarIndicadorModo();
  });
}

// payload se manda tal cual al backend que corresponda. opciones.endpointLocal
// es la ruta del servidor.py a usar cuando estamos en localhost.
async function guardarEnBackend(payload, opciones){
  if(esModoLocal()){
    const resp = await fetch(opciones.endpointLocal, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if(!resp.ok) throw new Error(data.error || 'Error desconocido');
    return data;
  }

  const cfg = proxyCargarConfig();
  if(!proxyConfigCompleta(cfg)){
    document.getElementById('config-github').open = true;
    throw new Error('Falta configurar la URL del servidor y la clave del grupo más arriba.');
  }
  return guardarSesionProxy(cfg, payload);
}
