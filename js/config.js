/* ============================================================
 * 茅洲河中游 · 交互地图 —— 配置
 * 想换底图 / 接入 Mapbox，只改这个文件。
 * ============================================================ */
window.MAP_CONFIG = {
  // 默认底图（id 见下方 basemaps）。若海外底图在国内打不开/太慢，页面会自动切到高德暗色。
  defaultBasemap: 'ofm-design',
  autoFallback: 'amap-dark',

  // ---------- Mapbox（可选） ----------
  // 1) 在 https://account.mapbox.com 拿一个 public token（pk. 开头）填到 token；
  // 2) style 填 "用户名/样式ID"，例如官方暗色 'mapbox/dark-v11'，或你在 Mapbox Studio 做的样式；
  // 3) 刷新页面，底图列表里会多出 “Mapbox” 一项。
  // 说明：这里用 Mapbox 的栅格瓦片接口（Static Tiles API），无需改代码；
  //       若要用 Mapbox 矢量样式，可把 lib/maplibre-gl.js 换成 mapbox-gl.js（API 基本一致）。
  mapbox: {
    token: '',                 // 例如 'pk.eyJ1Ijoi...'
    style: 'mapbox/dark-v11',
    crs: 'wgs84'               // 国际版 Mapbox 为 WGS84；若用 Mapbox 中国(mapbox.cn)样式改成 'gcj02'
  },

  // ---------- 底图列表 ----------
  // crs: 'wgs84' 国际标准坐标；'gcj02' 国测局坐标（高德/腾讯/谷歌中国），设计图层会自动做偏移纠正。
  basemaps: [
    // OpenFreeMap：免费、无需 token 的 OSM 矢量底图。'ofm-design' 在其暗色样式上改成本设计的配色（黑底/青灰水体/墨绿山体）。
    { id: 'ofm-design', name: 'OSM 矢量 · 设计配色', crs: 'wgs84', vector: 'https://tiles.openfreemap.org/styles/dark', palette: 'design',
      attribution: '© OpenStreetMap contributors · OpenFreeMap' },
    { id: 'ofm-dark', name: 'OSM 矢量 · 暗色', crs: 'wgs84', vector: 'https://tiles.openfreemap.org/styles/dark',
      attribution: '© OpenStreetMap contributors · OpenFreeMap' },
    // 注：CARTO dark-matter 栅格瓦片(basemaps.cartocdn.com) 现已要求 API key（无 key 返回水印图），故未列入。
    { id: 'amap-dark', name: '高德 暗色（国内快）', crs: 'gcj02', tileSize: 256, maxzoom: 18,
      tiles: [1,2,3,4].map(n => `https://webrd0${n}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=2&style=8&x={x}&y={y}&z={z}`),
      // 高德只有浅色瓦片：用栅格亮度反相 + 色相旋转做成暗色
      paint: { 'raster-brightness-min': 0.92, 'raster-brightness-max': 0, 'raster-hue-rotate': 180, 'raster-saturation': -0.6, 'raster-contrast': 0.25 },
      attribution: '© 高德地图 AutoNavi' },
    { id: 'amap-sat', name: '高德 卫星', crs: 'gcj02', tileSize: 256, maxzoom: 18,
      tiles: [1,2,3,4].map(n => `https://webst0${n}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}`),
      paint: { 'raster-brightness-max': 0.65, 'raster-saturation': -0.3 },
      attribution: '© 高德地图 AutoNavi' },
    { id: 'esri-sat', name: 'Esri 卫星（海外）', crs: 'wgs84', tileSize: 256, maxzoom: 19,
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      paint: { 'raster-brightness-max': 0.65, 'raster-saturation': -0.3 },
      attribution: 'Imagery © Esri' },
    { id: 'none', name: '纯黑（同原图）', crs: 'wgs84', tiles: null }
  ]
};
