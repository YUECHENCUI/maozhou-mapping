/* 茅洲河中游 · 交互地图 —— 主程序（MapLibre GL JS） */
(async function () {
  const CFG = window.MAP_CONFIG, D = window.DESIGN_DATA;
  const K13 = D.meta.svg_unit_px_at_z13;           // 1 个 SVG 单位在 z13 时的屏幕像素
  const unitPx = z => K13 * Math.pow(2, z - 13);    // 任意缩放级别下 1 SVG 单位 = ? px
  const zoomScale = (units) => ['interpolate', ['exponential', 2], ['zoom'], 0, units * unitPx(0), 24, units * unitPx(24)];

  // ---------- basemaps ----------
  const basemaps = CFG.basemaps.slice();
  if (CFG.mapbox && CFG.mapbox.token) {
    basemaps.splice(0, 0, { id: 'mapbox', name: 'Mapbox · ' + CFG.mapbox.style, crs: CFG.mapbox.crs || 'wgs84', tileSize: 512,
      tiles: [`https://api.mapbox.com/styles/v1/${CFG.mapbox.style}/tiles/512/{z}/{x}/{y}@2x?access_token=${CFG.mapbox.token}`],
      attribution: '© Mapbox © OpenStreetMap' });
  }
  const style = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#000' } }] };
  // vector basemap (OpenFreeMap): fetch its style once, merge sources/layers under our design layers
  const vecLayers = [], vecOrig = {}, vs_vis = {};
  const vecUrl = (basemaps.find(b => b.vector) || {}).vector;
  if (vecUrl) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
      const vs = await (await fetch(vecUrl, { signal: ctl.signal })).json(); clearTimeout(t);
      style.glyphs = vs.glyphs; style.sprite = vs.sprite;
      Object.entries(vs.sources).forEach(([k, v]) => style.sources['ofm-' + k] = v);
      vs.layers.forEach(l => {
        if (l.type === 'background') { vecOrig[l.id] = l.paint; return; }
        const nl = JSON.parse(JSON.stringify(l)); nl.id = 'ofm-' + l.id; if (nl.source) nl.source = 'ofm-' + nl.source;
        vs_vis[nl.id] = (nl.layout && nl.layout.visibility) || 'visible';
        nl.layout = Object.assign({}, nl.layout, { visibility: 'none' });
        if (nl.type === 'symbol' && nl.layout['text-field']) nl.layout['text-field'] = ['coalesce', ['get', 'name:zh'], ['get', 'name'], ['get', 'name_en']];
        vecLayers.push(nl.id); vecOrig[nl.id] = JSON.parse(JSON.stringify(nl.paint || {}));
        style.layers.push(nl);
      });
    } catch (e) { console.warn('vector basemap unavailable', e); basemaps.splice(0, basemaps.length, ...basemaps.filter(b => !b.vector)); }
  }
  // 设计配色：仿 Illustrator 原底图（黑底、青灰水体、墨绿山林、低调道路）
  const DESIGN_PALETTE = {
    'ofm-water': { 'fill-color': '#1d3236' }, 'ofm-waterway': { 'line-color': '#25434a' },
    'ofm-landcover_wood': { 'fill-color': '#151a0b', 'fill-opacity': 0.95, 'fill-pattern': undefined },
    'ofm-landuse_park': { 'fill-color': '#151a0b' }, 'ofm-landuse_residential': { 'fill-color': '#070707' },
    'ofm-building': { 'fill-color': '#0d0d0d', 'fill-outline-color': '#1a1a1a' },
    'ofm-highway_minor': { 'line-color': '#1b1d1e' }, 'ofm-highway_major_inner': { 'line-color': '#26292b' },
    'ofm-highway_motorway_inner': { 'line-color': '#2f3335' }
  };
  basemaps.forEach(b => {
    if (!b.tiles) return;
    style.sources['bm-' + b.id] = { type: 'raster', tiles: b.tiles, tileSize: b.tileSize || 256, maxzoom: b.maxzoom || 20, attribution: b.attribution };
    style.layers.push({ id: 'bm-' + b.id, type: 'raster', source: 'bm-' + b.id, layout: { visibility: 'none' }, paint: Object.assign({ 'raster-fade-duration': 150 }, b.paint || {}) });
  });

  // ---------- design layers (order = PNG stacking order) ----------
  const LAYERS = [
    // key, 中文名, data key, maplibre layer defs
    { key: 'raster', name: '原设计底图（对位校核）', on: false },
    { key: 'glow', name: '河流点阵光晕', on: true, defs: [
      { id: 'glow_dots', type: 'circle', source: 'glow_dots', paint: { 'circle-color': '#65DFDF', 'circle-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.3, 16, 0.15], 'circle-radius': zoomScale(1.296), 'circle-blur': 0 } }] },
    { key: 'halftone', name: '半调网点', on: true, defs: [
      { id: 'halftone', type: 'fill', source: 'halftone', paint: { 'fill-color': '#FFFFFF', 'fill-antialias': true,
        // 放大后网点会变成大方块，逐级淡化以免喧宾夺主
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, ['get', 'opacity'], 15.5, ['*', 0.3, ['get', 'opacity']]] } }] },
    { key: 'hatch', name: '中央家园斜线', on: true, defs: [
      { id: 'hatch', type: 'fill', source: 'hatch', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['get', 'opacity'] } }] },
    { key: 'district', name: '制造业腹地片区', on: true, defs: [
      { id: 'district_fill', type: 'fill', source: 'district_fill', paint: { 'fill-color': '#FFFFFF', 'fill-opacity': 0.2 } },
      { id: 'district_line', type: 'fill', source: 'district_line', paint: { 'fill-color': '#F3B81B', 'fill-opacity': 1 } },
      { id: 'district_line_min', type: 'line', source: 'district_line', paint: { 'line-color': '#F3B81B', 'line-width': 0.6, 'line-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 11, 0] } }] },
    { key: 'arcs', name: '联系弧线', on: true, defs: [
      { id: 'arcs', type: 'fill', source: 'arcs', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['get', 'opacity'], 'fill-antialias': false } }] },
    { key: 'water', name: '水系（茅洲河/沙井河/水库）', on: true, defs: [
      { id: 'sea', type: 'fill', source: 'sea', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['get', 'opacity'], 'fill-antialias': false } },
      { id: 'water', type: 'fill', source: 'water', paint: { 'fill-color': '#2EC2C9', 'fill-opacity': 1 } }] },
    { key: 'rings', name: '圈层', on: true, defs: [
      { id: 'rings', type: 'fill', source: 'rings', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['get', 'opacity'] } }] },
    { key: 'labels', name: '标注', on: true },
    { key: 'check', name: 'OSM 真实水系（对位校核）', on: false, vectorOnly: true, defs: [
      { id: 'check_water', type: 'line', source: 'ofm-openmaptiles', 'source-layer': 'water', paint: { 'line-color': '#FF2D55', 'line-width': 1.2, 'line-opacity': 0.9 } },
      { id: 'check_waterway', type: 'line', source: 'ofm-openmaptiles', 'source-layer': 'waterway', paint: { 'line-color': '#FF2D55', 'line-width': 1.6, 'line-opacity': 0.9, 'line-dasharray': [2, 1] } }] }
  ];
  const opacityProps = { circle: 'circle-opacity', fill: 'fill-opacity', line: 'line-opacity' };

  // ---------- coordinate systems ----------
  let crs = 'wgs84';
  const cache = {};
  function fcFor(key) {
    const id = key + '@' + crs;
    if (!cache[id]) cache[id] = crs === 'gcj02' ? Coord.convertFC(D.layers[key], Coord.wgs2gcj) : D.layers[key];
    return cache[id];
  }
  const P = (ll) => crs === 'gcj02' ? Coord.wgs2gcj(ll[0], ll[1]) : ll;

  const art = D.meta.artboard_lnglat;
  const bounds = [[Math.min(...art.map(p => p[0])), Math.min(...art.map(p => p[1]))], [Math.max(...art.map(p => p[0])), Math.max(...art.map(p => p[1]))]];

  const map = new maplibregl.Map({
    container: 'map', style, bounds, fitBoundsOptions: { padding: 0 }, maxZoom: 19, minZoom: 8,
    attributionControl: { compact: true }, localIdeographFontFamily: "'Microsoft YaHei','PingFang SC','Noto Sans SC',sans-serif",
    canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true }
  });
  window._map = map;
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');

  // ---------- labels as HTML markers holding the original SVG text (vector, system fonts) ----------
  const markers = D.labels.map(l => {
    const el = document.createElement('div');
    el.className = 'lbl lbl-' + l.kind;
    el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${l.box.join(' ')}">${l.svg}</svg>`;
    const m = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(l.lnglat);
    m._l = l; return m;
  });
  function sizeLabels() {
    const s = unitPx(map.getZoom());
    const k = Math.max(0.3, Math.min(s, 0.95));           // 跟随地图缩放，但限制在可读范围
    document.body.classList.toggle('lbl-small', k < 0.5);
    markers.forEach(m => { const svg = m.getElement().firstChild; svg.style.width = (m._l.box[2] * k) + 'px'; svg.style.height = (m._l.box[3] * k) + 'px'; });
  }

  function addDesign() {
    // optional: original Illustrator raster base map, exact placement (affine == Mercator-linear)
    map.addSource('raster', { type: 'image', url: D.raster.dataUri, coordinates: D.raster.corners.map(P) });
    map.addLayer({ id: 'raster', type: 'raster', source: 'raster', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.85 } });
    LAYERS.forEach(L => (L.defs || []).forEach(d => {
      if (L.vectorOnly && !map.getSource(d.source)) return;
      if (!map.getSource(d.source)) map.addSource(d.source, { type: 'geojson', data: fcFor(d.source), tolerance: 0.15, buffer: 64 });
      map.addLayer(Object.assign({ layout: { visibility: L.on ? 'visible' : 'none' } }, d));
    }));
  }
  function refreshCRS(newCrs) {
    if (newCrs === crs) return;
    const c = map.getCenter(); const toW = crs === 'gcj02' ? Coord.gcj2wgs(c.lng, c.lat) : [c.lng, c.lat];
    crs = newCrs;
    Object.keys(D.layers).forEach(k => map.getSource(k) && map.getSource(k).setData(fcFor(k)));
    map.getSource('raster').setCoordinates(D.raster.corners.map(P));
    markers.forEach(m => m.setLngLat(P(m._l.lnglat)));
    map.jumpTo({ center: P(toW) });                        // 保持画面中的设计内容不跳动
  }

  // ---------- basemap switching + auto fallback ----------
  let current = null, loadedTiles = 0, errTiles = 0;
  const vecOrigVis = {}; style.layers.forEach(l => { if (l.id.startsWith('ofm-')) vecOrigVis[l.id] = (vs_vis[l.id] || 'visible'); });
  function setBasemap(id, why) {
    const b = basemaps.find(x => x.id === id) || basemaps[0];
    basemaps.forEach(x => x.tiles && map.setLayoutProperty('bm-' + x.id, 'visibility', x.id === b.id ? 'visible' : 'none'));
    vecLayers.forEach(id => map.setLayoutProperty(id, 'visibility', b.vector && (vecOrigVis[id] !== 'none') ? 'visible' : 'none'));
    if (b.vector) {   // apply / revert design palette
      Object.entries(DESIGN_PALETTE).forEach(([id, props]) => { if (!map.getLayer(id)) return;
        Object.keys(props).forEach(p => map.setPaintProperty(id, p, b.palette === 'design' ? props[p] : vecOrig[id][p])); });
      map.setPaintProperty('bg', 'background-color', b.palette === 'design' ? '#000' : ((vecOrig.background || {})['background-color'] || '#0c0c0c'));
    } else map.setPaintProperty('bg', 'background-color', '#000');
    current = b.id; loadedTiles = 0; errTiles = 0;
    refreshCRS(b.crs);
    document.querySelectorAll('input[name=bm]').forEach(r => r.checked = r.value === b.id);
    document.getElementById('crsinfo').textContent = b.crs === 'gcj02' ? '坐标：GCJ-02（设计图层已自动偏移）' : '坐标：WGS84';
    if (why) toast(why);
  }
  const srcOf = id => { const b = basemaps.find(x => x.id === id); return b && b.vector ? 'ofm-openmaptiles' : 'bm-' + id; };
  map.on('sourcedata', e => { if (e.tile && e.sourceId === srcOf(current)) loadedTiles++; });
  map.on('error', e => {
    if (e.sourceId && e.sourceId === srcOf(current)) {
      errTiles++;
      if (CFG.autoFallback && current !== CFG.autoFallback && errTiles >= 4 && loadedTiles === 0)
        setBasemap(CFG.autoFallback, '海外底图加载失败，已自动切换到「高德 暗色」');
    }
  });
  setTimeout(() => { if (current === CFG.defaultBasemap && loadedTiles === 0 && CFG.autoFallback && !map.areTilesLoaded())
      setBasemap(CFG.autoFallback, '底图加载过慢，已自动切换到「高德 暗色」'); }, 9000);

  // ---------- UI ----------
  function toast(t) { const el = document.getElementById('toast'); el.textContent = t; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 4000); }
  function buildPanel() {
    const bm = document.getElementById('bm-list');
    bm.innerHTML = basemaps.map(b => `<label><input type="radio" name="bm" value="${b.id}"> ${b.name}</label>`).join('');
    bm.addEventListener('change', e => setBasemap(e.target.value));
    const ly = document.getElementById('ly-list');
    ly.innerHTML = LAYERS.map(L => `<label><input type="checkbox" data-k="${L.key}" ${L.on ? 'checked' : ''}> ${L.name}</label>`).join('');
    ly.addEventListener('change', e => setLayer(e.target.dataset.k, e.target.checked));
    document.getElementById('op').addEventListener('input', e => setOpacity(+e.target.value / 100));
    document.getElementById('reset').onclick = () => map.fitBounds(bounds.map(P), { padding: 0, duration: 800 });
    document.getElementById('toggle').onclick = () => document.getElementById('panel').classList.toggle('collapsed');
  }
  function setLayer(k, on) {
    const L = LAYERS.find(x => x.key === k); L.on = on;
    if (k === 'labels') { markers.forEach(m => on ? m.addTo(map) : m.remove()); return; }
    if (k === 'raster') { map.setLayoutProperty('raster', 'visibility', on ? 'visible' : 'none'); return; }
    L.defs.forEach(d => map.getLayer(d.id) && map.setLayoutProperty(d.id, 'visibility', on ? 'visible' : 'none'));
    if (k === 'check' && on && !(basemaps.find(b => b.id === current) || {}).vector) toast('校核水系来自 OSM 矢量底图（WGS84），在高德底图下会有约 500 m 偏差，请切到「OSM 矢量」底图查看');
  }
  function scaleExpr(e, f) {   // 透明度 × f（zoom 插值表达式需逐个 stop 相乘）
    if (typeof e === 'number') return e * f;
    if (Array.isArray(e) && e[0] === 'interpolate') return e.map((v, i) => (i >= 4 && i % 2 === 0) ? scaleExpr(v, f) : v);
    return ['*', e, f];
  }
  function setOpacity(f) {
    LAYERS.forEach(L => (L.defs || []).forEach(d => {
      if (L.key === 'check' || !map.getLayer(d.id)) return;
      const prop = opacityProps[d.type]; const base = d.paint[prop];
      map.setPaintProperty(d.id, prop, scaleExpr(base, f));
    }));
    document.querySelectorAll('.lbl').forEach(el => el.style.opacity = Math.min(1, f * 1.2));
  }

  map.on('load', () => {
    addDesign(); buildPanel();
    const params = new URLSearchParams(location.search);
    setBasemap(params.get('basemap') || CFG.defaultBasemap);
    markers.forEach(m => m.addTo(map)); sizeLabels();
    map.on('zoom', sizeLabels);
    if (params.get('view')) { const [lng, lat, z] = params.get('view').split(',').map(Number); map.jumpTo({ center: P([lng, lat]), zoom: z }); }
    (params.get('on') || '').split(',').filter(Boolean).forEach(k => { setLayer(k, true); const cb = document.querySelector(`[data-k="${k}"]`); if (cb) cb.checked = true; });
    (params.get('off') || '').split(',').filter(Boolean).forEach(k => { setLayer(k, false); const cb = document.querySelector(`[data-k="${k}"]`); if (cb) cb.checked = false; });
    if (params.has('nopanel')) document.getElementById('panel').classList.add('collapsed');
    map.once('idle', () => document.body.dataset.ready = '1');
  });
})();
