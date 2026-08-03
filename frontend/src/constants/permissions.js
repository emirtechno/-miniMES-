/** Maps Identity permission codes to operator-friendly Turkish labels. */
export const PERMISSION_LABELS = {
  'production.write': 'Üretim Verisi Yazma',
  'production.manage': 'Üretim Yönetimi',
  'production.hard-delete': 'Kalıcı Silme',
  'metrics.read': 'Metrikleri Görüntüleme',
  'alarms.write': 'Alarm Oluşturma',
  'alarms.manage': 'Alarm Yönetimi',
  'workorders.manage': 'İş Emri Yönetimi',
  'deleted-records.read': 'Silinen Kayıtları Görme',
  'users.manage': 'Kullanıcı Yönetimi',
};

export const PERMISSION_HINTS = {
  'production.write': 'Yeni üretim kaydı ekleyebilir.',
  'production.manage': 'Kalite durumu değiştirebilir ve kayıt silebilir.',
  'production.hard-delete': 'Çöp kutusundan kalıcı silebilir.',
  'metrics.read': 'OEE ve makine metriklerini görebilir.',
  'alarms.write': 'Yeni alarm açabilir.',
  'alarms.manage': 'Alarm onaylayabilir / silebilir.',
  'workorders.manage': 'İş emri oluşturup ilerletebilir.',
  'deleted-records.read': 'Silinen kayıt listesini görebilir.',
  'users.manage': 'Kullanıcı ve roller yönetebilir.',
};

export function getPermissionLabel(code) {
  return PERMISSION_LABELS[code] || code;
}

export function getPermissionHint(code) {
  return PERMISSION_HINTS[code] || '';
}
