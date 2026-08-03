using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniMesApi.Migrations
{
    /// <inheritdoc />
    public partial class AddAlarmAcknowledgeResolveAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "AcknowledgedAt",
                table: "Alarms",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AcknowledgedBy",
                table: "Alarms",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ResolvedAt",
                table: "Alarms",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResolvedBy",
                table: "Alarms",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AcknowledgedAt",
                table: "Alarms");

            migrationBuilder.DropColumn(
                name: "AcknowledgedBy",
                table: "Alarms");

            migrationBuilder.DropColumn(
                name: "ResolvedAt",
                table: "Alarms");

            migrationBuilder.DropColumn(
                name: "ResolvedBy",
                table: "Alarms");
        }
    }
}
