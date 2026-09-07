// PREMIOS_INFO, champKey/champSplashUrl/classicSplashUrl/classicTileUrl/
// avatarHtml/iniciales/formatFecha viven en comunes.js

async function cargarDatos(){
  const sinCache = { cache: 'no-store' };
  const [manifest, jugadoresArr, champData] = await Promise.all([
    fetch('data/manifest.json', sinCache).then(r => r.json()).catch(() => []),
    fetch('data/players.json', sinCache).then(r => r.json()).catch(() => []),
    fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION_ACTUAL}/data/es_ES/champion.json`)
      .then(r => r.json()).then(d => d.data).catch(() => ({})),
  ]);

  const sesiones = [];
  for(const archivo of manifest){
    try{
      const s = await fetch(`data/sessions/${archivo}`, sinCache).then(r => r.json());
      sesiones.push(s);
    }catch(e){
      console.warn('No se pudo cargar la sesión', archivo, e);
    }
  }
  sesiones.sort((a, b) => a.fecha.localeCompare(b.fecha));

  return { jugadoresArr, sesiones, champData };
}

// Título oficial del campeón según Data Dragon (es_ES) — ej. Nasus -> "El
// Guardián de las Arenas". Mismo origen (Data Dragon) que los íconos; se
// resuelve solo a partir del campeón más jugado, sin listas a mano.
function champTitulo(nombre, champData){
  const key = champKey(nombre);
  const info = key && champData ? champData[key] : null;
  return info ? info.title : '';
}

// Recorre todas las sesiones y arma las estadísticas de un solo jugador:
// partidas/victorias, KDA promedio, premios ganados, racha actual, el
// historial de partidas (para "últimas partidas") y todos los campeones
// que jugó (cada uno con su propio KDA y winrate).
function calcularEstadisticasJugador(sesiones, jugadorId){
  let partidas = 0, victorias = 0;
  let k = 0, d = 0, a = 0;
  const campeones = {};
  const premios = { mvp: 0, carry: 0, troll: 0, ancla: 0 };
  const historial = [];

  sesiones.forEach(s => (s.partidas || []).forEach(p => {
    (p.jugadores || []).forEach(j => {
      if(j.jugador !== jugadorId) return;
      partidas++;
      const gano = p.resultado === 'Victoria';
      if(gano) victorias++;
      if(j.kda){ k += j.kda.k || 0; d += j.kda.d || 0; a += j.kda.a || 0; }
      if(j.campeon){
        const c = campeones[j.campeon] || (campeones[j.campeon] = {
          nombre: j.campeon, partidas: 0, victorias: 0, k: 0, d: 0, a: 0,
        });
        c.partidas++;
        if(gano) c.victorias++;
        if(j.kda){ c.k += j.kda.k || 0; c.d += j.kda.d || 0; c.a += j.kda.a || 0; }
      }
      (j.premios || []).forEach(pr => { if(premios[pr] !== undefined) premios[pr]++; });
      historial.push({
        fecha: s.fecha,
        numero: p.numero ?? 0,
        resultado: p.resultado,
        campeon: j.campeon,
        rol: j.rol,
        kda: j.kda,
      });
    });
  }));

  historial.sort((x, y) => x.fecha.localeCompare(y.fecha) || x.numero - y.numero);

  const ultimoResultado = historial.length ? historial[historial.length - 1].resultado : null;
  let racha = 0;
  for(let i = historial.length - 1; i >= 0 && historial[i].resultado === ultimoResultado; i--){
    racha++;
  }

  const todosCampeones = Object.values(campeones).sort((x, y) => y.partidas - x.partidas);

  return {
    partidas, victorias, derrotas: partidas - victorias,
    winrate: partidas ? victorias / partidas : 0,
    kdaProm: {
      k: partidas ? k / partidas : 0,
      d: partidas ? d / partidas : 0,
      a: partidas ? a / partidas : 0,
    },
    premios,
    racha, rachaResultado: ultimoResultado,
    todosCampeones,
    historial,
  };
}

// Fondo de pantalla por defecto: el splash art clásico (skin "Jade" de LoL
// Classic, igual que los íconos del resto del sitio) del campeón más
// jugado; si el campeón no está en Classic, cae al splash actual.
function aplicarFondoCampeon(campeon){
  const url = classicSplashUrl(campeon) || champSplashUrl(campeon);
  if(!url) return;
  document.getElementById('body-perfil').style.backgroundImage =
    `radial-gradient(ellipse at top, rgba(36,29,20,.85) 0%, rgba(18,16,14,.94) 60%), url('${url}')`;
}

// Foto de jugador cargada desde el Admin (data/players.json: "imagen"); si
// todavía no tiene, se muestra un espacio reservado con sus iniciales.
function renderAvatarJugador(jugador){
  const el = document.getElementById('perfil-avatar');
  el.innerHTML = jugador.imagen
    ? `<img src="${jugador.imagen}" alt="${jugador.nombre}">`
    : `<div class="perfil-header-avatar-fallback">${iniciales(jugador.nombre)}</div>`;
}

function renderCampeonCard(c, i){
  const wr = c.partidas ? Math.round((c.victorias / c.partidas) * 100) : 0;
  const kdaProm = {
    k: c.partidas ? c.k / c.partidas : 0,
    d: c.partidas ? c.d / c.partidas : 0,
    a: c.partidas ? c.a / c.partidas : 0,
  };
  const splash = classicSplashUrl(c.nombre) || champSplashUrl(c.nombre);
  return `
    <div class="campeon-card" style="background-image:url('${splash}')">
      <span class="campeon-card-puesto">${i + 1}°</span>
      <div class="campeon-card-info">
        <div class="campeon-card-nombre">${c.nombre}</div>
        <div class="campeon-card-detalle">
          <span>${c.partidas} partida${c.partidas === 1 ? '' : 's'}</span>
          <span>KDA ${kdaProm.k.toFixed(1)}/${kdaProm.d.toFixed(1)}/${kdaProm.a.toFixed(1)}</span>
          <span>${wr}% winrate</span>
        </div>
      </div>
    </div>
  `;
}

function renderCampeones(todosCampeones){
  const el = document.getElementById('perfil-campeones');
  const btn = document.getElementById('btn-ver-mas-campeones');

  if(todosCampeones.length === 0){
    el.innerHTML = `<div class="fama-card vacio">Todavía no jugó ninguna partida con campeón cargado.</div>`;
    btn.hidden = true;
    return;
  }

  const top = todosCampeones.slice(0, 3);
  const resto = todosCampeones.slice(3);

  el.innerHTML = top.map((c, i) => renderCampeonCard(c, i)).join('');

  if(resto.length === 0){
    btn.hidden = true;
    return;
  }

  btn.hidden = false;
  btn.textContent = `Ver los ${todosCampeones.length} campeones jugados ▾`;
  btn.onclick = () => {
    el.insertAdjacentHTML('beforeend', resto.map((c, i) => renderCampeonCard(c, i + 3)).join(''));
    btn.hidden = true;
  };
}

function renderPremios(premios){
  document.getElementById('perfil-premios').innerHTML = Object.entries(PREMIOS_INFO).map(([key, info]) => `
    <div class="premio-card ${key}">
      <span class="ico">${info.icono}</span>
      <span class="cnt">${premios[key] || 0}</span>
      <span class="lbl">${info.label}</span>
    </div>
  `).join('');
}

function renderUltimasPartidas(historial){
  const el = document.getElementById('perfil-partidas');
  const recientes = historial.slice(-5).reverse();

  if(recientes.length === 0){
    el.innerHTML = `<div class="fama-card vacio">Todavía no hay partidas para mostrar.</div>`;
    return;
  }

  el.innerHTML = recientes.map(h => {
    const resultadoClase = h.resultado === 'Victoria' ? 'victoria' : 'derrota';
    const kda = h.kda ? `${h.kda.k ?? 0}/${h.kda.d ?? 0}/${h.kda.a ?? 0}` : '—';
    const tile = classicTileUrl(h.campeon);
    const imgHtml = tile
      ? `<img class="jugador-avatar" src="${tile}" alt="${h.campeon || ''}">`
      : `<div class="jugador-avatar-fallback">${iniciales(h.campeon)}</div>`;
    return `
      <div class="partida-mini">
        <span class="badge-resultado ${resultadoClase}">${h.resultado || '?'}</span>
        ${imgHtml}
        <div class="campeon-rol">${h.campeon || '—'}<small>${h.rol || ''}</small></div>
        <span class="kda">${kda}</span>
        <span class="fecha">${formatFecha(h.fecha)}</span>
      </div>
    `;
  }).join('');
}

function renderPerfil(jugador, stats, champData){
  document.getElementById('perfil-nombre').textContent = jugador.nombre;
  renderAvatarJugador(jugador);

  const campeonPrincipal = stats.todosCampeones[0]?.nombre || '';
  aplicarFondoCampeon(campeonPrincipal);

  const subtitulo = document.getElementById('perfil-subtitulo');
  const titulo = champTitulo(campeonPrincipal, champData);
  subtitulo.textContent = titulo;
  subtitulo.hidden = !titulo;

  const winratePct = Math.round(stats.winrate * 100);
  const rachaTxt = stats.racha > 1
    ? `${stats.rachaResultado === 'Victoria' ? '🔥' : '💧'} ${stats.racha}`
    : '—';
  const rachaLbl = stats.racha > 1
    ? (stats.rachaResultado === 'Victoria' ? 'Victorias seguidas' : 'Derrotas seguidas')
    : 'Racha actual';

  document.getElementById('perfil-stats').innerHTML = `
    <div class="stat"><span class="num">${stats.partidas}</span><span class="lbl">Partidas totales</span></div>
    <div class="stat"><span class="num">${stats.victorias}V ${stats.derrotas}D</span><span class="lbl">Récord · ${winratePct}% WR</span></div>
    <div class="stat"><span class="num">${stats.kdaProm.k.toFixed(1)}/${stats.kdaProm.d.toFixed(1)}/${stats.kdaProm.a.toFixed(1)}</span><span class="lbl">KDA promedio</span></div>
    <div class="stat"><span class="num">${rachaTxt}</span><span class="lbl">${rachaLbl}</span></div>
  `;

  renderPremios(stats.premios);
  renderCampeones(stats.todosCampeones);
  renderUltimasPartidas(stats.historial);

  document.getElementById('perfil-contenido').hidden = false;
}

(async function init(){
  const idPedido = new URLSearchParams(location.search).get('id');
  const { jugadoresArr, sesiones, champData } = await cargarDatos();
  const jugador = jugadoresArr.find(j => j.id === idPedido);

  if(!jugador){
    document.getElementById('perfil-nombre').textContent = 'Jugador no encontrado';
    const vacio = document.getElementById('perfil-vacio');
    vacio.textContent = 'Agregá ?id=<jugador> a la URL (ver data/players.json para los ids válidos).';
    vacio.hidden = false;
    return;
  }

  const stats = calcularEstadisticasJugador(sesiones, jugador.id);

  if(stats.partidas === 0){
    document.getElementById('perfil-nombre').textContent = jugador.nombre;
    renderAvatarJugador(jugador);
    const vacio = document.getElementById('perfil-vacio');
    vacio.textContent = `${jugador.nombre} todavía no tiene ninguna partida cargada.`;
    vacio.hidden = false;
    return;
  }

  renderPerfil(jugador, stats, champData);
})();
