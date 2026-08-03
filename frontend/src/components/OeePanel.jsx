const Gauge = ({ label, value, detail }) => {
  const isAvailable = typeof value === 'number' && !isNaN(value);
  const normalizedValue = isAvailable ? Math.max(0, Math.min(value, 100)) : 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const color = normalizedValue >= 85 ? '#10b981' : normalizedValue >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <article className="oee-gauge">
      <div className="oee-gauge-visual">
        <svg viewBox="0 0 110 70" aria-hidden="true">
          <path className="oee-gauge-track" d="M 13 58 A 42 42 0 0 1 97 58" />
          {isAvailable && (
            <path
              className="oee-gauge-value"
              d="M 13 58 A 42 42 0 0 1 97 58"
              style={{ stroke: color, strokeDasharray: `${(circumference / 2) * (normalizedValue / 100)} ${circumference}` }}
            />
          )}
        </svg>
        <strong style={{ color: isAvailable ? color : '#94a3b8' }}>{isAvailable ? `%${normalizedValue.toFixed(1)}` : '—'}</strong>
      </div>
      <span>{label}</span>
      <small>{detail}</small>
    </article>
  );
};

const OeePanel = ({ records = [] }) => {
  const totalProduction = records.length;
  const goodProduction = records.filter((r) => r.kaliteDurumu === 'OK').length;

  // --- SAHADA ÜRETİLEN VERİLERE BAĞLI SENKRON HESAPLAMA ---
  // Bağımsız zamanlayıcılar yerine, toplam üretim adedine ve son kayda dayalı türetilmiş fabrika simülasyonu
  
  // 1. Kalite (Q) = Tamamen gerçek veritabanı verisi
  const quality = totalProduction > 0 ? (goodProduction / totalProduction) * 100 : 0;

  // 2. Kullanılabilirlik (A) = Toplam üretime bağlı kararlı simülasyon (Üretim arttıkça hafifçe gerçekçi dalgalanır)
  // İlk açılışta veya 0 kayıtta 0 başlar, veri geldikçe oturur.
  const downtime = totalProduction > 0 ? 25 + (totalProduction % 7) * 2 : 30; // Duruş süresi (dk)
  const plannedTime = 480; // Vardiya planlanan süre
  const availability = totalProduction > 0 ? ((plannedTime - downtime) / plannedTime) * 100 : 0;

  // 3. Performans (P) = Son üretilen kaydın karakteristiğine bağlı hız simülaskunu
  const targetSpeed = 120;
  // Her yeni kayıtta farklı bir performans üretmek için record uzunluğunu hash mantığıyla kullanalım
  const currentSpeed = totalProduction > 0 ? 100 + ((totalProduction * 13) % 25) : 0; 
  let performance = (currentSpeed / targetSpeed) * 100;
  if (performance > 100) performance = 100;

  // 4. OEE = (A x P x Q) / 10000
  const oee = totalProduction > 0 ? (availability * performance * quality) / 10000 : 0;

  const lastUpdated = totalProduction > 0 ? new Date().toLocaleTimeString() : 'Bekleniyor...';

  return (
    <section className="custom-card oee-panel">
      <div className="card-header oee-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span>OEE / Hat Verimliliği</span>
          <small>Son Güncelleme: {lastUpdated}</small>
        </div>
      </div>

      <div className="oee-grid">
        <Gauge 
          label="Kullanılabilirlik" 
          value={availability} 
          detail={`Çalışma: ${plannedTime - downtime} dk / Duruş: ${downtime} dk`} 
        />
        <Gauge 
          label="Performans" 
          value={performance} 
          detail={`Hız: ${currentSpeed} / ${targetSpeed} (Birim/Saat)`} 
        />
        <Gauge 
          label="Kalite" 
          value={quality} 
          detail={`${goodProduction} OK / ${totalProduction} Toplam`} 
        />
        <Gauge 
          label="OEE" 
          value={oee} 
          detail="A x P x Q Bileşimi" 
        />
      </div>
    </section>
  );
};

export default OeePanel;