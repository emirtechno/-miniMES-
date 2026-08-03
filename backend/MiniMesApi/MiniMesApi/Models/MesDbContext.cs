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
        public DbSet<Station> Stations { get; set; }
        public DbSet<User> TraceabilityUsers { get; set; }
        public DbSet<TraceabilityLog> TraceabilityLogs { get; set; }
        public DbSet<MachineMetric> MachineMetrics { get; set; }
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
                });
            });

            modelBuilder.Entity<Alarm>()
                .HasIndex(alarm => new { alarm.Time, alarm.Id })
                .IsDescending(true, true);

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
                entity.Property(order => order.RowVersion).IsRowVersion();
                entity.ToTable(table =>
                {
                    table.HasCheckConstraint(
                        "CK_WorkOrders_Quantity",
                        "[Quantity] > 0");
                    table.HasCheckConstraint(
                        "CK_WorkOrders_Status",
                        "[Status] IN (N'Bekliyor', N'Devam Ediyor', N'Tamamlandı')");
                });
            });

            modelBuilder.Entity<Batch>(entity =>
            {
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

            modelBuilder.Entity<Station>()
                .HasIndex(station => station.StationCode)
                .IsUnique();

            modelBuilder.Entity<User>(entity =>
            {
                entity.ToTable("Users");
                entity.HasIndex(user => user.Username).IsUnique();
            });
        }
    }
}