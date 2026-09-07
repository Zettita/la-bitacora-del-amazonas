// PREMIOS_INFO, champKey/champIconUrl/avatarHtml/iniciales viven en comunes.js

async function cargarDatos(){
  const sinCache = { cache: 'no-store' };
  const [manifest, jugadoresArr] = await Promise.all([
    fetch('data/manifest.json', sinCache).then(r => r.json()).catch(() => []),
    fetch('data/players.json', sinCache).then(r => r.json()).catch(() => []),
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

  return { jugadoresArr, sesiones };
}

// Recorre todas las sesiones y arma las estadísticas de un solo jugador:
// partidas/victorias, KDA promedio, y sus campeones más jugados (con
// winrate propio de cada uno).
function calcularEstadisticasJugador(sesiones, jugadorId){
  let partidas = 0, victorias = 0;
  let k = 0, d = 0, a = 0;
  const campeones = {};

  sesiones.forEach(s => (s.partidas || []).forEach(p => {
    (p.jugadores || []).forEach(j => {
      if(j.jugador !== jugadorId) return;
      partidas++;
      const gano = p.resultado === 'Victoria';
      if(gano) victorias++;
      if(j.kda){ k += j.kda.k || 0; d += j.kda.d || 0; a += j.kda.a || 0; }
      if(j.campeon){
        const c = campeones[j.campeon] || (campeones[j.campeon] = { nombre: j.campeon, partidas: 0, victorias: 0 });
        c.partidas++;
        if(gano) c.victorias++;
      }
    });
  }));

  const topCampeones = Object.values(campeones)
    .sort((x, y) => y.partidas - x.partidas)
    .slice(0, 3);

  return {
    partidas, victorias, derrotas: partidas - victorias,
    winrate: partidas ? victorias / partidas : 0,
    kdaProm: {
      k: partidas ? k / partidas : 0,
      d: partidas ? d / partidas : 0,
      a: partidas ? a / partidas : 0,
    },
    topCampeones,
  };
}

function renderSelectorJugadores(jugadoresArr, idActual){
  const el = document.getElementById('selector-jugador');
  if(jugadoresArr.length === 0) return;
  el.hidden = false;
  el.innerHTML = jugadoresArr.map(j =>
    `<a href="jugador.html?id=${encodeURIComponent(j.id)}" class="${j.id === idActual ? 'activo' : ''}">${j.nombre}</a>`
  ).join('');
}

function renderPerfil(jugador, stats){
  document.getElementById('perfil-nombre').textContent = jugador.nombre;
  document.getElementById('perfil-sub').textContent = `Perfil de invocador de ${jugador.nombre}`;

  const campeonPrincipal = stats.topCampeones[0]?.nombre || '';
  document.getElementById('perfil-avatar').innerHTML = avatarHtml(jugador.nombre, campeonPrincipal);
  document.getElementById('perfil-resumen-nombre').textContent = jugador.nombre;
  document.getElementById('perfil-resumen-sub').textContent = campeonPrincipal
    ? `Suele jugar ${campeonPrincipal}`
    : 'Todavía sin campeón favorito claro';

  const winratePct = Math.round(stats.winrate * 100);
  document.getElementById('perfil-stats').innerHTML = `
    <div class="stat"><span class="num">${stats.partidas}</span><span class="lbl">Partidas totales</span></div>
    <div class="stat"><span class="num">${winratePct}%</span><span class="lbl">Winrate</span></div>
    <div class="stat"><span class="num">${stats.victorias}V ${stats.derrotas}D</span><span class="lbl">Récord</span></div>
    <div class="stat"><span class="num">${stats.kdaProm.k.toFixed(1)}/${stats.kdaProm.d.toFixed(1)}/${stats.kdaProm.a.toFixed(1)}</span><span class="lbl">KDA promedio</span></div>
  `;

  const elCampeones = document.getElementById('perfil-campeones');
  if(stats.topCampeones.length === 0){
    elCampeones.innerHTML = `<div class="fama-card vacio">Todavía no jugó ninguna partida con campeón cargado.</div>`;
  }else{
    elCampeones.innerHTML = stats.topCampeones.map((c, i) => {
      const wr = c.partidas ? Math.round((c.victorias / c.partidas) * 100) : 0;
      return `
        <div class="campeon-card">
          <span class="campeon-card-puesto">${i + 1}°</span>
          ${avatarHtml(jugador.nombre, c.nombre)}
          <div class="campeon-card-info">
            <div class="campeon-card-nombre">${c.nombre}</div>
            <div class="campeon-card-detalle">${c.partidas} partida${c.partidas === 1 ? '' : 's'} · ${wr}% winrate</div>
          </div>
        </div>
      `;
    }).join('');
  }

  document.getElementById('perfil-contenido').hidden = false;
}

(async function init(){
  const idPedido = new URLSearchParams(location.search).get('id');
  const { jugadoresArr, sesiones } = await cargarDatos();
  const jugador = jugadoresArr.find(j => j.id === idPedido);

  renderSelectorJugadores(jugadoresArr, idPedido);

  if(!jugador){
    document.getElementById('perfil-nombre').textContent = 'Elegí un invocador';
    document.getElementById('perfil-sub').textContent = jugadoresArr.length
      ? 'Elegí de quién ver el perfil ahí arriba.'
      : 'Todavía no hay jugadores cargados en el roster.';
    return;
  }

  const stats = calcularEstadisticasJugador(sesiones, jugador.id);

  if(stats.partidas === 0){
    document.getElementById('perfil-nombre').textContent = jugador.nombre;
    document.getElementById('perfil-sub').textContent = 'Todavía no tiene partidas cargadas.';
    const vacio = document.getElementById('perfil-vacio');
    vacio.textContent = `${jugador.nombre} todavía no tiene ninguna partida cargada.`;
    vacio.hidden = false;
    return;
  }

  renderPerfil(jugador, stats);
})();
