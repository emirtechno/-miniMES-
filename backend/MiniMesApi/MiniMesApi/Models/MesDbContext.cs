using Microsoft.EntityFrameworkCore;

namespace MiniMesApi.Models
{
    public class MesDbContext : DbContext
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
        public DbSet<User> Users { get; set; }
        public DbSet<TraceabilityLog> TraceabilityLogs { get; set; }
        public DbSet<MachineMetric> MachineMetrics { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<MachineMetric>(entity =>
            {
                entity.HasIndex(metric => new { metric.StationId, metric.RecordedAt })
                    .IsDescending(false, true);
                entity.HasIndex(metric => metric.RecordedAt)
                    .IsDescending();
                entity.ToTable(table =>
                {
                    table.HasCheckConstraint(
                        "CK_MachineMetrics_Durations",
                        "[PlannedProductionSeconds] > 0 AND [DowntimeSeconds] >= 0 AND [DowntimeSeconds] <= [PlannedProductionSeconds] AND [IdealCycleTimeSeconds] > 0");
                    table.HasCheckConstraint(
                        "CK_MachineMetrics_Counts",
                        "[ActualProductionCount] >= 0 AND [GoodProductionCount] >= 0 AND [GoodProductionCount] <= [ActualProductionCount]");
                });
            });

            modelBuilder.Entity<Alarm>()
                .HasIndex(alarm => alarm.Time)
                .IsDescending();

            modelBuilder.Entity<UretimKayit>(entity =>
            {
                entity.HasIndex(record => new { record.IsDeleted, record.UretimTarihi })
                    .IsDescending(false, true);
                entity.HasIndex(record => record.Urun20liKod)
                    .IsUnique()
                    .HasFilter("[IsDeleted] = 0");
                entity.ToTable(table => table.HasCheckConstraint(
                    "CK_UretimKayitlari_KaliteDurumu",
                    "[KaliteDurumu] IN (N'OK', N'NOK', N'REWORK')"));
            });

            modelBuilder.Entity<WorkOrder>(entity =>
            {
                entity.HasIndex(order => order.OrderNo).IsUnique();
                entity.ToTable(table => table.HasCheckConstraint(
                    "CK_WorkOrders_Quantity",
                    "[Quantity] > 0"));
            });

            modelBuilder.Entity<Product>()
                .HasIndex(product => product.ProductCode)
                .IsUnique();

            modelBuilder.Entity<Station>()
                .HasIndex(station => station.StationCode)
                .IsUnique();

            modelBuilder.Entity<User>()
                .HasIndex(user => user.Username)
                .IsUnique();
        }
    }
}