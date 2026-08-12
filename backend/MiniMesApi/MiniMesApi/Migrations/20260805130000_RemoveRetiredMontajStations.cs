using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniMesApi.Migrations
{
    /// <inheritdoc />
    public partial class RemoveRetiredMontajStations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Katalog kaldırıldıktan sonra görünmesin diye Montaj_Hatti_02/_03 canlı tablolardan silinir.
            migrationBuilder.Sql("""
                DECLARE @retired TABLE (StationId nvarchar(100) NOT NULL PRIMARY KEY);
                INSERT INTO @retired (StationId) VALUES (N'Montaj_Hatti_02'), (N'Montaj_Hatti_03');

                UPDATE mm
                SET mm.ShiftSessionId = NULL
                FROM MachineMetrics AS mm
                INNER JOIN ShiftSessions AS ss ON ss.Id = mm.ShiftSessionId
                INNER JOIN @retired AS r ON r.StationId = ss.StationId;

                UPDATE a
                SET a.ShiftSessionId = NULL
                FROM Alarms AS a
                INNER JOIN ShiftSessions AS ss ON ss.Id = a.ShiftSessionId
                INNER JOIN @retired AS r ON r.StationId = ss.StationId;

                UPDATE s
                SET s.ShiftSessionId = NULL,
                    s.MachineMetricId = NULL
                FROM ScrapLogs AS s
                WHERE s.StationId IN (SELECT StationId FROM @retired)
                   OR s.ShiftSessionId IN (
                        SELECT ss.Id FROM ShiftSessions AS ss
                        INNER JOIN @retired AS r ON r.StationId = ss.StationId);

                UPDATE d
                SET d.ShiftSessionId = NULL,
                    d.AlarmId = NULL,
                    d.MachineMetricId = NULL
                FROM DowntimeEvents AS d
                INNER JOIN @retired AS r ON r.StationId = d.StationId;

                DELETE e
                FROM ShiftSessionEvents AS e
                INNER JOIN ShiftSessions AS ss ON ss.Id = e.ShiftSessionId
                INNER JOIN @retired AS r ON r.StationId = ss.StationId;

                DELETE d
                FROM DowntimeEvents AS d
                INNER JOIN @retired AS r ON r.StationId = d.StationId;

                DELETE s
                FROM ScrapLogs AS s
                INNER JOIN @retired AS r ON r.StationId = s.StationId;

                DELETE mm
                FROM MachineMetrics AS mm
                INNER JOIN @retired AS r ON r.StationId = mm.StationId;

                UPDATE ss
                SET ss.ActiveWorkOrderId = NULL
                FROM ShiftSessions AS ss
                WHERE ss.ActiveWorkOrderId IN (
                    SELECT wo.Id FROM WorkOrders AS wo
                    INNER JOIN @retired AS r ON r.StationId = wo.Station);

                UPDATE ss
                SET ss.ActiveBatchId = NULL
                FROM ShiftSessions AS ss
                WHERE ss.ActiveBatchId IN (
                    SELECT b.Id FROM Batches AS b
                    INNER JOIN @retired AS r ON r.StationId = b.Station);

                DELETE ss
                FROM ShiftSessions AS ss
                INNER JOIN @retired AS r ON r.StationId = ss.StationId;

                DELETE sr
                FROM StationRuntimes AS sr
                INNER JOIN @retired AS r ON r.StationId = sr.StationId;

                UPDATE s
                SET s.WorkOrderId = NULL,
                    s.BatchId = NULL
                FROM ScrapLogs AS s
                WHERE s.WorkOrderId IN (
                    SELECT wo.Id FROM WorkOrders AS wo
                    INNER JOIN @retired AS r ON r.StationId = wo.Station)
                   OR s.BatchId IN (
                    SELECT b.Id FROM Batches AS b
                    INNER JOIN @retired AS r ON r.StationId = b.Station);

                DELETE b
                FROM Batches AS b
                INNER JOIN @retired AS r ON r.StationId = b.Station;

                DELETE wo
                FROM WorkOrders AS wo
                INNER JOIN @retired AS r ON r.StationId = wo.Station;

                DELETE a
                FROM Alarms AS a
                INNER JOIN @retired AS r ON r.StationId = a.Station;

                IF OBJECT_ID(N'dbo.UretimKayitlari', N'U') IS NOT NULL
                BEGIN
                    UPDATE u
                    SET u.IstasyonAdi = N'Montaj_Hatti_01'
                    FROM UretimKayitlari AS u
                    WHERE u.IstasyonAdi IN (
                        N'Montaj_Hatti_02',
                        N'Montaj_Hatti_03',
                        N'Montaj Hattı 2',
                        N'Montaj Hattı 3');
                END
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Veri silme kasıtlı olarak geri alınmaz.
        }
    }
}
