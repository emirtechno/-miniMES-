using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniMesApi.Migrations
{
    /// <inheritdoc />
    public partial class HardenShiftSessionSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Batches_Products_ProductId",
                table: "Batches");

            migrationBuilder.DropTable(
                name: "TraceabilityLogs");

            migrationBuilder.DropTable(
                name: "Stations");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.AddColumn<int>(
                name: "ProductId",
                table: "WorkOrders",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ActiveBatchId",
                table: "ShiftSessions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ActiveWorkOrderId",
                table: "ShiftSessions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "BreakStartedAt",
                table: "ShiftSessions",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SecondaryOperatorName",
                table: "ShiftSessions",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SecondaryOperatorUserId",
                table: "ShiftSessions",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "SetupStartedAt",
                table: "ShiftSessions",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ShiftSessionId",
                table: "Alarms",
                type: "int",
                nullable: true);

            // Data hardening before unique index / new FKs (safe on empty and populated DBs).
            migrationBuilder.Sql("""
                -- Keep newest open session per user; end older duplicates.
                ;WITH OpenSessions AS (
                    SELECT Id, UserId,
                           ROW_NUMBER() OVER (PARTITION BY UserId ORDER BY StartedAt DESC, Id DESC) AS rn
                    FROM ShiftSessions
                    WHERE Status <> N'Ended'
                )
                UPDATE s
                SET Status = N'Ended',
                    EndedAt = COALESCE(s.EndedAt, SYSUTCDATETIME()),
                    UpdatedAt = SYSUTCDATETIME(),
                    UpdatedBy = COALESCE(s.UpdatedBy, N'migration')
                FROM ShiftSessions s
                INNER JOIN OpenSessions o ON o.Id = s.Id
                WHERE o.rn > 1;

                -- Backfill timer anchors for currently open break/setup sessions.
                UPDATE ShiftSessions
                SET BreakStartedAt = COALESCE(BreakStartedAt, UpdatedAt, StartedAt)
                WHERE Status = N'OnBreak' AND BreakStartedAt IS NULL;

                UPDATE ShiftSessions
                SET SetupStartedAt = COALESCE(SetupStartedAt, UpdatedAt, StartedAt)
                WHERE Status = N'InSetup' AND SetupStartedAt IS NULL;

                -- Orphan scrap session ids must be null before FK is added.
                UPDATE ScrapLogs
                SET ShiftSessionId = NULL
                WHERE ShiftSessionId IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM ShiftSessions s WHERE s.Id = ScrapLogs.ShiftSessionId
                  );

                -- Seed Products from distinct WorkOrder/Batch catalog strings (light wire).
                ;WITH Labels AS (
                    SELECT DISTINCT LTRIM(RTRIM(Product)) AS Label
                    FROM (
                        SELECT Product FROM WorkOrders
                        UNION ALL
                        SELECT Product FROM Batches
                    ) u
                    WHERE Product IS NOT NULL AND LTRIM(RTRIM(Product)) <> N''
                ),
                Codes AS (
                    SELECT Label, LEFT(Label, 50) AS ProductCode, LEFT(Label, 100) AS ProductName,
                           ROW_NUMBER() OVER (PARTITION BY LEFT(Label, 50) ORDER BY Label) AS rn
                    FROM Labels
                )
                INSERT INTO Products (ProductCode, ProductName, Description, CreatedAt)
                SELECT c.ProductCode, c.ProductName,
                       N'Seeded from work-order/batch catalog labels',
                       SYSUTCDATETIME()
                FROM Codes c
                WHERE c.rn = 1
                  AND NOT EXISTS (
                      SELECT 1 FROM Products p WHERE p.ProductCode = c.ProductCode
                  );

                UPDATE wo
                SET ProductId = p.Id
                FROM WorkOrders wo
                INNER JOIN Products p
                    ON p.ProductCode = LEFT(LTRIM(RTRIM(wo.Product)), 50)
                    OR p.ProductName = LEFT(LTRIM(RTRIM(wo.Product)), 100)
                WHERE wo.ProductId IS NULL;

                UPDATE b
                SET ProductId = p.Id
                FROM Batches b
                INNER JOIN Products p
                    ON p.ProductCode = LEFT(LTRIM(RTRIM(b.Product)), 50)
                    OR p.ProductName = LEFT(LTRIM(RTRIM(b.Product)), 100)
                WHERE b.ProductId IS NULL;
                """);

            migrationBuilder.CreateTable(
                name: "DowntimeEvents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ShiftSessionId = table.Column<int>(type: "int", nullable: true),
                    StationId = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    ReasonCode = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    ReasonName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    IsPlanned = table.Column<bool>(type: "bit", nullable: false),
                    IsEmergency = table.Column<bool>(type: "bit", nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    EndedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    DurationSeconds = table.Column<int>(type: "int", nullable: true),
                    Source = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    AlarmId = table.Column<int>(type: "int", nullable: true),
                    MachineMetricId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DowntimeEvents", x => x.Id);
                    table.CheckConstraint("CK_DowntimeEvents_Duration", "[DurationSeconds] IS NULL OR [DurationSeconds] >= 0");
                    table.CheckConstraint("CK_DowntimeEvents_Source", "[Source] IN (N'Operator', N'Simulation', N'Alarm')");
                    table.ForeignKey(
                        name: "FK_DowntimeEvents_Alarms_AlarmId",
                        column: x => x.AlarmId,
                        principalTable: "Alarms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_DowntimeEvents_MachineMetrics_MachineMetricId",
                        column: x => x.MachineMetricId,
                        principalTable: "MachineMetrics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_DowntimeEvents_ShiftSessions_ShiftSessionId",
                        column: x => x.ShiftSessionId,
                        principalTable: "ShiftSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ShiftSessionEvents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ShiftSessionId = table.Column<int>(type: "int", nullable: false),
                    FromStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ToStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ReasonCode = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    OccurredAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ActorUserId = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShiftSessionEvents", x => x.Id);
                    table.CheckConstraint("CK_ShiftSessionEvents_FromStatus", "[FromStatus] IN (N'', N'Active', N'OnBreak', N'InSetup', N'Ended')");
                    table.CheckConstraint("CK_ShiftSessionEvents_ToStatus", "[ToStatus] IN (N'Active', N'OnBreak', N'InSetup', N'Ended')");
                    table.ForeignKey(
                        name: "FK_ShiftSessionEvents_ShiftSessions_ShiftSessionId",
                        column: x => x.ShiftSessionId,
                        principalTable: "ShiftSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_ProductId",
                table: "WorkOrders",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_ShiftSessions_ActiveBatchId",
                table: "ShiftSessions",
                column: "ActiveBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_ShiftSessions_ActiveWorkOrderId",
                table: "ShiftSessions",
                column: "ActiveWorkOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_ShiftSessions_UserId_Open",
                table: "ShiftSessions",
                column: "UserId",
                unique: true,
                filter: "[Status] <> N'Ended'");

            migrationBuilder.CreateIndex(
                name: "IX_Alarms_ShiftSessionId",
                table: "Alarms",
                column: "ShiftSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_DowntimeEvents_AlarmId",
                table: "DowntimeEvents",
                column: "AlarmId");

            migrationBuilder.CreateIndex(
                name: "IX_DowntimeEvents_MachineMetricId",
                table: "DowntimeEvents",
                column: "MachineMetricId");

            migrationBuilder.CreateIndex(
                name: "IX_DowntimeEvents_ShiftSessionId",
                table: "DowntimeEvents",
                column: "ShiftSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_DowntimeEvents_StationId_StartedAt_Id",
                table: "DowntimeEvents",
                columns: new[] { "StationId", "StartedAt", "Id" },
                descending: new[] { false, true, true });

            migrationBuilder.CreateIndex(
                name: "IX_ShiftSessionEvents_ShiftSessionId_OccurredAt_Id",
                table: "ShiftSessionEvents",
                columns: new[] { "ShiftSessionId", "OccurredAt", "Id" },
                descending: new[] { false, true, true });

            migrationBuilder.AddForeignKey(
                name: "FK_Alarms_ShiftSessions_ShiftSessionId",
                table: "Alarms",
                column: "ShiftSessionId",
                principalTable: "ShiftSessions",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Batches_Products_ProductId",
                table: "Batches",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ScrapLogs_ShiftSessions_ShiftSessionId",
                table: "ScrapLogs",
                column: "ShiftSessionId",
                principalTable: "ShiftSessions",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ShiftSessions_Batches_ActiveBatchId",
                table: "ShiftSessions",
                column: "ActiveBatchId",
                principalTable: "Batches",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ShiftSessions_WorkOrders_ActiveWorkOrderId",
                table: "ShiftSessions",
                column: "ActiveWorkOrderId",
                principalTable: "WorkOrders",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_WorkOrders_Products_ProductId",
                table: "WorkOrders",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Alarms_ShiftSessions_ShiftSessionId",
                table: "Alarms");

            migrationBuilder.DropForeignKey(
                name: "FK_Batches_Products_ProductId",
                table: "Batches");

            migrationBuilder.DropForeignKey(
                name: "FK_ScrapLogs_ShiftSessions_ShiftSessionId",
                table: "ScrapLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_ShiftSessions_Batches_ActiveBatchId",
                table: "ShiftSessions");

            migrationBuilder.DropForeignKey(
                name: "FK_ShiftSessions_WorkOrders_ActiveWorkOrderId",
                table: "ShiftSessions");

            migrationBuilder.DropForeignKey(
                name: "FK_WorkOrders_Products_ProductId",
                table: "WorkOrders");

            migrationBuilder.DropTable(
                name: "DowntimeEvents");

            migrationBuilder.DropTable(
                name: "ShiftSessionEvents");

            migrationBuilder.DropIndex(
                name: "IX_WorkOrders_ProductId",
                table: "WorkOrders");

            migrationBuilder.DropIndex(
                name: "IX_ShiftSessions_ActiveBatchId",
                table: "ShiftSessions");

            migrationBuilder.DropIndex(
                name: "IX_ShiftSessions_ActiveWorkOrderId",
                table: "ShiftSessions");

            migrationBuilder.DropIndex(
                name: "IX_ShiftSessions_UserId_Open",
                table: "ShiftSessions");

            migrationBuilder.DropIndex(
                name: "IX_Alarms_ShiftSessionId",
                table: "Alarms");

            migrationBuilder.DropColumn(
                name: "ProductId",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "ActiveBatchId",
                table: "ShiftSessions");

            migrationBuilder.DropColumn(
                name: "ActiveWorkOrderId",
                table: "ShiftSessions");

            migrationBuilder.DropColumn(
                name: "BreakStartedAt",
                table: "ShiftSessions");

            migrationBuilder.DropColumn(
                name: "SecondaryOperatorName",
                table: "ShiftSessions");

            migrationBuilder.DropColumn(
                name: "SecondaryOperatorUserId",
                table: "ShiftSessions");

            migrationBuilder.DropColumn(
                name: "SetupStartedAt",
                table: "ShiftSessions");

            migrationBuilder.DropColumn(
                name: "ShiftSessionId",
                table: "Alarms");

            migrationBuilder.CreateTable(
                name: "Stations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    StationCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    StationName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Stations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FullName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Role = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Shift = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Username = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TraceabilityLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BatchId = table.Column<int>(type: "int", nullable: false),
                    StationId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    CycleNotes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    EntryTime = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ExitTime = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TraceabilityLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TraceabilityLogs_Batches_BatchId",
                        column: x => x.BatchId,
                        principalTable: "Batches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TraceabilityLogs_Stations_StationId",
                        column: x => x.StationId,
                        principalTable: "Stations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TraceabilityLogs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Stations_StationCode",
                table: "Stations",
                column: "StationCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TraceabilityLogs_BatchId",
                table: "TraceabilityLogs",
                column: "BatchId");

            migrationBuilder.CreateIndex(
                name: "IX_TraceabilityLogs_StationId",
                table: "TraceabilityLogs",
                column: "StationId");

            migrationBuilder.CreateIndex(
                name: "IX_TraceabilityLogs_UserId",
                table: "TraceabilityLogs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Batches_Products_ProductId",
                table: "Batches",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id");
        }
    }
}
