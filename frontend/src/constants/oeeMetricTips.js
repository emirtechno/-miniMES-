/**
 * OEE / üretim KPI hover metinleri — Andon, OeePanel, metrik panelleri ortak.
 * Kaynak: OeeCalculator (A×P×Q); Andon birincil kapsam oturum varsa ShiftSession, yoksa katalog vardiya.
 */

export const OEE_METRIC_TIPS = {
  oee:
    'OEE (Overall Equipment Effectiveness) = Kullanılabilirlik × Performans × Kalite / 10000. '
    + 'Makinenin planlı sürede ne kadar etkin çalıştığını gösterir. Kaynak: MachineMetrics toplamı.',

  availability:
    'Kullanılabilirlik = (Planlanan süre − Duruş) / Planlanan süre × 100. '
    + 'Hat ne kadar süre üretime hazırdı? Duruş arttıkça düşer. Kaynak: PlannedProductionSeconds / DowntimeSeconds.',

  performance:
    'Performans = (İdeal çevrim × Gerçek adet) / Çalışma süresi × 100. '
    + 'Çalışırken teorik hıza ne kadar yaklaşıldı? Kaynak: IdealCycleTimeSeconds × ActualProductionCount.',

  quality:
    'Kalite = Sağlam adet / Toplam adet × 100. '
    + 'Fire (NOK) arttıkça düşer. Kaynak: GoodProductionCount / ActualProductionCount.',

  goodScrap:
    'Σ Sağlam / Fire = seçili kapsamda (oturum veya katalog vardiya) toplanan OK ve NOK adetleri. '
    + 'Fire = Actual − Good (ScrapLog / NOK tick). Kaynak: MachineMetrics özeti.',

  downtime:
    'Duruş: açık oturumda veya son tick’te kayıtlı duruş nedeni (mola, arıza, setup…). '
    + '“Yok” = bu kapsamda aktif downtime nedeni yok. Kaynak: DowntimeReasonCode / ShiftSession.',

  catalogOee:
    'Katalog OEE: fabrika vardiya saati (A/B/C) penceresinin toplamı. '
    + 'Operatör oturumu başlatınca sıfırlanmaz. API: /Oee/shift-current.',

  sessionOee:
    'Oturum OEE: açık operatör ShiftSession başlangıcından itibaren birikir. '
    + 'Vardiya bitince kapanır. API: /ShiftSession/board.',

  openWorkOrders:
    'Açık iş emri: Planlandı / Üretimde / Beklemede durumundaki WorkOrder sayısı. '
    + 'Tamamlanan veya soft-silinenler dahil değil. API: /WorkOrder.',

  actualTotal:
    'Σ Gerçekleşen = seçili kapsamdaki ActualProductionCount toplamı (OK + NOK). '
    + 'Kaynak: MachineMetrics / katalog vardiya özeti.',

  sessionYield:
    'Oturum verimi ≈ oturum Quality veya Good/Actual. '
    + 'Yanındaki süre = açık ShiftSession uptime. Kaynak: /ShiftSession/active + board.',

  gaugeTemp:
    'Anlık sıcaklık (°C) — son MachineMetrics tick. Aşırı yüksek değer anomali/alarm tetikleyebilir.',

  gaugeRpm:
    'Anlık devir (RPM) — son MachineMetrics tick. Çok düşük RPM anomali demosu olabilir.',

  gaugeVibration:
    'Anlık titreşim (mm/s) — son MachineMetrics tick. ≥2.8 kritik eşik (alarm).',
};
