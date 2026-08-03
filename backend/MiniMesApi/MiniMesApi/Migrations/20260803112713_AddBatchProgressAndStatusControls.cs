using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniMesApi.Migrations
{
    /// <inheritdoc />
    public partial class AddBatchProgressAndStatusControls : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ProducedQuantity",
                table: "Batches",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TargetQuantity",
                table: "Batches",
                type: "int",
                nullable: false,
                defaultValue: 100);

            migrationBuilder.Sql("""
                UPDATE [Batches]
                SET
                    [TargetQuantity] = CASE WHEN [TargetQuantity] <= 0 THEN 100 ELSE [TargetQuantity] END,
                    [ProducedQuantity] = CASE
                        WHEN [Status] = N'Tamamlandı' THEN CASE WHEN [TargetQuantity] <= 0 THEN 100 ELSE [TargetQuantity] END
                        WHEN [Status] = N'İşlemde' THEN CASE WHEN [ProducedQuantity] <= 0 THEN 40 ELSE [ProducedQuantity] END
                        ELSE [ProducedQuantity]
                    END;
                """);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Batches_ProducedQuantity",
                table: "Batches",
                sql: "[ProducedQuantity] >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Batches_Status",
                table: "Batches",
                sql: "[Status] IN (N'Bekliyor', N'İşlemde', N'Tamamlandı')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Batches_TargetQuantity",
                table: "Batches",
                sql: "[TargetQuantity] > 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Batches_ProducedQuantity",
                table: "Batches");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Batches_Status",
                table: "Batches");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Batches_TargetQuantity",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "ProducedQuantity",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "TargetQuantity",
                table: "Batches");
        }
    }
}
