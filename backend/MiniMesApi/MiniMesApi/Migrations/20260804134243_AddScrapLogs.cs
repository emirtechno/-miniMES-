using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniMesApi.Migrations
{
    /// <inheritdoc />
    public partial class AddScrapLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ScrapLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    StationId = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    ReasonCode = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    WorkOrderId = table.Column<int>(type: "int", nullable: true),
                    BatchId = table.Column<int>(type: "int", nullable: true),
                    ShiftSessionId = table.Column<int>(type: "int", nullable: true),
                    OperatorUserId = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    RecordedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    MachineMetricId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScrapLogs", x => x.Id);
                    table.CheckConstraint("CK_ScrapLogs_Quantity", "[Quantity] > 0");
                    table.ForeignKey(
                        name: "FK_ScrapLogs_Batches_BatchId",
                        column: x => x.BatchId,
                        principalTable: "Batches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ScrapLogs_MachineMetrics_MachineMetricId",
                        column: x => x.MachineMetricId,
                        principalTable: "MachineMetrics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ScrapLogs_WorkOrders_WorkOrderId",
                        column: x => x.WorkOrderId,
                        principalTable: "WorkOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ScrapLogs_BatchId",
                table: "ScrapLogs",
                column: "BatchId");

            migrationBuilder.CreateIndex(
                name: "IX_ScrapLogs_MachineMetricId",
                table: "ScrapLogs",
                column: "MachineMetricId");

            migrationBuilder.CreateIndex(
                name: "IX_ScrapLogs_ShiftSessionId",
                table: "ScrapLogs",
                column: "ShiftSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_ScrapLogs_StationId_RecordedAt_Id",
                table: "ScrapLogs",
                columns: new[] { "StationId", "RecordedAt", "Id" },
                descending: new[] { false, true, true });

            migrationBuilder.CreateIndex(
                name: "IX_ScrapLogs_WorkOrderId",
                table: "ScrapLogs",
                column: "WorkOrderId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ScrapLogs");
        }
    }
}
