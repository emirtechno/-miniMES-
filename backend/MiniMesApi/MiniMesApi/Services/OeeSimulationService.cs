using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using MiniMesApi.Models;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace MiniMesApi.Services
{
    public class OeeSimulationService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<OeeSimulationService> _logger;
        private readonly Random _random = new();

        // 🏭 Fabrikadaki İstasyon Listesi
        private readonly string[] _stations = { "STATION-01", "STATION-02", "STATION-03" };

        public OeeSimulationService(IServiceProvider serviceProvider, ILogger<OeeSimulationService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("OEE Çoklu İstasyon Simülasyon Servisi Başlatıldı.");

            while (!stoppingToken.IsCancellationRequested)
            {
                using (var scope = _serviceProvider.CreateScope())
                {
                    var dbContext = scope.ServiceProvider.GetRequiredService<MesDbContext>();

                    // Her bir istasyon için döngüye girip ayrı ayrı veri üretelim
                    foreach (var stationId in _stations)
                    {
                        var plannedSeconds = 300.0; 
                        var downtimeSeconds = _random.Next(10, 60); 
                        var idealCycleTime = 2.0; 

                        var totalProduced = _random.Next(100, 140);
                        var scrapCount = _random.Next(0, 8); 
                        var goodCount = totalProduced - scrapCount;

                        var metric = new MachineMetric
                        {
                            StationId = stationId, // Dinamik istasyon adı
                            PlannedProductionSeconds = plannedSeconds,
                            DowntimeSeconds = downtimeSeconds,
                            IdealCycleTimeSeconds = idealCycleTime,
                            ActualProductionCount = totalProduced,
                            GoodProductionCount = goodCount,
                            RecordedAt = DateTime.UtcNow
                        };

                        dbContext.MachineMetrics.Add(metric);
                        _logger.LogInformation("Simülasyon Verisi Eklendi: Station={Station}, Good={Good}, Total={Total}", 
                            metric.StationId, metric.GoodProductionCount, metric.ActualProductionCount);
                    }

                    await dbContext.SaveChangesAsync(stoppingToken);
                }

                // 15 saniyede bir tüm istasyonlar için yeni veriler üret
                await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
            }
        }
    }
}