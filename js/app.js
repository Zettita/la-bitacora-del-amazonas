// PREMIOS_INFO, champKey/champIconUrl/iniciales y formatFecha viven en comunes.js

// ---------- Carga de datos ----------
async function cargarDatos(){
  const sinCache = { cache: 'no-store' };
  const [manifest, jugadoresArr, destacadosArr] = await Promise.all([
    fetch('data/manifest.json', sinCache).then(r => r.json()).catch(() => []),
    fetch('data/players.json', sinCache).then(r => r.json()).catch(() => []),
    fetch('data/destacados.json', sinCache).then(r => r.json()).catch(() => []),
  ]);

  const jugadores = {};
  jugadoresArr.forEach(j => jugadores[j.id] = { nombre: j.nombre, imagen: j.imagen });

  const destacados = {};
  destacadosArr.forEach(d => destacados[d.id] = d.nombre);

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

  // jugadoresArr mantiene el orden de data/players.json, que es el orden en
  // que se fueron sumando (no hay un campo de fecha de alta propio) — sirve
  // como orden por "antigüedad en el roster" para cuando todavía no hay
  // partidas para ordenar por estadísticas.
  return { jugadores, jugadoresArr, destacados, sesiones };
}

// ---------- Salón de la fama ----------
function calcularEstadisticas(sesiones, jugadores){
  const stats = {};
  const asegurar = (id) => {
    if(!stats[id]) stats[id] = {
      id, nombre: jugadores[id]?.nombre || id,
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

// ---------- Podio de invocadores ----------
// Muestra a todo el roster, haya jugado o no. Sin partidas cargadas se
// ordena por antigüedad en el roster (orden de alta); en cuanto hay
// estadísticas, pasa a ordenar por winrate (a definir más adelante otro
// criterio). Object.values(stats) y jugadoresArr respetan el orden de
// data/players.json, así que un jugador sin partidas queda al final, en
// orden de alta, aunque conviva con otros que sí tienen estadísticas.
function renderPodio(stats, jugadores, jugadoresArr){
  const carrusel = document.getElementById('podio-carrusel');
  const flechaIzq = document.querySelector('.podio-flecha.izq');
  const flechaDer = document.querySelector('.podio-flecha.der');

  if(jugadoresArr.length === 0){
    carrusel.classList.add('vacio');
    carrusel.innerHTML = `
      <a href="herramientas/cargar.html" class="podio-tarjeta podio-tarjeta-vacia">
        <div class="podio-vacia-tilt">
          <span class="podio-vacia-icono">+</span>
          <div class="podio-vacia-titulo">Todavía no hay invocadores</div>
          <div class="podio-vacia-sub">Agregá al primero</div>
        </div>
      </a>
    `;
    flechaIzq.hidden = true;
    flechaDer.hidden = true;
    initTarjetaVaciaTilt(carrusel.querySelector('.podio-tarjeta-vacia'));
    return;
  }

  carrusel.classList.remove('vacio');

  const statsPorId = {};
  stats.forEach(s => { statsPorId[s.id] = s; });
  const lista = jugadoresArr.map(j => statsPorId[j.id] || {
    id: j.id, nombre: j.nombre, partidas: 0, victorias: 0, derrotas: 0,
    premios: { mvp:0, carry:0, troll:0, ancla:0 },
  });

  const hayPartidas = lista.some(s => s.partidas > 0);
  const ordenado = hayPartidas
    ? [...lista].sort((a, b) => {
        const wrA = a.partidas ? a.victorias / a.partidas : -1;
        const wrB = b.partidas ? b.victorias / b.partidas : -1;
        if(wrB !== wrA) return wrB - wrA;
        return b.partidas - a.partidas;
      })
    : lista;

  carrusel.innerHTML = ordenado.map((s, i) => {
    const imagen = jugadores[s.id]?.imagen;
    const avatar = imagen
      ? `<img src="${imagen}" alt="${s.nombre}">`
      : `<div class="podio-avatar-fallback">${iniciales(s.nombre)}</div>`;
    const detalle = s.partidas
      ? `${Math.round((s.victorias / s.partidas) * 100)}% WR · ${s.partidas} partida${s.partidas === 1 ? '' : 's'}`
      : 'Sin partidas todavía';
    return `
      <a href="jugador.html?id=${encodeURIComponent(s.id)}" class="podio-tarjeta">
        <span class="podio-puesto">${i + 1}°</span>
        <div class="podio-avatar">${avatar}</div>
        <div class="podio-nombre">${s.nombre}</div>
        <div class="podio-detalle">${detalle}</div>
      </a>
    `;
  }).join('');

  const sinOverflow = carrusel.scrollWidth <= carrusel.clientWidth + 1;
  flechaIzq.hidden = sinOverflow;
  flechaDer.hidden = sinOverflow;
}

function initPodioFlechas(){
  const carrusel = document.getElementById('podio-carrusel');
  document.querySelector('.podio-flecha.izq').addEventListener('click', () => {
    carrusel.scrollBy({ left: -256, behavior: 'smooth' });
  });
  document.querySelector('.podio-flecha.der').addEventListener('click', () => {
    carrusel.scrollBy({ left: 256, behavior: 'smooth' });
  });
}

// Efecto "carta": la tarjeta vacía se inclina levemente siguiendo al mouse,
// siempre alrededor de su propio centro (no se traslada). El agrandado y el
// resplandor van por CSS (mismo delay de 1s); esto solo rota el contenido
// interno, rápido, para que se sienta responsivo al cursor.
function initTarjetaVaciaTilt(tarjeta){
  if(!tarjeta) return;
  const MAX_GRADOS = 16;
  const TRANSICION_LENTA = 'transform 1s ease, border-color 1s ease, background-color 1s ease, box-shadow 1s ease';
  const TRANSICION_RAPIDA = 'transform .15s ease-out, border-color 1s ease, background-color 1s ease, box-shadow 1s ease';

  let siguiendoMouse = false;

  tarjeta.addEventListener('mouseenter', () => {
    siguiendoMouse = false;
    tarjeta.style.transition = TRANSICION_LENTA;
  });

  tarjeta.addEventListener('mousemove', (ev) => {
    const rect = tarjeta.getBoundingClientRect();
    const x = (ev.clientX - rect.left) / rect.width - 0.5;
    const y = (ev.clientY - rect.top) / rect.height - 0.5;

    // El primer movimiento entra con la transición lenta (a tono con el
    // resplandor); a partir de ahí, rápida, para que siga al mouse sin
    // sentirse pesada.
    if(!siguiendoMouse){
      siguiendoMouse = true;
      tarjeta.style.transition = TRANSICION_RAPIDA;
    }

    tarjeta.style.transform =
      `perspective(700px) scale(1.06) rotateX(${(-y * MAX_GRADOS).toFixed(2)}deg) rotateY(${(x * MAX_GRADOS).toFixed(2)}deg)`;
  });

  tarjeta.addEventListener('mouseleave', () => {
    siguiendoMouse = false;
    tarjeta.style.transition = TRANSICION_LENTA;
    tarjeta.style.transform = '';
  });
}

// ---------- Timeline ----------

// Fondo de fila: el splash art clásico del campeón jugado (o el actual si
// todavía no está en LoL Classic). Devuelve un atributo style listo para
// pegar en el div, o vacío si no hay campeón cargado.
function fondoFilaStyle(campeon){
  const splash = classicSplashUrl(campeon) || champSplashUrl(campeon);
  return splash ? ` style="background-image:url('${splash}')"` : '';
}

function renderJugadorFila(j, jugadores){
  const jugadorInfo = jugadores[j.jugador];
  const nombre = jugadorInfo?.nombre || j.jugador;
  const kda = j.kda ? `${j.kda.k ?? 0}/${j.kda.d ?? 0}/${j.kda.a ?? 0}` : '';
  const premiosHtml = (j.premios || []).map(p => {
    const info = PREMIOS_INFO[p];
    if(!info) return '';
    return `<span class="premio ${p}">${info.icono} ${info.label}</span>`;
  }).join('');

  // Foto propia del jugador (cargada desde "cargar sesión" al sumarlo al
  // roster) si existe; si no, el ícono de campeón de siempre.
  const avatarMarkup = jugadorInfo?.imagen
    ? `<img class="jugador-avatar" src="${jugadorInfo.imagen}" alt="${nombre}">`
    : avatarHtml(nombre, j.campeon);

  const comentarioHtml = j.comentario
    ? `<div class="jugador-comentario">"${j.comentario}"</div>`
    : '';

  return `
    <div class="jugador-fila"${fondoFilaStyle(j.campeon)}>
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

function renderDestacadoFila(d, destacados){
  const nombre = destacados[d.destacado] || d.destacado;
  const kda = d.kda ? `${d.kda.k ?? 0}/${d.kda.d ?? 0}/${d.kda.a ?? 0}` : '';
  const avatarMarkup = avatarHtml(nombre, d.campeon);
  const comentarioHtml = d.comentario
    ? `<div class="jugador-comentario">"${d.comentario}"</div>`
    : '';

  return `
    <div class="jugador-fila"${fondoFilaStyle(d.campeon)}>
      ${avatarMarkup}
      <div class="jugador-info">
        <div class="jugador-nombre">🎭 ${nombre}</div>
        <div class="jugador-rol">${d.rol || ''}${d.rol && d.campeon ? ' · ' : ''}<span class="jugador-campeon">${d.campeon || ''}</span></div>
      </div>
      <div class="jugador-kda">${kda}</div>
      ${comentarioHtml}
    </div>
  `;
}

function renderDestacados(destacadosPartida, destacados){
  if(!destacadosPartida || !destacadosPartida.length) return '';
  const filas = destacadosPartida.map(d => renderDestacadoFila(d, destacados)).join('');
  return `
    <div class="destacados-partida">
      <div class="destacados-titulo">Personajes destacados</div>
      <div class="jugadores-tabla">${filas}</div>
    </div>
  `;
}

function renderPartida(p, index, jugadores, destacados){
  const resultadoClase = p.resultado === 'Victoria' ? 'victoria' : 'derrota';
  const meta = [p.duracion].filter(Boolean).join(' · ');
  const filas = (p.jugadores || []).map(j => renderJugadorFila(j, jugadores)).join('');

  return `
    <div class="partida">
      <div class="partida-header">
        <span class="partida-numero">Partida ${p.numero ?? index + 1}</span>
        <span class="badge-resultado ${resultadoClase}">${p.resultado || '?'}</span>
        ${meta ? `<span class="partida-meta">${meta}</span>` : ''}
      </div>
      <div class="jugadores-tabla">${filas}</div>
      ${renderDestacados(p.destacados, destacados)}
    </div>
  `;
}

function renderCapitulo(sesion, numero, jugadores, destacados){
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
      ${(sesion.partidas || []).map((p,i) => renderPartida(p,i,jugadores,destacados)).join('')}
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

function renderTimeline(sesiones, jugadores, destacados){
  const el = document.getElementById('timeline');
  el.innerHTML = '';

  if(sesiones.length === 0){
    el.innerHTML = `<div class="vacio-timeline">Todavía no se escribió ningún capítulo.<br>La próxima noche de juego será la primera página.</div>`;
    return;
  }

  sesiones.forEach((s, i) => {
    const capitulo = renderCapitulo(s, i + 1, jugadores, destacados);
    if(i === sesiones.length - 1){
      capitulo.classList.add('abierto');
      capitulo.querySelector('.capitulo-cuerpo').hidden = false;
    }
    el.appendChild(capitulo);
  });
}

// ---------- Init ----------
(async function init(){
  const { jugadores, jugadoresArr, destacados, sesiones } = await cargarDatos();
  const { stats, totalPartidas, totalSesiones } = calcularEstadisticas(sesiones, jugadores);

  renderPodio(stats, jugadores, jugadoresArr);
  initPodioFlechas();
  renderSalonDeLaFama(stats, totalPartidas, totalSesiones);
  renderTimeline(sesiones, jugadores, destacados);
})();
