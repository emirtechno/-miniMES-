using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniMesApi.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkOrderDeletedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_WorkOrders_Status",
                table: "WorkOrders");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DeletedAt",
                table: "WorkOrders",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_DeletedAt",
                table: "WorkOrders",
                column: "DeletedAt");

            migrationBuilder.AddCheckConstraint(
                name: "CK_WorkOrders_Status",
                table: "WorkOrders",
                sql: "[Status] IN (N'Bekliyor', N'Devam Ediyor', N'Tamamlandı', N'Arşivlendi')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WorkOrders_DeletedAt",
                table: "WorkOrders");

            migrationBuilder.DropCheckConstraint(
                name: "CK_WorkOrders_Status",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "WorkOrders");

            migrationBuilder.AddCheckConstraint(
                name: "CK_WorkOrders_Status",
                table: "WorkOrders",
                sql: "[Status] IN (N'Bekliyor', N'Devam Ediyor', N'Tamamlandı')");
        }
    }
}
