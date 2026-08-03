using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniMesApi.Migrations
{
    /// <inheritdoc />
    public partial class AddPhaseThreePaginationConcurrency : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UretimKayitlari_IsDeleted_UretimTarihi",
                table: "UretimKayitlari");

            migrationBuilder.DropIndex(
                name: "IX_MachineMetrics_RecordedAt",
                table: "MachineMetrics");

            migrationBuilder.DropIndex(
                name: "IX_MachineMetrics_StationId_RecordedAt",
                table: "MachineMetrics");

            migrationBuilder.DropIndex(
                name: "IX_Alarms_Time",
                table: "Alarms");

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "WorkOrders",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.CreateIndex(
                name: "IX_UretimKayitlari_IsDeleted_UretimTarihi_ID",
                table: "UretimKayitlari",
                columns: new[] { "IsDeleted", "UretimTarihi", "ID" },
                descending: new[] { false, true, true });

            migrationBuilder.CreateIndex(
                name: "IX_MachineMetrics_RecordedAt_Id",
                table: "MachineMetrics",
                columns: new[] { "RecordedAt", "Id" },
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_MachineMetrics_StationId_RecordedAt_Id",
                table: "MachineMetrics",
                columns: new[] { "StationId", "RecordedAt", "Id" },
                descending: new[] { false, true, true });

            migrationBuilder.CreateIndex(
                name: "IX_Alarms_Time_Id",
                table: "Alarms",
                columns: new[] { "Time", "Id" },
                descending: new bool[0]);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UretimKayitlari_IsDeleted_UretimTarihi_ID",
                table: "UretimKayitlari");

            migrationBuilder.DropIndex(
                name: "IX_MachineMetrics_RecordedAt_Id",
                table: "MachineMetrics");

            migrationBuilder.DropIndex(
                name: "IX_MachineMetrics_StationId_RecordedAt_Id",
                table: "MachineMetrics");

            migrationBuilder.DropIndex(
                name: "IX_Alarms_Time_Id",
                table: "Alarms");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "WorkOrders");

            migrationBuilder.CreateIndex(
                name: "IX_UretimKayitlari_IsDeleted_UretimTarihi",
                table: "UretimKayitlari",
                columns: new[] { "IsDeleted", "UretimTarihi" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_MachineMetrics_RecordedAt",
                table: "MachineMetrics",
                column: "RecordedAt",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_MachineMetrics_StationId_RecordedAt",
                table: "MachineMetrics",
                columns: new[] { "StationId", "RecordedAt" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_Alarms_Time",
                table: "Alarms",
                column: "Time",
                descending: new bool[0]);
        }
    }
}
