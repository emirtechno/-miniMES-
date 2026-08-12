using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.Models;

namespace MiniMesApi.Tests;

/// <summary>
/// Optional SQL Server empty-database migration smoke.
/// Enabled when MigrationSmoke__ConnectionString is set (CI migration-smoke job).
/// </summary>
public sealed class EmptyDatabaseMigrationTests
{
    [Fact]
    public async Task Apply_all_migrations_to_empty_sql_server_database()
    {
        var connectionString = Environment.GetEnvironmentVariable("MigrationSmoke__ConnectionString");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return;
        }

        var builder = new SqlConnectionStringBuilder(connectionString)
        {
            InitialCatalog = $"MiniMesEmpty_{Guid.NewGuid():N}"
        };

        var master = new SqlConnectionStringBuilder(connectionString) { InitialCatalog = "master" };
        await using (var masterConn = new SqlConnection(master.ConnectionString))
        {
            await masterConn.OpenAsync();
            await using var create = masterConn.CreateCommand();
            create.CommandText = $"CREATE DATABASE [{builder.InitialCatalog}]";
            await create.ExecuteNonQueryAsync();
        }

        try
        {
            var options = new DbContextOptionsBuilder<MesDbContext>()
                .UseSqlServer(builder.ConnectionString, sql => sql.EnableRetryOnFailure())
                .Options;

            await using (var db = new MesDbContext(options))
            {
                await db.Database.MigrateAsync();
                await db.Database.MigrateAsync();

                var applied = (await db.Database.GetAppliedMigrationsAsync()).ToArray();
                Assert.NotEmpty(applied);
                Assert.Contains(
                    applied,
                    name => name.Contains("ConvertPersistedTimestampsToDateTimeOffset", StringComparison.Ordinal));
            }

            await using var verify = new SqlConnection(builder.ConnectionString);
            await verify.OpenAsync();
            await using (var typeCmd = verify.CreateCommand())
            {
                typeCmd.CommandText = """
                    SELECT DATA_TYPE
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME = 'UretimKayitlari' AND COLUMN_NAME = 'UretimTarihi'
                    """;
                var uretimType = (string?)await typeCmd.ExecuteScalarAsync();
                Assert.Equal("datetimeoffset", uretimType);
            }

            await using (var tableCmd = verify.CreateCommand())
            {
                tableCmd.CommandText = """
                    SELECT COUNT(*)
                    FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_NAME = 'MachineMetrics'
                    """;
                var tableCount = (int)(await tableCmd.ExecuteScalarAsync() ?? 0);
                Assert.Equal(1, tableCount);
            }
        }
        finally
        {
            await using var masterConn = new SqlConnection(master.ConnectionString);
            await masterConn.OpenAsync();
            await using var drop = masterConn.CreateCommand();
            drop.CommandText = $"""
                IF EXISTS (SELECT 1 FROM sys.databases WHERE name = N'{builder.InitialCatalog}')
                BEGIN
                  ALTER DATABASE [{builder.InitialCatalog}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
                  DROP DATABASE [{builder.InitialCatalog}];
                END
                """;
            await drop.ExecuteNonQueryAsync();
        }
    }

    /// <summary>
    /// CI migration-smoke: <c>dotnet ef database update</c> ile doldurulan SMOKE_DB şemasını doğrula.
    /// Ayrı mssql-tools container çekimine bağımlı değil (tools imajı exit 125).
    /// </summary>
    [Fact]
    public async Task Smoke_connection_string_database_has_expected_schema()
    {
        var connectionString = Environment.GetEnvironmentVariable("MigrationSmoke__ConnectionString");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return;
        }

        await using var verify = new SqlConnection(connectionString);
        await verify.OpenAsync();

        await using (var migCmd = verify.CreateCommand())
        {
            migCmd.CommandText = "SELECT COUNT(*) FROM __EFMigrationsHistory";
            var migrationCount = (int)(await migCmd.ExecuteScalarAsync() ?? 0);
            Assert.True(migrationCount >= 1, "No migrations applied to smoke database");
        }

        await using (var typeCmd = verify.CreateCommand())
        {
            typeCmd.CommandText = """
                SELECT DATA_TYPE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'UretimKayitlari' AND COLUMN_NAME = 'UretimTarihi'
                """;
            var uretimType = (string?)await typeCmd.ExecuteScalarAsync();
            Assert.Equal("datetimeoffset", uretimType);
        }

        await using (var tableCmd = verify.CreateCommand())
        {
            tableCmd.CommandText = """
                SELECT COUNT(*)
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_NAME = 'MachineMetrics'
                """;
            var tableCount = (int)(await tableCmd.ExecuteScalarAsync() ?? 0);
            Assert.Equal(1, tableCount);
        }
    }
}
