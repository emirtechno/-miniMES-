using Microsoft.EntityFrameworkCore;
using MiniMesApi.DTOs;
using MiniMesApi.Models;

namespace MiniMesApi.Services;

public interface IFactorySimulationControl
{
    Task EnsureSeededAsync(CancellationToken cancellationToken = default);

    Task<bool> IsEnabledAsync(CancellationToken cancellationToken = default);

    Task<SimulationStatusDto> GetStatusAsync(CancellationToken cancellationToken = default);

    Task<SimulationStatusDto> SetEnabledAsync(
        bool enabled,
        string? updatedBy,
        CancellationToken cancellationToken = default);
}

public sealed class FactorySimulationControlService(MesDbContext db) : IFactorySimulationControl
{
    public async Task EnsureSeededAsync(CancellationToken cancellationToken = default)
    {
        // Never overwrite an existing row — site toggle state must survive restarts.
        var existing = await db.SimulationControls
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.Id == SimulationControl.SingletonId, cancellationToken);
        if (existing is not null)
            return;

        db.SimulationControls.Add(new SimulationControl
        {
            Id = SimulationControl.SingletonId,
            Enabled = true, // first-install default only
            UpdatedAt = DateTimeOffset.UtcNow,
            UpdatedBy = "system"
        });
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<bool> IsEnabledAsync(CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        return await db.SimulationControls
            .AsNoTracking()
            .Where(row => row.Id == SimulationControl.SingletonId)
            .Select(row => row.Enabled)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<SimulationStatusDto> GetStatusAsync(CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        var row = await db.SimulationControls
            .AsNoTracking()
            .FirstAsync(control => control.Id == SimulationControl.SingletonId, cancellationToken);
        return ToDto(row);
    }

    public async Task<SimulationStatusDto> SetEnabledAsync(
        bool enabled,
        string? updatedBy,
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        var row = await db.SimulationControls
            .FirstAsync(control => control.Id == SimulationControl.SingletonId, cancellationToken);

        row.Enabled = enabled;
        row.UpdatedAt = DateTimeOffset.UtcNow;
        row.UpdatedBy = string.IsNullOrWhiteSpace(updatedBy) ? "system" : updatedBy.Trim();
        await db.SaveChangesAsync(cancellationToken);
        return ToDto(row);
    }

    private static SimulationStatusDto ToDto(SimulationControl row) => new()
    {
        Enabled = row.Enabled,
        Source = "backend",
        UpdatedAt = row.UpdatedAt,
        UpdatedBy = row.UpdatedBy
    };
}
