/**
 * Canonical factory layout: multiple assembly / packaging / test lines.
 * `id` values must match backend StationCatalog codes.
 */
export const STATION_DEFINITIONS = [
  {
    id: 'Montaj_Hatti_01',
    displayName: 'Montaj Hattı 1',
    line: 'Montaj Hattı',
    lineCode: 'MONTAJ',
    area: 'Ana Montaj',
    description: 'Panel / gövde ana montaj hattı. Operatör üretim kaydı girer.',
  },
  {
    id: 'Montaj_Hatti_02',
    displayName: 'Montaj Hattı 2',
    line: 'Montaj Hattı',
    lineCode: 'MONTAJ',
    area: 'Ana Montaj',
    description: 'İkinci paralel montaj hattı; kapasite dengeleme için kullanılır.',
  },
  {
    id: 'Montaj_Hatti_03',
    displayName: 'Montaj Hattı 3',
    line: 'Montaj Hattı',
    lineCode: 'MONTAJ',
    area: 'Ana Montaj',
    description: 'Üçüncü montaj hattı; yüksek talep dönemlerinde devreye alınır.',
  },
  {
    id: 'Elektronik_Kart_Montaj',
    displayName: 'Elektronik Kart Montaj',
    line: 'Elektronik',
    lineCode: 'ELEKTRONIK',
    area: 'Elektronik',
    description: 'Kart ve elektronik alt montaj istasyonu.',
  },
  {
    id: 'Test_Ve_Kalite_Istasyonu',
    displayName: 'Test ve Kalite',
    line: 'Kalite',
    lineCode: 'KALITE',
    area: 'Kalite Kontrol',
    description: 'Fonksiyonel test ve kalite kontrol noktası.',
  },
  {
    id: 'Paketleme_Hatti_01',
    displayName: 'Paketleme Hattı 1',
    line: 'Paketleme Hattı',
    lineCode: 'PAKET',
    area: 'Paketleme',
    description: 'Birincil paketleme ve barkod doğrulama hattı.',
  },
  {
    id: 'Paketleme_Hatti_02',
    displayName: 'Paketleme Hattı 2',
    line: 'Paketleme Hattı',
    lineCode: 'PAKET',
    area: 'Paketleme',
    description: 'İkinci paketleme hattı; sevkiyat öncesi hazırlık.',
  },
  {
    id: 'Final_Kontrol',
    displayName: 'Final Kontrol',
    line: 'Sevkiyat',
    lineCode: 'SEVKIYAT',
    area: 'Sevkiyat',
    description: 'Sevkiyat öncesi son görsel / işlevsel kontrol.',
  },
  // Keep legacy packaging/test code for older records & seeds.
  {
    id: 'Test_Ve_Paketleme_Istasyonu',
    displayName: 'Test ve Paketleme (Eski)',
    line: 'Kalite',
    lineCode: 'KALITE',
    area: 'Kalite Kontrol',
    description: 'Eski birleşik test/paketleme kodu — geriye dönük kayıtlar için korunur.',
    legacy: true,
  },
];

export const STATIONS = STATION_DEFINITIONS.map((station) => station.id);

export const DEFAULT_STATION = 'Montaj_Hatti_01';

export const ACTIVE_STATION_DEFINITIONS = STATION_DEFINITIONS.filter((station) => !station.legacy);

export const STATION_BY_ID = Object.fromEntries(
  STATION_DEFINITIONS.map((station) => [station.id, station]),
);

export function getStationDisplayName(stationId) {
  return STATION_BY_ID[stationId]?.displayName || stationId || 'Bilinmeyen İstasyon';
}

export function getStationMeta(stationId) {
  return STATION_BY_ID[stationId] || {
    id: stationId,
    displayName: stationId,
    line: 'Diğer',
    lineCode: 'DIGER',
    area: 'Diğer',
    description: 'Katalog dışı istasyon kodu.',
  };
}

export const isCanonicalStation = (stationId) => STATIONS.includes(stationId);

export const PRODUCTION_LINES = [...new Set(ACTIVE_STATION_DEFINITIONS.map((s) => s.line))];
