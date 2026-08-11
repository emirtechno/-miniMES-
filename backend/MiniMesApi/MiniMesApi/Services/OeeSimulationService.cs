using Microsoft.Extensions.Options;
using MiniMesApi.DTOs;
using MiniMesApi.Models;
using MiniMesApi.Options;

namespace MiniMesApi.Services
{
    // NEDEN: Gerçek PLC olmadığı için demo fabrikayı arka planda “canlı” tutar.
    // Her ~15 sn tick üretir → MetricIngest → MachineMetrics + WO ilerlemesi + Andon/OEE panoları.
    // NASIL: BackgroundService döngüsü; SimulationControl açıkken her aktif istasyon için
    // StationRuntime heal → (gerekirse catch-up downtime) → BuildTick → IngestAsync.
    public class OeeSimulationService : BackgroundService
    {
        private static readonly IReadOnlyCollection<string> Stations = StationCatalog.Active;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<OeeSimulationService> _logger;
        private readonly TimeSpan _interval;
        private readonly int _intervalSeconds;

        // NEDEN: Bilinmeyen istasyon / geriye uyum için varsayılan ICT (aktif hatlar profil kullanır).
        internal const double IdealCycleTimeSeconds = 2;

        // NEDEN: Varsayılan mikro-duruş — profil yoksa kullanılır.
        internal const double MicroDowntimeProbability = 0.03;

        // NEDEN: Varsayılan fire oranı — profil yoksa kullanılır (aktif hatlar station profile ile ayrışır).
        internal const double ScrapProbability = 0.046;

        // NEDEN: Andon'da tüm hatlar aynı A/P/Q göstermesin — MES'e uygun istasyon karakteri.
        // Chaos değil: montaj hızlı/stabil, test darboğaz + daha çok NOK, paketleme-2 yaşlı hat.
        internal readonly record struct StationSimProfile(
            double IdealCycleTimeSeconds,
            double PerformanceMin,
            double PerformanceMax,
            double ScrapProbability,
            int MaxScrapPerTick,
            double MicroDowntimeProbability,
            int MaxMicroDowntimeSeconds);

        // NEDEN: Nadir sıcaklık aşımı (≥85 °C) → TelemetryAnomaly alarm demosu. Oranlar düşük tutulur (×0.8 demosu için seyreklik).
        internal const double ExtremeTemperatureProbability = 0.0032;

        // NEDEN: Üretimde düşük RPM (&lt;500) anomali demosu — daha da seyrek.
        internal const double ExtremeRpmProbability = 0.0016;

        // NEDEN: Kritik titreşim (≥2.8 mm/s) anomali demosu.
        internal const double ExtremeVibrationProbability = 0.0032;

        // NEDEN: Uzun Idle/vardiyasız boşluklar katalog OEE'yi sıfırlamasın diye catch-up tavanı (120 sn).
        // Operatör molası yine kayda geçer; saatlerce demo duraklaması Availability'yi sıfırlamaz.
        internal const int MaxCatchUpSeconds = 120;

        public OeeSimulationService(
            IServiceScopeFactory scopeFactory,
            IOptions<OeeSimulationOptions> options,
            ILogger<OeeSimulationService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
            _intervalSeconds = Math.Max(options.Value.IntervalSeconds, 1);
            _interval = TimeSpan.FromSeconds(_intervalSeconds);
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation(
                "OEE simülasyon servisi {IntervalSeconds} saniye aralıkla başlatıldı.",
                _intervalSeconds);

            var retryDelay = TimeSpan.FromSeconds(5);
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await WriteMetricsAsync(stoppingToken);
                    retryDelay = TimeSpan.FromSeconds(5);
                    await Task.Delay(_interval, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(
                        ex,
                        "OEE simülasyon verisi yazılamadı. {RetrySeconds} saniye sonra yeniden denenecek.",
                        retryDelay.TotalSeconds);
                    await Task.Delay(retryDelay, stoppingToken);
                    retryDelay = TimeSpan.FromSeconds(Math.Min(retryDelay.TotalSeconds * 2, 60));
                }
            }
        }

