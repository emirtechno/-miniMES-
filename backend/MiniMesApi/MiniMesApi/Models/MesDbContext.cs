using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace MiniMesApi.Models
{
    public class MesDbContext : IdentityDbContext<ApplicationUser>
    {
        public MesDbContext(DbContextOptions<MesDbContext> options) : base(options)
        {
        }

        public DbSet<UretimKayit> UretimKayitlari { get; set; }
        public DbSet<Alarm> Alarms { get; set; }

        public DbSet<WorkOrder> WorkOrders { get; set; }

        public DbSet<Batch> Batches { get; set; }

        public DbSet<Product> Products { get; set; }
        public DbSet<MachineMetric> MachineMetrics { get; set; }
        public DbSet<ScrapLog> ScrapLogs { get; set; }
        public DbSet<StationRuntime> StationRuntimes { get; set; }
        public DbSet<ShiftSession> ShiftSessions { get; set; }
        public DbSet<DowntimeEvent> DowntimeEvents { get; set; }
        public DbSet<ShiftSessionEvent> ShiftSessionEvents { get; set; }
        public DbSet<SimulationControl> SimulationControls { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<MachineMetric>(entity =>
            {
                entity.HasIndex(metric => new { metric.StationId, metric.RecordedAt, metric.Id })
                    .IsDescending(false, true, true);
                entity.HasIndex(metric => new { metric.RecordedAt, metric.Id })
                    .IsDescending(true, true);
                entity.HasIndex(metric => new { metric.ShiftCode, metric.RecordedAt });
                entity.HasIndex(metric => metric.DowntimeReasonCode);
                entity.HasIndex(metric => metric.ShiftSessionId);
                entity.HasOne<ShiftSession>()
                    .WithMany()
                    .HasForeignKey(metric => metric.ShiftSessionId)
                    .OnDelete(DeleteBehavior.SetNull);
                entity.ToTable(table =>
                {
                    table.HasCheckConstraint(
                        "CK_MachineMetrics_Durations",
                        "[PlannedProductionSeconds] > 0 AND [DowntimeSeconds] >= 0 AND [DowntimeSeconds] <= [PlannedProductionSeconds] AND [IdealCycleTimeSeconds] > 0");
                    table.HasCheckConstraint(
                        "CK_MachineMetrics_Counts",
                        "[ActualProductionCount] >= 0 AND [GoodProductionCount] >= 0 AND [GoodProductionCount] <= [ActualProductionCount]");
                    table.HasCheckConstraint(
                        "CK_MachineMetrics_ShiftCode",
                        "[ShiftCode] IN (N'SHIFT_A', N'SHIFT_B', N'SHIFT_C')");
                    table.HasCheckConstraint(
                        "CK_MachineMetrics_DowntimeReason",
                        "[DowntimeReasonCode] IN (N'NONE', N'PLANNED_MAINTENANCE', N'BREAKDOWN', N'MATERIAL_SHORTAGE', N'CHANGEOVER', N'NO_OPERATOR', N'QUALITY_HOLD', N'OTHER')");
                    table.HasCheckConstraint(
                        "CK_MachineMetrics_DowntimeReasonConsistency",
                        "([DowntimeSeconds] = 0 AND [DowntimeReasonCode] = N'NONE') OR ([DowntimeSeconds] > 0 AND [DowntimeReasonCode] <> N'NONE')");
                    table.HasCheckConstraint(
                        "CK_MachineMetrics_PhysicalGauges",
                        "([Temperature] IS NULL OR ([Temperature] >= 0 AND [Temperature] <= 200)) AND ([Rpm] IS NULL OR [Rpm] >= 0) AND ([Vibration] IS NULL OR [Vibration] >= 0)");
                });
            });

            modelBuilder.Entity<Alarm>(entity =>
            {
                entity.HasIndex(alarm => new { alarm.Time, alarm.Id })
                    .IsDescending(true, true);
                entity.HasIndex(alarm => alarm.ShiftSessionId);
                entity.HasOne(alarm => alarm.ShiftSession)
                    .WithMany()
                    .HasForeignKey(alarm => alarm.ShiftSessionId)
                    .OnDelete(DeleteBehavior.SetNull);
            });

            modelBuilder.Entity<UretimKayit>(entity =>
            {
                entity.HasIndex(record => new { record.IsDeleted, record.UretimTarihi, record.ID })
                    .IsDescending(false, true, true);
                entity.HasIndex(record => record.Urun20liKod)
                    .IsUnique()
                    .HasFilter("[IsDeleted] = 0");
                entity.HasIndex(record => new { record.IsDeleted, record.DeletedAtUtc });
                entity.ToTable(table => table.HasCheckConstraint(
                    "CK_UretimKayitlari_KaliteDurumu",
                    "[KaliteDurumu] IN (N'OK', N'NOK', N'REWORK')"));
            });

            modelBuilder.Entity<WorkOrder>(entity =>
            {
                entity.HasIndex(order => order.OrderNo).IsUnique();
                entity.HasIndex(order => order.ProductId);
                entity.Property(order => order.RowVersion).IsRowVersion();
                entity.HasOne(order => order.ProductRef)
                    .WithMany(product => product.WorkOrders)
                    .HasForeignKey(order => order.ProductId)
                    .OnDelete(DeleteBehavior.SetNull);
                entity.HasMany(order => order.Lots)
                    .WithOne(batch => batch.WorkOrder)
                    .HasForeignKey(batch => batch.WorkOrderId)
                    .OnDelete(DeleteBehavior.SetNull);
                entity.ToTable(table =>
                {
                    table.HasCheckConstraint(
                        "CK_WorkOrders_Quantity",
                        "[Quantity] > 0");
                    table.HasCheckConstraint(
                        "CK_WorkOrders_CompletedQuantity",
                        "[CompletedQuantity] >= 0 AND [CompletedQuantity] <= [Quantity]");
                    table.HasCheckConstraint(
                        "CK_WorkOrders_Status",
                        "[Status] IN (N'Bekliyor', N'Devam Ediyor', N'Tamamlandı')");
                });
            });

            modelBuilder.Entity<Batch>(entity =>
            {
                entity.HasIndex(batch => batch.WorkOrderId);
                entity.HasIndex(batch => new { batch.Station, batch.Status });
                entity.HasOne(batch => batch.ProductRef)
                    .WithMany(product => product.Batches)
                    .HasForeignKey(batch => batch.ProductId)
                    .OnDelete(DeleteBehavior.SetNull);
                entity.ToTable(table =>
                {
                    table.HasCheckConstraint(
                        "CK_Batches_TargetQuantity",
                        "[TargetQuantity] > 0");
                    table.HasCheckConstraint(
                        "CK_Batches_ProducedQuantity",
                        "[ProducedQuantity] >= 0");
                    table.HasCheckConstraint(
                        "CK_Batches_Status",
                        "[Status] IN (N'Bekliyor', N'İşlemde', N'Tamamlandı')");
                });
            });

            modelBuilder.Entity<ScrapLog>(entity =>
            {
                entity.HasIndex(log => new { log.StationId, log.RecordedAt, log.Id })
                    .IsDescending(false, true, true);
                entity.HasIndex(log => log.ShiftSessionId);
                entity.HasOne(log => log.WorkOrder)
                    .WithMany()
                    .HasForeignKey(log => log.WorkOrderId)
                    .OnDelete(DeleteBehavior.SetNull);
                entity.HasOne(log => log.Batch)
                    .WithMany()
                    .HasForeignKey(log => log.BatchId)
                    .OnDelete(DeleteBehavior.SetNull);
                entity.HasOne(log => log.ShiftSession)
                    .WithMany()
                    .HasForeignKey(log => log.ShiftSessionId)
                    .OnDelete(DeleteBehavior.SetNull);
                entity.HasOne(log => log.MachineMetric)
                    .WithMany()
                    .HasForeignKey(log => log.MachineMetricId)
                    .OnDelete(DeleteBehavior.SetNull);
                entity.ToTable(table =>
                {
                    table.HasCheckConstraint(
                        "CK_ScrapLogs_Quantity",
                        "[Quantity] > 0");
                });
            });

            modelBuilder.Entity<StationRuntime>(entity =>
            {
                entity.HasKey(runtime => runtime.StationId);
                entity.ToTable(table =>
                {
                    table.HasCheckConstraint(
                        "CK_StationRuntimes_Mode",
                        "[Mode] IN (N'Running', N'Paused', N'Down')");
                });
            });

            modelBuilder.Entity<ShiftSession>(entity =>
            {
                entity.HasIndex(session => new { session.UserId, session.Status, session.StartedAt });
                entity.HasIndex(session => new { session.StationId, session.Status });
                entity.HasIndex(session => session.UserId)
                    .IsUnique()
                    .HasFilter("[Status] <> N'Ended'")
                    .HasDatabaseName("IX_ShiftSessions_UserId_Open");
                entity.HasIndex(session => session.ActiveWorkOrderId);
                entity.HasIndex(session => session.ActiveBatchId);
                entity.Property(session => session.SummaryJson).HasMaxLength(4000);
                entity.HasOne(session => session.ActiveWorkOrder)
                    .WithMany()
                    .HasForeignKey(session => session.ActiveWorkOrderId)
                    .OnDelete(DeleteBehavior.SetNull);
                entity.HasOne(session => session.ActiveBatch)
                    .WithMany()
                    .HasForeignKey(session => session.ActiveBatchId)
                    .OnDelete(DeleteBehavior.SetNull);
                entity.ToTable(table =>
                {
                    table.HasCheckConstraint(
                        "CK_ShiftSessions_Status",
                        "[Status] IN (N'Active', N'OnBreak', N'InSetup', N'Ended')");
                });
            });

            modelBuilder.Entity<DowntimeEvent>(entity =>
            {
                entity.HasIndex(item => new { item.StationId, item.StartedAt, item.Id })
                    .IsDescending(false, true, true);
                entity.HasIndex(item => item.ShiftSessionId);
                entity.HasIndex(item => item.AlarmId);
                entity.HasOne(item => item.ShiftSession)
                    .WithMany(session => session.DowntimeEvents)
                    .HasForeignKey(item => item.ShiftSessionId)
                    .OnDelete(DeleteBehavior.SetNull);
                entity.HasOne(item => item.Alarm)
                    .WithMany()
                    .HasForeignKey(item => item.AlarmId)
                    .OnDelete(DeleteBehavior.SetNull);
                entity.HasOne(item => item.MachineMetric)
                    .WithMany()
                    .HasForeignKey(item => item.MachineMetricId)
                    .OnDelete(DeleteBehavior.SetNull);
                entity.ToTable(table =>
                {
                    table.HasCheckConstraint(
                        "CK_DowntimeEvents_Source",
                        "[Source] IN (N'Operator', N'Simulation', N'Alarm')");
                    table.HasCheckConstraint(
                        "CK_DowntimeEvents_Duration",
                        "[DurationSeconds] IS NULL OR [DurationSeconds] >= 0");
                });
            });

            modelBuilder.Entity<ShiftSessionEvent>(entity =>
            {
                entity.HasIndex(item => new { item.ShiftSessionId, item.OccurredAt, item.Id })
                    .IsDescending(false, true, true);
                entity.HasOne(item => item.ShiftSession)
                    .WithMany(session => session.Events)
                    .HasForeignKey(item => item.ShiftSessionId)
                    .OnDelete(DeleteBehavior.Cascade);
                entity.ToTable(table =>
                {
                    table.HasCheckConstraint(
                        "CK_ShiftSessionEvents_FromStatus",
                        "[FromStatus] IN (N'', N'Active', N'OnBreak', N'InSetup', N'Ended')");
                    table.HasCheckConstraint(
                        "CK_ShiftSessionEvents_ToStatus",
                        "[ToStatus] IN (N'Active', N'OnBreak', N'InSetup', N'Ended')");
                });
            });

            modelBuilder.Entity<SimulationControl>(entity =>
            {
                entity.HasKey(row => row.Id);
                entity.Property(row => row.Id).ValueGeneratedNever();
                entity.Property(row => row.UpdatedBy).HasMaxLength(120);
                entity.ToTable(table =>
                {
                    table.HasCheckConstraint(
                        "CK_SimulationControls_Singleton",
                        $"[Id] = {SimulationControl.SingletonId}");
                });
                entity.HasData(new SimulationControl
                {
                    Id = SimulationControl.SingletonId,
                    Enabled = true,
                    UpdatedAt = new DateTimeOffset(2026, 8, 5, 0, 0, 0, TimeSpan.Zero),
                    UpdatedBy = "system"
                });
            });

            modelBuilder.Entity<AuditLog>(entity =>
            {
                entity.HasIndex(log => new { log.EntityType, log.EntityId, log.OccurredAtUtc })
                    .IsDescending(false, false, true);
                entity.HasIndex(log => log.OccurredAtUtc)
                    .IsDescending();
            });

            modelBuilder.Entity<Product>()
                .HasIndex(product => product.ProductCode)
                .IsUnique();
        }
    }
}
