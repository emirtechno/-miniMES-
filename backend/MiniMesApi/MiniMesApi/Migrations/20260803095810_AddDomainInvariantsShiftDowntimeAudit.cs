using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniMesApi.Migrations
{
    /// <inheritdoc />
    public partial class AddDomainInvariantsShiftDowntimeAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DeletedAtUtc",
                table: "UretimKayitlari",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedByUserId",
                table: "UretimKayitlari",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedByUsername",
                table: "UretimKayitlari",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DowntimeReasonCode",
                table: "MachineMetrics",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "NONE");

            migrationBuilder.AddColumn<string>(
                name: "ShiftCode",
                table: "MachineMetrics",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "SHIFT_A");

            migrationBuilder.Sql("""
                UPDATE MachineMetrics
                SET DowntimeReasonCode = CASE
                        WHEN DowntimeSeconds > 0 THEN N'OTHER'
                        ELSE N'NONE'
                    END,
                    ShiftCode = CASE
                        WHEN DATEPART(HOUR, SWITCHOFFSET(RecordedAt, '+00:00')) >= 6
                             AND DATEPART(HOUR, SWITCHOFFSET(RecordedAt, '+00:00')) < 14 THEN N'SHIFT_A'
                        WHEN DATEPART(HOUR, SWITCHOFFSET(RecordedAt, '+00:00')) >= 14
                             AND DATEPART(HOUR, SWITCHOFFSET(RecordedAt, '+00:00')) < 22 THEN N'SHIFT_B'
                        ELSE N'SHIFT_C'
                    END;
                """);

            migrationBuilder.CreateTable(
                name: "AuditLogs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EntityType = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    EntityId = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Action = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    ActorUserId = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    ActorUsername = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    OccurredAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Details = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLogs", x => x.Id);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_WorkOrders_Status",
                table: "WorkOrders",
                sql: "[Status] IN (N'Bekliyor', N'Devam Ediyor', N'Tamamlandı')");

            migrationBuilder.CreateIndex(
                name: "IX_UretimKayitlari_IsDeleted_DeletedAtUtc",
                table: "UretimKayitlari",
                columns: new[] { "IsDeleted", "DeletedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_MachineMetrics_DowntimeReasonCode",
                table: "MachineMetrics",
                column: "DowntimeReasonCode");

            migrationBuilder.CreateIndex(
                name: "IX_MachineMetrics_ShiftCode_RecordedAt",
                table: "MachineMetrics",
                columns: new[] { "ShiftCode", "RecordedAt" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_MachineMetrics_DowntimeReason",
                table: "MachineMetrics",
                sql: "[DowntimeReasonCode] IN (N'NONE', N'PLANNED_MAINTENANCE', N'BREAKDOWN', N'MATERIAL_SHORTAGE', N'CHANGEOVER', N'NO_OPERATOR', N'QUALITY_HOLD', N'OTHER')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_MachineMetrics_DowntimeReasonConsistency",
                table: "MachineMetrics",
                sql: "([DowntimeSeconds] = 0 AND [DowntimeReasonCode] = N'NONE') OR ([DowntimeSeconds] > 0 AND [DowntimeReasonCode] <> N'NONE')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_MachineMetrics_ShiftCode",
                table: "MachineMetrics",
                sql: "[ShiftCode] IN (N'SHIFT_A', N'SHIFT_B', N'SHIFT_C')");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_EntityType_EntityId_OccurredAtUtc",
                table: "AuditLogs",
                columns: new[] { "EntityType", "EntityId", "OccurredAtUtc" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_OccurredAtUtc",
                table: "AuditLogs",
                column: "OccurredAtUtc",
                descending: new bool[0]);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditLogs");

            migrationBuilder.DropCheckConstraint(
                name: "CK_WorkOrders_Status",
                table: "WorkOrders");

            migrationBuilder.DropIndex(
                name: "IX_UretimKayitlari_IsDeleted_DeletedAtUtc",
                table: "UretimKayitlari");

            migrationBuilder.DropIndex(
                name: "IX_MachineMetrics_DowntimeReasonCode",
                table: "MachineMetrics");

            migrationBuilder.DropIndex(
                name: "IX_MachineMetrics_ShiftCode_RecordedAt",
                table: "MachineMetrics");

            migrationBuilder.DropCheckConstraint(
                name: "CK_MachineMetrics_DowntimeReason",
                table: "MachineMetrics");

            migrationBuilder.DropCheckConstraint(
                name: "CK_MachineMetrics_DowntimeReasonConsistency",
                table: "MachineMetrics");

            migrationBuilder.DropCheckConstraint(
                name: "CK_MachineMetrics_ShiftCode",
                table: "MachineMetrics");

            migrationBuilder.DropColumn(
                name: "DeletedAtUtc",
                table: "UretimKayitlari");

            migrationBuilder.DropColumn(
                name: "DeletedByUserId",
                table: "UretimKayitlari");

            migrationBuilder.DropColumn(
                name: "DeletedByUsername",
                table: "UretimKayitlari");

            migrationBuilder.DropColumn(
                name: "DowntimeReasonCode",
                table: "MachineMetrics");

            migrationBuilder.DropColumn(
                name: "ShiftCode",
                table: "MachineMetrics");
        }
    }
}
