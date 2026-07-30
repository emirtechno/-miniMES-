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
    }
}