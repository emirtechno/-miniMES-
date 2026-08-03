export const STATIONS = [
  'Montaj_Hatti_01',
  'Montaj_Hatti_02',
  'Test_Ve_Paketleme_Istasyonu',
];

export const DEFAULT_STATION = STATIONS[0];

export const isCanonicalStation = (stationId) => STATIONS.includes(stationId);