        private async Task WriteMetricsAsync(CancellationToken cancellationToken)
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var simulationControl = scope.ServiceProvider.GetRequiredService<IFactorySimulationControl>();
            var simEnabled = await simulationControl.IsEnabledAsync(cancellationToken);
            if (!ShouldRunSimulationTicks(simEnabled))
            {
                _logger.LogDebug("OEE simülasyon kapalı (SimulationControl) — tick atlandı.");
                return;
            }

            var ingest = scope.ServiceProvider.GetRequiredService<IMetricIngestService>();
            var runtimeService = scope.ServiceProvider.GetRequiredService<IStationRuntimeService>();
            var recordedAt = DateTimeOffset.UtcNow;
            // NEDEN: Katalog saat kodu — MetricIngest da RecordedAt'tan aynı kodu çözer (çift kaynak tutarlılığı).
            var catalogShiftCode = ShiftCatalog.ResolveForUtc(recordedAt);
            var wroteAny = false;

            foreach (var stationId in Stations)
            {
                // NEDEN: Heal Mode/UpdatedAt'ı temizleyebilir; catch-up için pause başlangıcını önce snapshot'la.
                var runtimeBefore = await runtimeService.GetOrCreateAsync(stationId, cancellationToken);
                var priorMode = runtimeBefore.Mode;
                var pauseAnchor = runtimeBefore.UpdatedAt;
                var pauseReason = runtimeBefore.PauseReason;

                // NEDEN: Aktif vardiya + engelleyici alarm yok → Running; mola/setup → Paused; engelleyici → Paused/Down.
                // NASIL: HealRuntimeForStationAsync durumu düzeltir; engelleyici varsa üretim tick'i yazılmaz.
                var mode = await runtimeService.HealRuntimeForStationAsync(stationId, cancellationToken);
                var blocked = await runtimeService.HasOpenBlockingAlarmAsync(stationId, cancellationToken);
                var isRunning = mode == StationRuntimeModes.Running && !blocked;

                // NEDEN: Paused/Down durumu StationRuntime'da (Andon DURAKLADI) — aynı tick'leri spam etme.
                if (!ShouldIngestProductionTick(isRunning))
                    continue;

                // NEDEN: Duraklamadan Running'e dönüşte atlanan downtime'ı tek catch-up metriğiyle kapat (max 120 sn).
                if (ShouldWriteCatchUp(priorMode, isRunning))
                {
                    var catchUp = BuildCatchUpDowntimeTick(
                        stationId,
                        priorMode,
                        pauseAnchor,
                        recordedAt,
                        catalogShiftCode,
                        pauseReason);
                    if (catchUp is not null)
                    {
                        await ingest.IngestAsync(catchUp, cancellationToken);
                        wroteAny = true;
                    }
                }

                var dto = BuildTick(
                    stationId,
                    mode,
                    isRunning: true,
                    recordedAt,
                    catalogShiftCode,
                    _intervalSeconds,
                    pauseReason: null);
                await ingest.IngestAsync(dto, cancellationToken);
                wroteAny = true;
            }

