using Microsoft.Extensions.Options;
using MiniMesApi.Models;
using MiniMesApi.Options;

namespace MiniMesApi.Services
{
    public class OeeSimulationService : BackgroundService
    {
        private static readonly IReadOnlyCollection<string> Stations = StationCatalog.All;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<OeeSimulationService> _logger;
        private readonly TimeSpan _interval;

        public OeeSimulationService(
            IServiceScopeFactory scopeFactory,
            IOptions<OeeSimulationOptions> options,
            ILogger<OeeSimulationService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
            _interval = TimeSpan.FromSeconds(options.Value.IntervalSeconds);
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation(
                "OEE simülasyon servisi {IntervalSeconds} saniye aralıkla başlatıldı.",
                _interval.TotalSeconds);

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
            var dbContext = scope.ServiceProvider.GetRequiredService<MesDbContext>();
            var recordedAt = DateTime.UtcNow;

            var metrics = Stations.Select(stationId =>
            {
                var totalProduced = Random.Shared.Next(100, 140);
                var scrapCount = Random.Shared.Next(0, 8);

                return new MachineMetric
                {
                    StationId = stationId,
                    PlannedProductionSeconds = 300,
                    DowntimeSeconds = Random.Shared.Next(10, 60),
                    IdealCycleTimeSeconds = 2,
                    ActualProductionCount = totalProduced,
                    GoodProductionCount = totalProduced - scrapCount,
                    RecordedAt = recordedAt
                };
            });

            dbContext.MachineMetrics.AddRange(metrics);
            await dbContext.SaveChangesAsync(cancellationToken);
            _logger.LogDebug("OEE simülasyon verisi {RecordedAt} zamanında kaydedildi.", recordedAt);
        }
    }
}