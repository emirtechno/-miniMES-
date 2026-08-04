using FluentValidation.TestHelper;
using MiniMesApi.DTOs;
using MiniMesApi.Models;
using MiniMesApi.Validators;

namespace MiniMesApi.Tests;

/// <summary>O8 — FluentValidation for Alarm severity and WorkOrder DTOs.</summary>
public sealed class FluentValidationPhase3Tests
{
    [Theory]
    [InlineData("Uyarı")]
    [InlineData("Düşük")]
    [InlineData("Yüksek")]
    [InlineData("Kritik")]
    public void CreateAlarm_accepts_known_severities(string severity)
    {
        var validator = new CreateAlarmDtoValidator();
        var result = validator.TestValidate(new CreateAlarmDto
        {
            Title = "Test alarm başlığı",
            Station = StationCatalog.AssemblyLine1,
            Severity = severity,
            Description = "ok"
        });
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void CreateAlarm_rejects_unknown_severity()
    {
        var validator = new CreateAlarmDtoValidator();
        var result = validator.TestValidate(new CreateAlarmDto
        {
            Title = "Test alarm başlığı",
            Station = StationCatalog.AssemblyLine1,
            Severity = "Mega",
            Description = "x"
        });
        result.ShouldHaveValidationErrorFor(x => x.Severity);
    }

    [Fact]
    public void CreateWorkOrder_rejects_invalid_station()
    {
        var validator = new CreateWorkOrderDtoValidator();
        var result = validator.TestValidate(new CreateWorkOrderDto
        {
            OrderNo = "WO-TEST-1",
            Product = "Ürün A",
            Station = "Yok_Istasyon",
            Quantity = 10
        });
        result.ShouldHaveValidationErrorFor(x => x.Station);
    }

    [Fact]
    public void StartFactorySimulation_rejects_invalid_station_ids()
    {
        var validator = new StartFactorySimulationRequestValidator();
        var result = validator.TestValidate(new StartFactorySimulationRequest
        {
            StationIds = ["Yok_Istasyon"]
        });
        result.ShouldHaveValidationErrorFor("StationIds[0]");
    }
}
