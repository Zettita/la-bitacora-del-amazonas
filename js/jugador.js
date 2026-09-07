// PREMIOS_INFO, champKey/champSplashUrl/iniciales viven en comunes.js

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
// partidas/victorias, KDA promedio general, y sus campeones más jugados,
// cada uno con su propio KDA y winrate.
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
        const c = campeones[j.campeon] || (campeones[j.campeon] = {
          nombre: j.campeon, partidas: 0, victorias: 0, k: 0, d: 0, a: 0,
        });
        c.partidas++;
        if(gano) c.victorias++;
        if(j.kda){ c.k += j.kda.k || 0; c.d += j.kda.d || 0; c.a += j.kda.a || 0; }
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

// Fondo de pantalla por defecto: el splash art clásico (skin "Jade" de LoL
// Classic, igual que los íconos del resto del sitio) del campeón más
// jugado; si el campeón no está en Classic, cae al splash actual.
function aplicarFondoCampeon(campeon){
  const url = classicSplashUrl(campeon) || champSplashUrl(campeon);
  if(!url) return;
  document.getElementById('body-perfil').style.backgroundImage =
    `radial-gradient(ellipse at top, rgba(36,29,20,.85) 0%, rgba(18,16,14,.94) 60%), url('${url}')`;
}

function renderPerfil(jugador, stats){
  document.getElementById('perfil-nombre').textContent = jugador.nombre;

  const campeonPrincipal = stats.topCampeones[0]?.nombre || '';
  aplicarFondoCampeon(campeonPrincipal);

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
    }).join('');
  }

  document.getElementById('perfil-contenido').hidden = false;
}

(async function init(){
  const idPedido = new URLSearchParams(location.search).get('id');
  const { jugadoresArr, sesiones } = await cargarDatos();
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
    const vacio = document.getElementById('perfil-vacio');
    vacio.textContent = `${jugador.nombre} todavía no tiene ninguna partida cargada.`;
    vacio.hidden = false;
    return;
  }

  renderPerfil(jugador, stats);
})();
