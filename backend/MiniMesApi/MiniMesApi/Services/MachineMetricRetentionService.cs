using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MiniMesApi.Models;
using MiniMesApi.Options;

namespace MiniMesApi.Services;

public sealed class MachineMetricRetentionService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MachineMetricRetentionService> _logger;
    private readonly MachineMetricRetentionOptions _options;

    public MachineMetricRetentionService(
        IServiceScopeFactory scopeFactory,
        IOptions<MachineMetricRetentionOptions> options,
        ILogger<MachineMetricRetentionService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromHours(_options.CleanupIntervalHours);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await DeleteExpiredMetricsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Süresi dolan makine metrikleri temizlenemedi.");
            }

            await Task.Delay(interval, stoppingToken);
        }
    }

    private async Task DeleteExpiredMetricsAsync(CancellationToken cancellationToken)
    {
        var cutoff = DateTime.UtcNow.AddDays(-_options.RetentionDays);
        await using var scope = _scopeFactory.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<MesDbContext>();

        var totalDeleted = 0;
        int deletedCount;
        do
        {
            deletedCount = await dbContext.MachineMetrics
                .Where(metric => metric.RecordedAt < cutoff)
                .OrderBy(metric => metric.RecordedAt)
                .Take(_options.BatchSize)
                .ExecuteDeleteAsync(cancellationToken);
            totalDeleted += deletedCount;
        }
        while (deletedCount == _options.BatchSize && !cancellationToken.IsCancellationRequested);

        if (totalDeleted > 0)
        {
            _logger.LogInformation(
                "{DeletedCount} makine metriği {Cutoff} tarihinden eski olduğu için silindi.",
                totalDeleted,
                cutoff);
        }
    }
}
