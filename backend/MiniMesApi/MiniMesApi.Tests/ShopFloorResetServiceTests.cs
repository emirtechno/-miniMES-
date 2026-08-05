using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.Models;
using MiniMesApi.Services;

namespace MiniMesApi.Tests;

public sealed class ShopFloorResetServiceTests
{
    private static MesDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<MesDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new MesDbContext(options);
    }

    private static string? ResolveSqlServerConnectionString()
    {
        var fromEnv = Environment.GetEnvironmentVariable("MigrationSmoke__ConnectionString");
        if (!string.IsNullOrWhiteSpace(fromEnv))
            return fromEnv;

        // Local Windows smoke: LocalDB (same default as appsettings.json).
        return @"Server=(localdb)\MSSQLLocalDB;Integrated Security=true;TrustServerCertificate=True;";
    }

    [Fact]
    public async Task Reset_clears_telemetry_sessions_and_progress_keeps_catalog()
    {
        await using var db = CreateContext();
        db.Products.Add(new Product { ProductCode = "P1", ProductName = "Ürün 1" });
        db.MachineMetrics.Add(new MachineMetric
        {
            StationId = StationCatalog.AssemblyLine1,
            PlannedProductionSeconds = 15,
            DowntimeSeconds = 0,
            IdealCycleTimeSeconds = 2,
            ActualProductionCount = 7,
            GoodProductionCount = 7,
            DowntimeReasonCode = DowntimeReasonCatalog.None,
            ShiftCode = ShiftCatalog.ShiftA,
            RecordedAt = DateTimeOffset.UtcNow
        });
        db.ShiftSessions.Add(new ShiftSession
        {
            UserId = "u1",
            StationId = StationCatalog.AssemblyLine1,
            ShiftCode = ShiftCatalog.ShiftA,
            OperatorName = "Ali",
            StartedAt = DateTimeOffset.UtcNow.AddHours(-1),
            Status = ShiftSessionStatuses.Active
        });
        db.StationRuntimes.Add(new StationRuntime
        {
            StationId = StationCatalog.AssemblyLine1,
            Mode = StationRuntimeModes.Running,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.WorkOrders.Add(new WorkOrder
        {
            OrderNo = "WO-1",
            Product = "P1",
            Quantity = 100,
            CompletedQuantity = 40,
            Status = WorkOrderStatuses.InProgress,
            Station = StationCatalog.AssemblyLine1
        });
        db.SimulationControls.Add(new SimulationControl
        {
            Id = SimulationControl.SingletonId,
            Enabled = false,
            UpdatedAt = DateTimeOffset.UtcNow,
            UpdatedBy = "admin"
        });
        await db.SaveChangesAsync();

        var result = await new ShopFloorResetService(db).ResetAsync("admin");

        Assert.Equal(1, result.MachineMetricsDeleted);
        Assert.Equal(1, result.ShiftSessionsDeleted);
        Assert.Equal(1, result.StationRuntimesReset);
        Assert.Equal(1, result.WorkOrdersProgressCleared);
        Assert.Empty(await db.MachineMetrics.ToListAsync());
        Assert.Empty(await db.ShiftSessions.ToListAsync());
        Assert.Equal(0, (await db.WorkOrders.SingleAsync()).CompletedQuantity);
        Assert.Equal(StationRuntimeModes.Paused, (await db.StationRuntimes.SingleAsync()).Mode);
        Assert.Single(await db.Products.ToListAsync());
        var sim = await db.SimulationControls.SingleAsync();
        Assert.False(sim.Enabled);
        Assert.Equal("admin", sim.UpdatedBy);
    }

    [Fact]
    public async Task Reset_deletes_fk_graph_downtime_scrap_alarm_metric_session()
    {
        await using var db = CreateContext();

        var workOrder = new WorkOrder
        {
            OrderNo = "WO-FK",
            Product = "P1",
            Quantity = 50,
            CompletedQuantity = 12,
            Status = WorkOrderStatuses.InProgress,
            Station = StationCatalog.AssemblyLine1
        };
        db.WorkOrders.Add(workOrder);
        await db.SaveChangesAsync();

        var batch = new Batch
        {
            LotNo = "LOT-1",
            Product = "P1",
            Station = StationCatalog.AssemblyLine1,
            Status = BatchStatuses.InProgress,
            TargetQuantity = 50,
            ProducedQuantity = 8,
            WorkOrderId = workOrder.Id
        };
        db.Batches.Add(batch);

        var session = new ShiftSession
        {
            UserId = "u-fk",
            StationId = StationCatalog.AssemblyLine1,
            ShiftCode = ShiftCatalog.ShiftA,
            OperatorName = "Veli",
            StartedAt = DateTimeOffset.UtcNow.AddHours(-2),
            Status = ShiftSessionStatuses.Active,
            ActiveWorkOrderId = workOrder.Id
        };
        db.ShiftSessions.Add(session);
        await db.SaveChangesAsync();

        session.ActiveBatchId = batch.Id;
        var metric = new MachineMetric
        {
            StationId = StationCatalog.AssemblyLine1,
            PlannedProductionSeconds = 30,
            DowntimeSeconds = 5,
            IdealCycleTimeSeconds = 2,
            ActualProductionCount = 4,
            GoodProductionCount = 3,
            DowntimeReasonCode = DowntimeReasonCatalog.Breakdown,
            ShiftCode = ShiftCatalog.ShiftA,
            ShiftSessionId = session.Id,
            RecordedAt = DateTimeOffset.UtcNow
        };
        db.MachineMetrics.Add(metric);

        var alarm = new Alarm
        {
            Title = "Test hold",
            Station = StationCatalog.AssemblyLine1,
            Severity = "Kritik",
            Status = "Açık",
            ShiftSessionId = session.Id,
            Time = DateTimeOffset.UtcNow
        };
        db.Alarms.Add(alarm);
        await db.SaveChangesAsync();

        db.DowntimeEvents.Add(new DowntimeEvent
        {
            StationId = StationCatalog.AssemblyLine1,
            ReasonCode = DowntimeReasonCatalog.Breakdown,
            Source = DowntimeEventSources.Alarm,
            ShiftSessionId = session.Id,
            AlarmId = alarm.Id,
            MachineMetricId = metric.Id,
            StartedAt = DateTimeOffset.UtcNow.AddMinutes(-10),
            EndedAt = DateTimeOffset.UtcNow,
            DurationSeconds = 600
        });
        db.ScrapLogs.Add(new ScrapLog
        {
            StationId = StationCatalog.AssemblyLine1,
            Quantity = 2,
            OperatorUserId = "u-fk",
            ShiftSessionId = session.Id,
            WorkOrderId = workOrder.Id,
            BatchId = batch.Id,
            MachineMetricId = metric.Id,
            RecordedAt = DateTimeOffset.UtcNow
        });
        db.ShiftSessionEvents.Add(new ShiftSessionEvent
        {
            ShiftSessionId = session.Id,
            FromStatus = string.Empty,
            ToStatus = ShiftSessionStatuses.Active,
            OccurredAt = session.StartedAt,
            ActorUserId = "u-fk"
        });
        db.StationRuntimes.Add(new StationRuntime
        {
            StationId = StationCatalog.AssemblyLine1,
            Mode = StationRuntimeModes.Down,
            PauseReason = "alarm",
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var result = await new ShopFloorResetService(db).ResetAsync("admin");

        Assert.Equal(1, result.DowntimeEventsDeleted);
        Assert.Equal(1, result.ScrapLogsDeleted);
        Assert.Equal(1, result.ShiftSessionEventsDeleted);
        Assert.Equal(1, result.AlarmsDeleted);
        Assert.Equal(1, result.MachineMetricsDeleted);
        Assert.Equal(1, result.ShiftSessionsDeleted);
        Assert.Equal(1, result.WorkOrdersProgressCleared);
        Assert.Equal(1, result.BatchesProgressCleared);
        Assert.Equal(1, result.StationRuntimesReset);

        Assert.Empty(await db.DowntimeEvents.ToListAsync());
        Assert.Empty(await db.ScrapLogs.ToListAsync());
        Assert.Empty(await db.ShiftSessionEvents.ToListAsync());
        Assert.Empty(await db.Alarms.ToListAsync());
        Assert.Empty(await db.MachineMetrics.ToListAsync());
        Assert.Empty(await db.ShiftSessions.ToListAsync());
        Assert.Equal(0, (await db.WorkOrders.SingleAsync()).CompletedQuantity);
        Assert.Equal(0, (await db.Batches.SingleAsync()).ProducedQuantity);
        Assert.Equal(StationRuntimeModes.Paused, (await db.StationRuntimes.SingleAsync()).Mode);
        Assert.Equal("Shop-floor reset", (await db.StationRuntimes.SingleAsync()).PauseReason);
    }

    [Fact]
    public async Task Reset_sql_server_execute_delete_clears_fk_graph()
    {
        var baseCs = ResolveSqlServerConnectionString();
        SqlConnectionStringBuilder builder;
        try
        {
            builder = new SqlConnectionStringBuilder(baseCs)
            {
                InitialCatalog = $"MiniMesReset_{Guid.NewGuid():N}"
            };
            var master = new SqlConnectionStringBuilder(baseCs) { InitialCatalog = "master" };
            await using var masterConn = new SqlConnection(master.ConnectionString);
            await masterConn.OpenAsync();
            await using (var create = masterConn.CreateCommand())
            {
                create.CommandText = $"CREATE DATABASE [{builder.InitialCatalog}]";
                await create.ExecuteNonQueryAsync();
            }
        }
        catch (Exception)
        {
            // LocalDB / SQL Server not available in this environment.
            return;
        }

        var masterCs = new SqlConnectionStringBuilder(baseCs) { InitialCatalog = "master" };
        try
        {
            var options = new DbContextOptionsBuilder<MesDbContext>()
                .UseSqlServer(builder.ConnectionString)
                .Options;

            await using var db = new MesDbContext(options);
            await db.Database.MigrateAsync();

            var workOrder = new WorkOrder
            {
                OrderNo = "WO-SQL",
                Product = "P1",
                Quantity = 20,
                CompletedQuantity = 5,
                Status = WorkOrderStatuses.InProgress,
                Station = StationCatalog.AssemblyLine1
            };
            db.WorkOrders.Add(workOrder);
            await db.SaveChangesAsync();

            var session = new ShiftSession
            {
                UserId = "u-sql",
                StationId = StationCatalog.AssemblyLine1,
                ShiftCode = ShiftCatalog.ShiftA,
                OperatorName = "SQL",
                StartedAt = DateTimeOffset.UtcNow.AddHours(-1),
                Status = ShiftSessionStatuses.Active,
                ActiveWorkOrderId = workOrder.Id
            };
            db.ShiftSessions.Add(session);
            await db.SaveChangesAsync();

            var metric = new MachineMetric
            {
                StationId = StationCatalog.AssemblyLine1,
                PlannedProductionSeconds = 15,
                DowntimeSeconds = 3,
                IdealCycleTimeSeconds = 2,
                ActualProductionCount = 2,
                GoodProductionCount = 2,
                DowntimeReasonCode = DowntimeReasonCatalog.Breakdown,
                ShiftCode = ShiftCatalog.ShiftA,
                ShiftSessionId = session.Id,
                RecordedAt = DateTimeOffset.UtcNow
            };
            db.MachineMetrics.Add(metric);
            var alarm = new Alarm
            {
                Title = "SQL hold",
                Station = StationCatalog.AssemblyLine1,
                Severity = "Kritik",
                Status = "Açık",
                ShiftSessionId = session.Id,
                Time = DateTimeOffset.UtcNow
            };
            db.Alarms.Add(alarm);
            await db.SaveChangesAsync();

            db.DowntimeEvents.Add(new DowntimeEvent
            {
                StationId = StationCatalog.AssemblyLine1,
                ReasonCode = DowntimeReasonCatalog.Breakdown,
                Source = DowntimeEventSources.Alarm,
                ShiftSessionId = session.Id,
                AlarmId = alarm.Id,
                MachineMetricId = metric.Id,
                StartedAt = DateTimeOffset.UtcNow.AddMinutes(-5),
                DurationSeconds = 120
            });
            db.ScrapLogs.Add(new ScrapLog
            {
                StationId = StationCatalog.AssemblyLine1,
                Quantity = 1,
                OperatorUserId = "u-sql",
                ShiftSessionId = session.Id,
                WorkOrderId = workOrder.Id,
                MachineMetricId = metric.Id,
                RecordedAt = DateTimeOffset.UtcNow
            });
            db.ShiftSessionEvents.Add(new ShiftSessionEvent
            {
                ShiftSessionId = session.Id,
                FromStatus = string.Empty,
                ToStatus = ShiftSessionStatuses.Active,
                OccurredAt = session.StartedAt
            });
            db.StationRuntimes.Add(new StationRuntime
            {
                StationId = StationCatalog.AssemblyLine1,
                Mode = StationRuntimeModes.Running,
                UpdatedAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();

            var result = await new ShopFloorResetService(db).ResetAsync("sql-admin");

            Assert.Equal(1, result.DowntimeEventsDeleted);
            Assert.Equal(1, result.ScrapLogsDeleted);
            Assert.Equal(1, result.AlarmsDeleted);
            Assert.Equal(1, result.MachineMetricsDeleted);
            Assert.Equal(1, result.ShiftSessionsDeleted);
            Assert.Equal(0, await db.WorkOrders.Select(wo => wo.CompletedQuantity).SingleAsync());
            Assert.Empty(await db.DowntimeEvents.ToListAsync());
            Assert.Empty(await db.Alarms.ToListAsync());
            Assert.Empty(await db.ShiftSessions.ToListAsync());
        }
        finally
        {
            await using var masterConn = new SqlConnection(masterCs.ConnectionString);
            await masterConn.OpenAsync();
            await using var drop = masterConn.CreateCommand();
            drop.CommandText = $"""
                IF DB_ID(N'{builder.InitialCatalog}') IS NOT NULL
                BEGIN
                    ALTER DATABASE [{builder.InitialCatalog}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
                    DROP DATABASE [{builder.InitialCatalog}];
                END
                """;
            await drop.ExecuteNonQueryAsync();
        }
    }
}
