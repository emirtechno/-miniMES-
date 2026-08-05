/** Maps Identity permission codes to operator-friendly Turkish labels. */
export const PERMISSION_LABELS = {
  'production.write': 'Telemetri Yazma (Live Stream)',
  'production.manage': 'Kalite Sınıflandırma',
  'production.hard-delete': 'Kalıcı Silme (kullanım dışı)',
  'metrics.read': 'Metrikleri Görüntüleme',
  'alarms.write': 'Alarm Oluşturma',
  'alarms.manage': 'Alarm Yönetimi',
  'workorders.manage': 'İş Emri Yönetimi',
  'deleted-records.read': 'Silinen Kayıtlar (kullanım dışı)',
  'users.manage': 'Kullanıcı Yönetimi',
  'simulation.control': 'Fabrika Simülasyon / Shop-floor Sıfırlama',
};

export const PERMISSION_HINTS = {
  'production.write': 'Live Stream / sensör telemetrisi yazabilir.',
  'production.manage': 'NOK→OK kalite sınıflandırması yapabilir (kayıt silinmez).',
  'production.hard-delete': 'Eski yetki — telemetri artık silinmez.',
  'metrics.read': 'OEE ve makine metriklerini görebilir.',
  'alarms.write': 'Yeni alarm açabilir.',
  'alarms.manage': 'Alarm onaylayabilir / çözebilir.',
  'workorders.manage': 'İş emri oluşturup ilerletebilir.',
  'deleted-records.read': 'Eski yetki — çöp kutusu kaldırıldı.',
  'users.manage': 'Kullanıcı ve roller yönetebilir.',
  'simulation.control': 'Simülasyon motorunu aç/kapa ve shop-floor telemetri verisini sıfırlayabilir.',
};

export function getPermissionLabel(code) {
  return PERMISSION_LABELS[code] || code;
}

export function getPermissionHint(code) {
  return PERMISSION_HINTS[code] || '';
}
