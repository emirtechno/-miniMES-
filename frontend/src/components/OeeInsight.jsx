import { useMemo } from 'react';
import { Lightbulb, TrendingDown, TrendingUp } from 'lucide-react';

const downtimeTurkish = {
  NONE: 'Duruş yok',
  PLANNED_MAINTENANCE: 'Planlı bakım',
  BREAKDOWN: 'Arıza',
  MATERIAL_SHORTAGE: 'Malzeme eksikliği',
  CHANGEOVER: 'Model değişimi',
  NO_OPERATOR: 'Operatör yok',
  QUALITY_HOLD: 'Kalite bekletmesi',
  OTHER: 'Diğer duruş',
};

/**
 * Plain-Turkish insight under OEE gauges explaining *why* values look the way they do.
 */
const OeeInsight = ({ metric }) => {
  const insight = useMemo(() => {
    if (!metric) {
      return {
        tone: 'neutral',
        title: 'Vardiya OEE Analizi',
        body: 'Bu istasyon için henüz vardiya OEE verisi gelmedi. Simülasyon açıksa birkaç saniye içinde güncellenir; kapalıysa Makine Metrikleri ekranından kayıt ekleyin.',
      };
    }

    const availability = Number(metric.availability) || 0;
    const performance = Number(metric.performance) || 0;
    const quality = Number(metric.quality) || 0;
    const oee = Number(metric.oee) || 0;
    const reasonCode = metric.downtimeReasonCode || metric.downtimeReason || 'NONE';
    const reasonLabel = downtimeTurkish[reasonCode] || metric.downtimeReason || 'Bilinmeyen duruş';
    const shift = metric.shiftName || metric.shiftCode || 'Vardiya bilgisi yok';
    const planned = metric.isPlannedDowntime ? ' (planlı)' : '';

    let driver = 'dengeli';
    let Icon = TrendingUp;
    let tone = 'ok';

    if (availability < 85 && availability <= performance && availability <= quality) {
      driver = 'availability';
      Icon = TrendingDown;
      tone = availability < 60 ? 'nok' : 'warn';
    } else if (quality < 85 && quality <= performance) {
      driver = 'quality';
      Icon = TrendingDown;
      tone = quality < 60 ? 'nok' : 'warn';
    } else if (performance < 85) {
      driver = 'performance';
      Icon = TrendingDown;
      tone = performance < 60 ? 'nok' : 'warn';
    }

    const parts = [
      `Vardiya penceresinde Kalite %${quality.toFixed(1)}, Kullanılabilirlik %${availability.toFixed(1)}, Performans %${performance.toFixed(1)} (OEE %${oee.toFixed(1)}).`,
      `Vardiya: ${shift}.`,
    ];

    if (driver === 'availability') {
      parts.push(
        reasonCode && reasonCode !== 'NONE'
          ? `Düşük kullanılabilirliğin ana nedeni: ${reasonLabel}${planned}.`
          : 'Kullanılabilirlik düşük; duruş kaydı henüz netleşmemiş olabilir.',
      );
    } else if (driver === 'quality') {
      parts.push(
        `Kalite baskın etken: ${metric.goodProduction ?? 0} iyi / ${metric.totalProduction ?? 0} toplam üretim, ${metric.scrapProduction ?? 0} fire.`,
      );
    } else if (driver === 'performance') {
      parts.push('Performans ideal çevrim süresinin altında; hız kaybı veya mikro duruşlar etkili olabilir.');
    } else {
      parts.push(
        reasonCode && reasonCode !== 'NONE'
          ? `Gözlemlenen duruş: ${reasonLabel}${planned}. Genel tablo hedef bandında.`
          : 'Göstergeler hedef bandında; kritik bir sapma sinyali yok.',
      );
    }

    return {
      tone,
      title: 'Vardiya OEE Analizi',
      body: parts.join(' '),
      Icon,
    };
  }, [metric]);

  const toneClass = {
    ok: 'border-emerald-200 bg-emerald-50/80 text-emerald-950',
    warn: 'border-amber-200 bg-amber-50/80 text-amber-950',
    nok: 'border-red-200 bg-red-50/80 text-red-950',
    neutral: 'border-[color:var(--color-line)] bg-slate-50 text-slate-800',
  }[insight.tone];

  const Icon = insight.Icon || Lightbulb;

  return (
    <aside className={`mt-4 flex gap-3 rounded-xl border px-4 py-3 ${toneClass}`} aria-live="polite">
      <span className="mt-0.5 shrink-0 opacity-80" aria-hidden="true">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <div className="font-display text-sm font-semibold tracking-wide">{insight.title}</div>
        <p className="mt-1 text-sm leading-relaxed opacity-90">{insight.body}</p>
      </div>
    </aside>
  );
};

export default OeeInsight;
