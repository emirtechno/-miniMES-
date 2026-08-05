using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniMesApi.Migrations
{
    /// <inheritdoc />
    public partial class AddStationRuntimeAndShiftSession : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ShiftSessions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    StationId = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    ShiftCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    OperatorName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    EndedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    BreakReason = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShiftSessions", x => x.Id);
                    table.CheckConstraint("CK_ShiftSessions_Status", "[Status] IN (N'Active', N'OnBreak', N'InSetup', N'Ended')");
                });

            migrationBuilder.CreateTable(
                name: "StationRuntimes",
                columns: table => new
                {
                    StationId = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Mode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    PauseReason = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StationRuntimes", x => x.StationId);
                    table.CheckConstraint("CK_StationRuntimes_Mode", "[Mode] IN (N'Running', N'Paused', N'Down')");
                });

            migrationBuilder.CreateIndex(
                name: "IX_ShiftSessions_StationId_Status",
                table: "ShiftSessions",
                columns: new[] { "StationId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ShiftSessions_UserId_Status_StartedAt",
                table: "ShiftSessions",
                columns: new[] { "UserId", "Status", "StartedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ShiftSessions");

            migrationBuilder.DropTable(
                name: "StationRuntimes");
        }
    }
}
