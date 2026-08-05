using Microsoft.Extensions.Options;
using MiniMesApi.DTOs;
using MiniMesApi.Models;
using MiniMesApi.Options;

namespace MiniMesApi.Services
{
    public class OeeSimulationService : BackgroundService
    {
        private static readonly IReadOnlyCollection<string> Stations = StationCatalog.Active;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<OeeSimulationService> _logger;
        private readonly TimeSpan _interval;
        private readonly int _intervalSeconds;

        /// <summary>Ideal cycle so ~6–7 pieces fit a typical 15s tick near capacity.</summary>
        internal const double IdealCycleTimeSeconds = 2;

        /// <summary>Chance of a brief micro-stop inside a Running tick.</summary>
        internal const double MicroDowntimeProbability = 0.03;

        /// <summary>Chance a running tick includes one scrap unit.</summary>
        internal const double ScrapProbability = 0.04;

        /// <summary>Running-tick chance of a critical temperature excursion (≥85 °C).</summary>
        internal const double ExtremeTemperatureProbability = 0.004;

        /// <summary>Running-tick chance of a low-RPM excursion (&lt;500) while producing.</summary>
        internal const double ExtremeRpmProbability = 0.002;

        /// <summary>Running-tick chance of a critical vibration excursion (≥2.8 mm/s).</summary>
        internal const double ExtremeVibrationProbability = 0.004;

        /// <summary>
        /// Cap resume catch-up so long Idle/no-shift gaps do not dominate catalog OEE.
        /// Operator break downtime still registers; multi-hour demo pauses no longer zero Availability.
        /// </summary>
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
            // Catalog clock code only — MetricIngest also resolves from RecordedAt.
            var catalogShiftCode = ShiftCatalog.ResolveForUtc(recordedAt);
            var wroteAny = false;

            foreach (var stationId in Stations)
            {
                // Snapshot pause anchor before heal — resume may clear Mode/UpdatedAt.
                var runtimeBefore = await runtimeService.GetOrCreateAsync(stationId, cancellationToken);
                var priorMode = runtimeBefore.Mode;
                var pauseAnchor = runtimeBefore.UpdatedAt;
                var pauseReason = runtimeBefore.PauseReason;

                // Active shift + no blocking alarms → Running; OnBreak/InSetup → Paused; blocking → Paused/Down.
                var mode = await runtimeService.HealRuntimeForStationAsync(stationId, cancellationToken);
                var blocked = await runtimeService.HasOpenBlockingAlarmAsync(stationId, cancellationToken);
                var isRunning = mode == StationRuntimeModes.Running && !blocked;

                // Paused/Down: status lives on StationRuntime (Andon DURAKLADI) — do not spam identical ticks.
                if (!ShouldIngestProductionTick(isRunning))
                    continue;

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

        /// <summary>DB/runtime gate: when false, skip all station ticks (no ingest).</summary>
        internal static bool ShouldRunSimulationTicks(bool controlEnabled) => controlEnabled;

        /// <summary>Running stations keep writing interval production ticks; paused/down skip ingest.</summary>
        internal static bool ShouldIngestProductionTick(bool isRunning) => isRunning;

        /// <summary>After heal returns to Running from a prior pause/down, write one catch-up downtime metric.</summary>
        internal static bool ShouldWriteCatchUp(string priorMode, bool isRunningNow) =>
            isRunningNow
            && priorMode is StationRuntimeModes.Paused or StationRuntimeModes.Down;

        /// <summary>
        /// Elapsed pause seconds from StationRuntime.UpdatedAt, clamped to [0, maxCatchUpSeconds].
        /// </summary>
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

        /// <summary>
        /// One downtime metric covering the pause gap so shift OEE does not ignore downtime while ingest was skipped.
        /// Returns null when the gap is negligible.
        /// </summary>
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

        /// <summary>
        /// Interval-aligned tick: Planned = simulation interval (real-time demo), not a 300s batch.
        /// Running → production for this window (rare micro-downtime).
        /// Not-running → full-window downtime (used for resume catch-up, not per-interval spam).
        /// </summary>
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

            double downtimeSeconds;
            string downtimeReason;
            int totalProduced;
            int scrapCount;

            if (isRunning)
            {
                // Near capacity: IdealCycleTimeSeconds=2 → ~7 pcs / 15s planned window.
                var maxByCycle = Math.Max(1, (int)Math.Floor(planned / IdealCycleTimeSeconds));
                var minCount = Math.Max(1, maxByCycle - 1);
                var maxCount = maxByCycle;
                totalProduced = Random.Shared.Next(minCount, maxCount + 1);
                scrapCount = Random.Shared.NextDouble() < ScrapProbability ? 1 : 0;
                if (scrapCount > totalProduced) scrapCount = totalProduced;

                // Usually clean; rare brief stop (0–3s) within the tick.
                if (Random.Shared.NextDouble() < MicroDowntimeProbability)
                {
                    downtimeSeconds = Math.Min(planned, Random.Shared.Next(0, 4));
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
                IdealCycleTimeSeconds = IdealCycleTimeSeconds,
                ActualProductionCount = totalProduced,
                GoodProductionCount = good,
                Temperature = temperature,
                Rpm = rpm,
                Vibration = vibration,
                RecordedAt = recordedAt
            };
        }

        /// <summary>
        /// Map StationRuntime.PauseReason / mode to a catalog code so catch-up downtime
        /// keeps a stable reason instead of rotating.
        /// </summary>
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

        /// <summary>
        /// Running: mostly healthy gauges; rare excursions for anomaly demos.
        /// Paused/Down: idle/low gauges.
        /// </summary>
        internal static (double Temperature, double Rpm, double Vibration) GeneratePhysicalGauges(bool isRunning)
        {
            if (!isRunning)
            {
                return (
                    Math.Round(28 + Random.Shared.NextDouble() * 12, 1),
                    Math.Round(Random.Shared.NextDouble() * 80, 0),
                    Math.Round(0.05 + Random.Shared.NextDouble() * 0.25, 2));
            }

            // Keep excursions sparse for demo sessions (per-station cooldown still gates Andon spam).
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
