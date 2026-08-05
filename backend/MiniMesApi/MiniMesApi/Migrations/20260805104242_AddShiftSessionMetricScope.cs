using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniMesApi.Migrations
{
    /// <inheritdoc />
    public partial class AddShiftSessionMetricScope : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "DowntimeSeconds",
                table: "ShiftSessions",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "GoodCount",
                table: "ShiftSessions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "NokCount",
                table: "ShiftSessions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "OeePercent",
                table: "ShiftSessions",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ScrapEntered",
                table: "ShiftSessions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SummaryJson",
                table: "ShiftSessions",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ShiftSessionId",
                table: "MachineMetrics",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_MachineMetrics_ShiftSessionId",
                table: "MachineMetrics",
                column: "ShiftSessionId");

            migrationBuilder.AddForeignKey(
                name: "FK_MachineMetrics_ShiftSessions_ShiftSessionId",
                table: "MachineMetrics",
                column: "ShiftSessionId",
                principalTable: "ShiftSessions",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MachineMetrics_ShiftSessions_ShiftSessionId",
                table: "MachineMetrics");

            migrationBuilder.DropIndex(
                name: "IX_MachineMetrics_ShiftSessionId",
                table: "MachineMetrics");

            migrationBuilder.DropColumn(
                name: "DowntimeSeconds",
                table: "ShiftSessions");

            migrationBuilder.DropColumn(
                name: "GoodCount",
                table: "ShiftSessions");

            migrationBuilder.DropColumn(
                name: "NokCount",
                table: "ShiftSessions");

            migrationBuilder.DropColumn(
                name: "OeePercent",
                table: "ShiftSessions");

            migrationBuilder.DropColumn(
                name: "ScrapEntered",
                table: "ShiftSessions");

            migrationBuilder.DropColumn(
                name: "SummaryJson",
                table: "ShiftSessions");

            migrationBuilder.DropColumn(
                name: "ShiftSessionId",
                table: "MachineMetrics");
        }
    }
}
