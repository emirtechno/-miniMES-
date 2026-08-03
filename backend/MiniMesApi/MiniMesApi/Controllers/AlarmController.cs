using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
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
        public async Task<ActionResult<IEnumerable<Alarm>>> GetAlarms(
            [FromQuery] int limit = 100,
            CancellationToken cancellationToken = default)
        {
            limit = Math.Clamp(limit, 1, 500);

            return await _context.Alarms
                .AsNoTracking()
                .OrderByDescending(a => a.Time)
                .Take(limit)
                .ToListAsync(cancellationToken);
        }

        [HttpPost]
        [Authorize(Roles = "Admin,Operator")]
        public async Task<ActionResult<Alarm>> CreateAlarm([FromBody] Alarm alarm)
        {
            if (alarm == null)
            {
                return BadRequest(new { error = "Request body is null or invalid JSON." });
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                alarm.Time = alarm.Time == default ? DateTime.Now : alarm.Time;
                alarm.Status = string.IsNullOrWhiteSpace(alarm.Status) ? "Açık" : alarm.Status;

                _context.Alarms.Add(alarm);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetAlarms), new { }, alarm);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Alarm oluşturulurken beklenmeyen hata oluştu.");
                return Problem(statusCode: StatusCodes.Status500InternalServerError, title: "Alarm oluşturulamadı.");
            }
        }

        [HttpPut("acknowledge/{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> AcknowledgeAlarm(int id)
        {
            try
            {
                var alarm = await _context.Alarms.FindAsync(id);
                if (alarm == null)
                {
                    return NotFound(new { error = "Alarm bulunamadı." });
                }

                alarm.Status = "Onaylandı";
                await _context.SaveChangesAsync();
                return Ok(alarm);
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
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteAlarm(int id)
        {
            try
            {
                var alarm = await _context.Alarms.FindAsync(id);
                if (alarm == null)
                {
                    return NotFound(new { error = "Silinecek alarm bulunamadı." });
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
    }
}
