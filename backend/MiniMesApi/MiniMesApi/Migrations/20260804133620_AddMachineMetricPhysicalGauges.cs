using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniMesApi.Migrations
{
    /// <inheritdoc />
    public partial class AddMachineMetricPhysicalGauges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "Rpm",
                table: "MachineMetrics",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Temperature",
                table: "MachineMetrics",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Vibration",
                table: "MachineMetrics",
                type: "float",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_MachineMetrics_PhysicalGauges",
                table: "MachineMetrics",
                sql: "([Temperature] IS NULL OR ([Temperature] >= 0 AND [Temperature] <= 200)) AND ([Rpm] IS NULL OR [Rpm] >= 0) AND ([Vibration] IS NULL OR [Vibration] >= 0)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_MachineMetrics_PhysicalGauges",
                table: "MachineMetrics");

            migrationBuilder.DropColumn(
                name: "Rpm",
                table: "MachineMetrics");

            migrationBuilder.DropColumn(
                name: "Temperature",
                table: "MachineMetrics");

            migrationBuilder.DropColumn(
                name: "Vibration",
                table: "MachineMetrics");
        }
    }
}
