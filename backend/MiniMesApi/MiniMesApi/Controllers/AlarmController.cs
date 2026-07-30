using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniMesApi.Models;

namespace MiniMesApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AlarmController : ControllerBase
    {
        private readonly MesDbContext _context;

        public AlarmController(MesDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Alarm>>> GetAlarms()
        {
            return await _context.Alarms
                .AsNoTracking()
                .OrderByDescending(a => a.Time)
                .ToListAsync();
        }

        [HttpPost]
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
                return StatusCode(500, new { error = "Server error while creating alarm.", detail = ex.Message });
            }
        }

        [HttpPut("acknowledge/{id}")]
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
                return StatusCode(500, new { error = "Server error while acknowledging alarm.", detail = ex.Message });
            }
        }

        // ==========================================
        // 🚨 ALARM SİLME (DELETE) ENDPOINT'İ (EKLENDİ)
        // ==========================================
        [HttpDelete("{id}")]
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
                return StatusCode(500, new { error = "Server error while deleting alarm.", detail = ex.Message });
            }
        }
    }
}