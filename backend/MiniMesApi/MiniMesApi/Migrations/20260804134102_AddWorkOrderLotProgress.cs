using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniMesApi.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkOrderLotProgress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CompletedQuantity",
                table: "WorkOrders",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "WorkOrderId",
                table: "Batches",
                type: "int",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_WorkOrders_CompletedQuantity",
                table: "WorkOrders",
                sql: "[CompletedQuantity] >= 0 AND [CompletedQuantity] <= [Quantity]");

            migrationBuilder.CreateIndex(
                name: "IX_Batches_Station_Status",
                table: "Batches",
                columns: new[] { "Station", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Batches_WorkOrderId",
                table: "Batches",
                column: "WorkOrderId");

            migrationBuilder.AddForeignKey(
                name: "FK_Batches_WorkOrders_WorkOrderId",
                table: "Batches",
                column: "WorkOrderId",
                principalTable: "WorkOrders",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Batches_WorkOrders_WorkOrderId",
                table: "Batches");

            migrationBuilder.DropCheckConstraint(
                name: "CK_WorkOrders_CompletedQuantity",
                table: "WorkOrders");

            migrationBuilder.DropIndex(
                name: "IX_Batches_Station_Status",
                table: "Batches");

            migrationBuilder.DropIndex(
                name: "IX_Batches_WorkOrderId",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "CompletedQuantity",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "WorkOrderId",
                table: "Batches");
        }
    }
}
