// PREMIOS_INFO, champKey/champIconUrl/iniciales y formatFecha viven en comunes.js

// ---------- Carga de datos ----------
async function cargarDatos(){
  const sinCache = { cache: 'no-store' };
  const [manifest, jugadoresArr] = await Promise.all([
    fetch('data/manifest.json', sinCache).then(r => r.json()).catch(() => []),
    fetch('data/players.json', sinCache).then(r => r.json()).catch(() => []),
  ]);

  const jugadores = {};
  jugadoresArr.forEach(j => jugadores[j.id] = j.nombre);

  const sesiones = [];
  for(const archivo of manifest){
    try{
      const s = await fetch(`data/sessions/${archivo}`, sinCache).then(r => r.json());
      sesiones.push(s);
    }catch(e){
      console.warn('No se pudo cargar la sesión', archivo, e);
    }
  }
  sesiones.sort((a,b) => a.fecha.localeCompare(b.fecha));

  return { jugadores, sesiones };
}

// ---------- Salón de la fama ----------
function calcularEstadisticas(sesiones, jugadores){
  const stats = {};
  const asegurar = (id) => {
    if(!stats[id]) stats[id] = {
      id, nombre: jugadores[id] || id,
      partidas:0, victorias:0, derrotas:0,
      premios: { mvp:0, carry:0, troll:0, ancla:0 },
    };
    return stats[id];
  };

  let totalPartidas = 0;

  sesiones.forEach(s => (s.partidas || []).forEach(p => {
    totalPartidas++;
    (p.jugadores || []).forEach(j => {
      const st = asegurar(j.jugador);
      st.partidas++;
      if(p.resultado === 'Victoria') st.victorias++;
      else if(p.resultado === 'Derrota') st.derrotas++;
      (j.premios || []).forEach(pr => { if(st.premios[pr] !== undefined) st.premios[pr]++; });
    });
  }));

  return { stats: Object.values(stats), totalPartidas, totalSesiones: sesiones.length };
}

function renderResumen(totalPartidas, totalSesiones, cantJugadores){
  const el = document.getElementById('fama-resumen');
  el.innerHTML = `
    <div class="stat"><span class="num">${totalSesiones}</span><span class="lbl">Días jugados</span></div>
    <div class="stat"><span class="num">${totalPartidas}</span><span class="lbl">Partidas</span></div>
    <div class="stat"><span class="num">${cantJugadores}</span><span class="lbl">Invocadores</span></div>
  `;
}

function topPor(stats, key, minimo=1){
  return stats
    .filter(s => s.premios[key] >= minimo)
    .sort((a,b) => b.premios[key] - a.premios[key])
    .slice(0,5);
}

function renderSalonDeLaFama(stats, totalPartidas, totalSesiones){
  renderResumen(totalPartidas, totalSesiones, stats.length);

  const grid = document.getElementById('fama-grid');
  grid.innerHTML = '';

  if(stats.length === 0){
    grid.innerHTML = `<div class="fama-card vacio">Todavía no hay partidas cargadas.<br>¡La primera página está en blanco!</div>`;
    return;
  }

  ['mvp','carry','troll','ancla'].forEach(key => {
    const info = PREMIOS_INFO[key];
    const top = topPor(stats, key);
    const card = document.createElement('div');
    card.className = 'fama-card';
    const filas = top.length
      ? top.map(s => `<li><span>${s.nombre}</span><span class="cnt">${s.premios[key]}</span></li>`).join('')
      : `<li style="opacity:.6; font-style:italic;">Nadie todavía</li>`;
    card.innerHTML = `<h3>${info.icono} ${info.label}</h3><ol>${filas}</ol>`;
    grid.appendChild(card);
  });

  // Mejor winrate (mínimo 3 partidas para contar)
  const conWinrate = stats
    .filter(s => s.partidas >= 3)
    .map(s => ({...s, winrate: s.victorias / s.partidas}))
    .sort((a,b) => b.winrate - a.winrate)
    .slice(0,5);
  const cardWr = document.createElement('div');
  cardWr.className = 'fama-card';
  const filasWr = conWinrate.length
    ? conWinrate.map(s => `<li><span>${s.nombre}</span><span class="cnt">${Math.round(s.winrate*100)}%</span></li>`).join('')
    : `<li style="opacity:.6; font-style:italic;">Faltan partidas (mín. 3)</li>`;
  cardWr.innerHTML = `<h3>📈 Mejor Winrate</h3><ol>${filasWr}</ol>`;
  grid.appendChild(cardWr);
}

