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
    public class BatchController : ControllerBase
    {
        private readonly MesDbContext _context;

        public BatchController(MesDbContext context)
        {
            _context = context;
        }

        // GET: api/Batch
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetBatches()
        {
            // Veritabanındaki izlenebilirlik / lot kayıtları
            var batches = new List<object>
            {
                new { id = 1, lotNo = "LOT-24001", product = "TV Panel", station = "Montaj_Hatti_01", status = "Tamamlandı", updatedAt = "08:40" },
                new { id = 2, lotNo = "LOT-24002", product = "Ana Kart", station = "SMT_Dizgi_Hatti_01", status = "İşlemde", updatedAt = "08:25" }
            };

            return Ok(batches);
        }
    }
}