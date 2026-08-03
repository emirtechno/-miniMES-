using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.DTOs;
using MiniMesApi.Security;
using MiniMesApi.Models;

namespace MiniMesApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class AlarmController : ControllerBase
    {
        private readonly MesDbContext _context;
        private readonly ILogger<AlarmController> _logger;

        public AlarmController(MesDbContext context, ILogger<AlarmController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<AlarmDto>>> GetAlarms(
            [FromQuery] int limit = 100,
            CancellationToken cancellationToken = default)
        {
            limit = Math.Clamp(limit, 1, 500);

            return await _context.Alarms
                .AsNoTracking()
                .OrderByDescending(a => a.Time)
                .Take(limit)
                .Select(alarm => new AlarmDto
                {
                    Id = alarm.Id,
                    Title = alarm.Title,
                    Station = alarm.Station,
                    Severity = alarm.Severity,
                    Time = alarm.Time,
                    Status = alarm.Status,
                    Description = alarm.Description
                })
                .ToListAsync(cancellationToken);
        }

        [HttpPost]
        [Authorize(Policy = PolicyNames.AlarmWrite)]
        public async Task<ActionResult<AlarmDto>> CreateAlarm([FromBody] CreateAlarmDto request)
        {
            var alarm = new Alarm
            {
                Title = request.Title,
                Station = request.Station,
                Severity = request.Severity,
                Description = request.Description,
                Time = DateTime.UtcNow,
                Status = "Açık"
            };

            try
            {
                _context.Alarms.Add(alarm);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetAlarms), ToDto(alarm));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Alarm oluşturulurken beklenmeyen hata oluştu.");
                return Problem(statusCode: StatusCodes.Status500InternalServerError, title: "Alarm oluşturulamadı.");
            }
        }

        [HttpPut("acknowledge/{id}")]
        [Authorize(Policy = PolicyNames.AlarmManage)]
        public async Task<IActionResult> AcknowledgeAlarm(int id)
        {
            try
            {
                var alarm = await _context.Alarms.FindAsync(id);
                if (alarm == null)
                {
                    return Problem(statusCode: StatusCodes.Status404NotFound, title: "Alarm bulunamadı.");
                }

                alarm.Status = "Onaylandı";
                await _context.SaveChangesAsync();
                return Ok(ToDto(alarm));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "{AlarmId} numaralı alarm onaylanırken beklenmeyen hata oluştu.", id);
                return Problem(statusCode: StatusCodes.Status500InternalServerError, title: "Alarm onaylanamadı.");
            }
        }

        // ==========================================
        // 🚨 ALARM SİLME (DELETE) ENDPOINT'İ (EKLENDİ)
        // ==========================================
        [HttpDelete("{id}")]
        [Authorize(Policy = PolicyNames.AlarmManage)]
        public async Task<IActionResult> DeleteAlarm(int id)
        {
            try
            {
                var alarm = await _context.Alarms.FindAsync(id);
                if (alarm == null)
                {
                    return Problem(statusCode: StatusCodes.Status404NotFound, title: "Silinecek alarm bulunamadı.");
                }

                _context.Alarms.Remove(alarm);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Alarm başarıyla silindi.", id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "{AlarmId} numaralı alarm silinirken beklenmeyen hata oluştu.", id);
                return Problem(statusCode: StatusCodes.Status500InternalServerError, title: "Alarm silinemedi.");
            }
        }

        private static AlarmDto ToDto(Alarm alarm)
        {
            return new AlarmDto
            {
                Id = alarm.Id,
                Title = alarm.Title,
                Station = alarm.Station,
                Severity = alarm.Severity,
                Time = alarm.Time,
                Status = alarm.Status,
                Description = alarm.Description
            };
        }
    }
}