// ---------- Timeline ----------
function renderJugadorFila(j, jugadores){
  const nombre = jugadores[j.jugador] || j.jugador;
  const kda = j.kda ? `${j.kda.k ?? 0}/${j.kda.d ?? 0}/${j.kda.a ?? 0}` : '';
  const premiosHtml = (j.premios || []).map(p => {
    const info = PREMIOS_INFO[p];
    if(!info) return '';
    return `<span class="premio ${p}">${info.icono} ${info.label}</span>`;
  }).join('');

  const avatarMarkup = avatarHtml(nombre, j.campeon);

  const comentarioHtml = j.comentario
    ? `<div class="jugador-comentario">"${j.comentario}"</div>`
    : '';

  return `
    <div class="jugador-fila">
      ${avatarMarkup}
      <div class="jugador-info">
        <div class="jugador-nombre">${nombre} ${premiosHtml ? `<span class="jugador-premios">${premiosHtml}</span>` : ''}</div>
        <div class="jugador-rol">${j.rol || ''}${j.rol && j.campeon ? ' · ' : ''}<span class="jugador-campeon">${j.campeon || ''}</span></div>
      </div>
      <div class="jugador-kda">${kda}</div>
      ${comentarioHtml}
    </div>
  `;
}

function renderPartida(p, index, jugadores){
  const resultadoClase = p.resultado === 'Victoria' ? 'victoria' : 'derrota';
  const meta = [p.modo, p.duracion].filter(Boolean).join(' · ');
  const filas = (p.jugadores || []).map(j => renderJugadorFila(j, jugadores)).join('');

  return `
    <div class="partida">
      <div class="partida-header">
        <span class="partida-numero">Partida ${p.numero ?? index + 1}</span>
        <span class="badge-resultado ${resultadoClase}">${p.resultado || '?'}</span>
        ${meta ? `<span class="partida-meta">${meta}</span>` : ''}
      </div>
      <div class="jugadores-tabla">${filas}</div>
    </div>
  `;
}

function renderCapitulo(sesion, numero, jugadores){
  const cantPartidas = (sesion.partidas || []).length;
  const victorias = (sesion.partidas || []).filter(p => p.resultado === 'Victoria').length;

  const div = document.createElement('div');
  div.className = 'capitulo';
  div.innerHTML = `
    <div class="capitulo-header">
      <div>
        <div class="capitulo-titulo">Capítulo ${numero} — ${sesion.titulo || 'Noche de juego'}</div>
        <div class="capitulo-fecha">${formatFecha(sesion.fecha)}</div>
      </div>
      <div class="capitulo-resumen">${cantPartidas} partida${cantPartidas === 1 ? '' : 's'} · ${victorias}V ${cantPartidas - victorias}D</div>
      <span class="capitulo-flecha">▶</span>
    </div>
    <div class="capitulo-cuerpo" hidden>
      ${sesion.notas ? `<p class="capitulo-notas">${sesion.notas}</p>` : ''}
      ${(sesion.partidas || []).map((p,i) => renderPartida(p,i,jugadores)).join('')}
    </div>
  `;

  const header = div.querySelector('.capitulo-header');
  const cuerpo = div.querySelector('.capitulo-cuerpo');
  header.addEventListener('click', () => {
    cuerpo.hidden = !cuerpo.hidden;
    div.classList.toggle('abierto', !cuerpo.hidden);
  });

  return div;
}

function renderTimeline(sesiones, jugadores){
  const el = document.getElementById('timeline');
  el.innerHTML = '';

  if(sesiones.length === 0){
    el.innerHTML = `<div class="vacio-timeline">Todavía no se escribió ningún capítulo.<br>La próxima noche de juego será la primera página.</div>`;
    return;
  }

  sesiones.forEach((s, i) => {
    const capitulo = renderCapitulo(s, i + 1, jugadores);
    if(i === sesiones.length - 1){
      capitulo.classList.add('abierto');
      capitulo.querySelector('.capitulo-cuerpo').hidden = false;
    }
    el.appendChild(capitulo);
  });
}

// ---------- Init ----------
(async function init(){
  const { jugadores, sesiones } = await cargarDatos();
  const { stats, totalPartidas, totalSesiones } = calcularEstadisticas(sesiones, jugadores);

  renderSalonDeLaFama(stats, totalPartidas, totalSesiones);
  renderTimeline(sesiones, jugadores);
})();
