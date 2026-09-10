// Página pública de torneos: sin id en la URL muestra el listado, con
// ?id=<torneo> muestra el cuadro (y el podio si ya terminó). El armado del
// bracket y el render del cuadro/podio viven en comunes.js, compartidos con
// herramientas/torneo.js.

async function cargarTorneosYJugadores(){
  const sinCache = { cache: 'no-store' };
  const [manifest, jugadoresArr] = await Promise.all([
    fetch('data/torneos-manifest.json', sinCache).then(r => r.json()).catch(() => []),
    fetch('data/players.json', sinCache).then(r => r.json()).catch(() => []),
  ]);

  const torneos = [];
  for(const archivo of manifest){
    try{
      const t = await fetch(`data/torneos/${archivo}`, sinCache).then(r => r.json());
      torneos.push(t);
    }catch(e){
      console.warn('No se pudo cargar el torneo', archivo, e);
    }
  }

  const jugadoresPorId = {};
  jugadoresArr.forEach(j => { jugadoresPorId[j.id] = j; });

  return { torneos, jugadoresPorId };
}

function estadoTorneoTexto(torneo){
  return torneo.cerrado ? '🔒 Cerrado' : (torneoTerminado(torneo) ? '🏁 Podio listo, falta finalizar' : '⏳ En curso');
}

// El historial público solo muestra torneos ya cerrados — mientras un
// torneo está en curso (o tiene el podio listo pero todavía no se tocó
// "Finalizar torneo"), se sigue editando desde herramientas/torneo.html
// (elegido del desplegable de "Cargar resultados"), pero no aparece acá.
function renderListadoTorneos(torneos){
  const grid = document.getElementById('torneos-grid');
  const vacio = document.getElementById('torneos-vacio');
  const cerrados = torneos.filter(t => t.cerrado);

  if(cerrados.length === 0){
    grid.innerHTML = '';
    vacio.innerHTML = torneos.length === 0
      ? 'Todavía no se armó ningún torneo. <a href="herramientas/torneo.html">Armá el primero acá.</a>'
      : 'Hay un torneo en curso, pero todavía no se cerró ninguno.';
    vacio.hidden = false;
    return;
  }
  vacio.hidden = true;

  const ordenados = [...cerrados].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  grid.innerHTML = ordenados.map(t => `
    <a class="fama-card torneo-card" href="torneos.html?id=${encodeURIComponent(t.id)}">
      <h3>🏆 ${t.nombre}</h3>
      <p class="torneo-card-meta">
        ${formatFecha(t.fecha)}<br>
        ${t.modo === 'equipos' ? 'Por equipos' : 'Individual'} · ${t.participantes.length} participantes
      </p>
    </a>
  `).join('');
}

function renderDetalleTorneo(torneo, jugadoresPorId){
  document.getElementById('torneo-titulo').textContent = torneo.nombre;
  document.getElementById('torneo-sub').textContent = 'Cuadro de eliminación directa.';
  document.getElementById('torneo-detalle-meta').textContent =
    `${formatFecha(torneo.fecha)} · ${torneo.modo === 'equipos' ? 'Por equipos' : 'Individual'} · ${estadoTorneoTexto(torneo)}`;

  const podioWrap = document.getElementById('torneo-podio-wrap');
  const podioHtml = renderPodioTorneoHtml(torneo, jugadoresPorId, { prefijoImg: '' });
  if(podioHtml){
    document.getElementById('torneo-podio').innerHTML = podioHtml;
    podioWrap.hidden = false;
  }

  document.getElementById('torneo-bracket').innerHTML =
    renderBracketTorneoHtml(torneo, jugadoresPorId, { interactivo: false, prefijoImg: '' });

  document.getElementById('torneos-listado').hidden = true;
  document.getElementById('torneo-detalle').hidden = false;
}

(async function init(){
  const idPedido = new URLSearchParams(location.search).get('id');
  const { torneos, jugadoresPorId } = await cargarTorneosYJugadores();

  if(idPedido){
    const torneo = torneos.find(t => t.id === idPedido);
    if(torneo){
      renderDetalleTorneo(torneo, jugadoresPorId);
      return;
    }
    document.getElementById('torneo-sub').textContent = 'No encontramos ese torneo.';
  }

  renderListadoTorneos(torneos);
})();