            if (wroteAny)
                _logger.LogDebug("OEE simülasyon verisi {RecordedAt} zamanında kaydedildi.", recordedAt);
            else
                _logger.LogDebug("OEE simülasyon: tüm istasyonlar Paused/Down — tick atlandı ({RecordedAt}).", recordedAt);
        }

        // NEDEN: DB/runtime kapısı — kapalıysa hiç istasyon tick'i yazılmaz (ingest yok).
        internal static bool ShouldRunSimulationTicks(bool controlEnabled) => controlEnabled;

        // NEDEN: Sadece Running istasyonlar aralık tick'i yazar; Paused/Down ingest atlar.
        internal static bool ShouldIngestProductionTick(bool isRunning) => isRunning;

        // NEDEN: Heal sonrası Paused/Down → Running geçişinde bir catch-up downtime metriği yaz.
        internal static bool ShouldWriteCatchUp(string priorMode, bool isRunningNow) =>
            isRunningNow
            && priorMode is StationRuntimeModes.Paused or StationRuntimeModes.Down;

        // NEDEN: Pause süresi StationRuntime.UpdatedAt'tan; [0, maxCatchUpSeconds] ile sınırlanır.
        internal static int ComputeCatchUpSeconds(
            DateTimeOffset pauseStartedAt,
            DateTimeOffset now,
            int maxCatchUpSeconds = MaxCatchUpSeconds)
        {
            var max = Math.Max(maxCatchUpSeconds, 1);
            var elapsed = (now - pauseStartedAt).TotalSeconds;
            if (double.IsNaN(elapsed) || double.IsInfinity(elapsed) || elapsed < 1)
                return 0;
            return (int)Math.Min(Math.Floor(elapsed), max);
        }

        // NEDEN: Ingest atlanırken kaçırılan duruşu tek metrikte kapatır — vardiya OEE downtime'ı unutmaz.
        // NASIL: saniye < 1 ise null; aksi halde isRunning=false BuildTick (tam pencere downtime).
        internal static CreateMachineMetricDto? BuildCatchUpDowntimeTick(
            string stationId,
            string priorMode,
            DateTimeOffset pauseStartedAt,
            DateTimeOffset recordedAt,
            string shiftCode,
            string? pauseReason = null,
            int maxCatchUpSeconds = MaxCatchUpSeconds)
        {
            var seconds = ComputeCatchUpSeconds(pauseStartedAt, recordedAt, maxCatchUpSeconds);
            if (seconds < 1)
                return null;

            return BuildTick(
                stationId,
                priorMode,
                isRunning: false,
                recordedAt,
                shiftCode,
                intervalSeconds: seconds,
                pauseReason);
        }

        // NEDEN: Planned = simülasyon aralığı (gerçek zamanlı demo), 300 sn batch değil.
        // Running → istasyon profiline göre üretim/fire/mikro-duruş; değilse → tam pencere downtime (catch-up).
        internal static CreateMachineMetricDto BuildTick(
            string stationId,
            string mode,
            bool isRunning,
            DateTimeOffset recordedAt,
            string shiftCode,
            int intervalSeconds = 15,
            string? pauseReason = null)
        {
            var planned = Math.Max(intervalSeconds, 1);
            var profile = ResolveStationProfile(stationId);

            double downtimeSeconds;
            string downtimeReason;
            int totalProduced;
            int scrapCount;

            if (isRunning)
            {
                // NEDEN: Teorik kapasite × hat performans bandı (±1 jitter) — istasyonlar ayrışır.
                var maxByCycle = Math.Max(1, (int)Math.Floor(planned / profile.IdealCycleTimeSeconds));
                var factor = profile.PerformanceMin
                    + Random.Shared.NextDouble() * (profile.PerformanceMax - profile.PerformanceMin);
                var target = (int)Math.Round(maxByCycle * factor, MidpointRounding.AwayFromZero);
                totalProduced = Math.Clamp(target + Random.Shared.Next(-1, 2), 1, Math.Max(1, maxByCycle + 1));

                scrapCount = 0;
                if (Random.Shared.NextDouble() < profile.ScrapProbability && totalProduced > 0)
                {
                    var maxScrap = Math.Min(profile.MaxScrapPerTick, totalProduced);
                    scrapCount = maxScrap <= 1 ? 1 : Random.Shared.Next(1, maxScrap + 1);
                }

                // NEDEN: Genelde temiz; hat tipine göre nadir kısa duruş (Availability'yi hafif ezer).
                if (Random.Shared.NextDouble() < profile.MicroDowntimeProbability)
                {
                    var maxDt = Math.Max(0, profile.MaxMicroDowntimeSeconds);
                    downtimeSeconds = maxDt == 0
                        ? 0
                        : Math.Min(planned, Random.Shared.Next(1, maxDt + 1));
                    downtimeReason = downtimeSeconds > 0
                        ? DowntimeReasonCatalog.Other
                        : DowntimeReasonCatalog.None;
                }
                else
                {
                    downtimeSeconds = 0;
                    downtimeReason = DowntimeReasonCatalog.None;
                }
            }
            else
            {
                totalProduced = 0;
                scrapCount = 0;
                downtimeSeconds = planned;
                downtimeReason = ResolveStableDowntimeReason(mode, pauseReason);
            }

            var good = Math.Max(0, totalProduced - scrapCount);
            var (temperature, rpm, vibration) = GeneratePhysicalGauges(isRunning);

            return new CreateMachineMetricDto
            {
                StationId = stationId,
                PlannedProductionSeconds = planned,
                DowntimeSeconds = downtimeSeconds,
                DowntimeReasonCode = downtimeReason,
                ShiftCode = shiftCode,
                IdealCycleTimeSeconds = profile.IdealCycleTimeSeconds,
                ActualProductionCount = totalProduced,
                GoodProductionCount = good,
                Temperature = temperature,
                Rpm = rpm,
                Vibration = vibration,
                RecordedAt = recordedAt
            };
        }

        // NEDEN: Hat tipi → ICT / performans bandı / fire / mikro-duruş (demo Andon çeşitliliği).
        internal static StationSimProfile ResolveStationProfile(string stationId) =>
            stationId switch
            {
                // Montaj: hızlı, stabil, düşük fire
                StationCatalog.AssemblyLine1 => new(
                    IdealCycleTimeSeconds: 2.0,
                    PerformanceMin: 0.88,
                    PerformanceMax: 0.98,
                    ScrapProbability: 0.018,
                    MaxScrapPerTick: 1,
                    MicroDowntimeProbability: 0.02,
                    MaxMicroDowntimeSeconds: 3),
                // Elektronik: biraz daha hızlı, orta fire
                StationCatalog.ElectronicsBoardAssembly => new(
                    IdealCycleTimeSeconds: 1.8,
                    PerformanceMin: 0.90,
                    PerformanceMax: 1.00,
                    ScrapProbability: 0.028,
                    MaxScrapPerTick: 1,
                    MicroDowntimeProbability: 0.015,
                    MaxMicroDowntimeSeconds: 2),
                // Test: darboğaz (yüksek ICT), daha çok NOK — Quality %100'de takılmaz
                StationCatalog.TestAndQuality => new(
                    IdealCycleTimeSeconds: 3.2,
                    PerformanceMin: 0.72,
                    PerformanceMax: 0.90,
                    ScrapProbability: 0.09,
                    MaxScrapPerTick: 2,
                    MicroDowntimeProbability: 0.035,
                    MaxMicroDowntimeSeconds: 4),
                // Paketleme 1: stabil
                StationCatalog.PackagingLine1 => new(
                    IdealCycleTimeSeconds: 2.2,
                    PerformanceMin: 0.86,
                    PerformanceMax: 0.97,
                    ScrapProbability: 0.012,
                    MaxScrapPerTick: 1,
                    MicroDowntimeProbability: 0.025,
                    MaxMicroDowntimeSeconds: 3),
                // Paketleme 2: yaşlı hat — daha düşük perf + daha sık mikro-duruş
                StationCatalog.PackagingLine2 => new(
                    IdealCycleTimeSeconds: 2.4,
                    PerformanceMin: 0.70,
                    PerformanceMax: 0.88,
                    ScrapProbability: 0.022,
                    MaxScrapPerTick: 1,
                    MicroDowntimeProbability: 0.06,
                    MaxMicroDowntimeSeconds: 5),
                // Final kontrol: yavaş tempo, düşük fire, az duruş
                StationCatalog.FinalInspection => new(
                    IdealCycleTimeSeconds: 3.5,
                    PerformanceMin: 0.80,
                    PerformanceMax: 0.94,
                    ScrapProbability: 0.015,
                    MaxScrapPerTick: 1,
                    MicroDowntimeProbability: 0.012,
                    MaxMicroDowntimeSeconds: 2),
                _ => new(
                    IdealCycleTimeSeconds: IdealCycleTimeSeconds,
                    PerformanceMin: 0.85,
                    PerformanceMax: 0.98,
                    ScrapProbability: ScrapProbability,
                    MaxScrapPerTick: 1,
                    MicroDowntimeProbability: MicroDowntimeProbability,
                    MaxMicroDowntimeSeconds: 3)
            };

        // NEDEN: Catch-up downtime nedeni her tick'te dönmesin diye PauseReason/mode → katalog kodu.
        // NASIL: Metin anahtar kelimeleri (mola, setup, alarm…) → DowntimeReasonCatalog sabitleri.
        internal static string ResolveStableDowntimeReason(string mode, string? pauseReason)
        {
            if (!string.IsNullOrWhiteSpace(pauseReason))
            {
                var text = pauseReason.Trim();
                if (ContainsAny(text, "Setup", "model değişimi", "CHANGEOVER", "Changeover"))
                    return DowntimeReasonCatalog.Changeover;
                if (ContainsAny(text, "mola", "Mola", "break", "Break", "NO_OPERATOR"))
                    return DowntimeReasonCatalog.NoOperator;
                if (ContainsAny(text, "bakım", "Bakım", "PLANNED_MAINTENANCE", "maintenance"))
                    return DowntimeReasonCatalog.PlannedMaintenance;
                if (ContainsAny(text, "Malzeme", "MATERIAL"))
                    return DowntimeReasonCatalog.MaterialShortage;
                if (ContainsAny(text, "Kalite", "QUALITY"))
                    return DowntimeReasonCatalog.QualityHold;
                if (ContainsAny(text, "Alarm", "Arıza", "ARIZA", "BREAKDOWN", "Emergency", "Acil", "engelleyici"))
                    return DowntimeReasonCatalog.Breakdown;
            }

            return mode == StationRuntimeModes.Down
                ? DowntimeReasonCatalog.Breakdown
                : DowntimeReasonCatalog.Other;
        }

        private static bool ContainsAny(string text, params string[] tokens) =>
            tokens.Any(token => text.Contains(token, StringComparison.OrdinalIgnoreCase));

        // NEDEN: Running → çoğunlukla sağlıklı göstergeler + nadir aşım (anomali demosu).
        // Paused/Down → düşük/idle göstergeler. İstasyon başına cooldown Andon spam'ini keser.
        internal static (double Temperature, double Rpm, double Vibration) GeneratePhysicalGauges(bool isRunning)
        {
            if (!isRunning)
            {
                return (
                    Math.Round(28 + Random.Shared.NextDouble() * 12, 1),
                    Math.Round(Random.Shared.NextDouble() * 80, 0),
                    Math.Round(0.05 + Random.Shared.NextDouble() * 0.25, 2));
            }

            // NEDEN: Aşımlar seyrek kalsın (demo oturumu); istasyon cooldown'u Andon spam'ini engeller.
            var temperature = Random.Shared.NextDouble() < ExtremeTemperatureProbability
                ? 85 + Random.Shared.NextDouble() * 12
                : 45 + Random.Shared.NextDouble() * 35;
            var rpm = Random.Shared.NextDouble() < ExtremeRpmProbability
                ? 200 + Random.Shared.NextDouble() * 250
                : 800 + Random.Shared.NextDouble() * 1000;
            var vibration = Random.Shared.NextDouble() < ExtremeVibrationProbability
                ? 2.8 + Random.Shared.NextDouble() * 1.2
                : 0.3 + Random.Shared.NextDouble() * 2.2;

            return (
                Math.Round(temperature, 1),
                Math.Round(rpm, 0),
                Math.Round(vibration, 2));
        }
    }
}
