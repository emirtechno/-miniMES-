using Microsoft.EntityFrameworkCore;
using MiniMesApi.Models;
using MiniMesApi.Middlewares;
using FluentValidation;
using MiniMesApi.Validators;

// ... diğer servisler ...

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy => policy.AllowAnyOrigin()
                        .AllowAnyHeader()
                        .AllowAnyMethod());
});

// 1. Veritabanı Bağlantısı
builder.Services.AddDbContext<MesDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// --- JSON Naming Policy Ayarı (PascalCase / Birebir İsimlendirme) ---
builder.Services.AddControllers();

builder.Services.AddEndpointsApiExplorer();

// --- Validator Kısımları


// FluentValidation Servis Kaydı
builder.Services.AddValidatorsFromAssemblyContaining<CreateUretimKayitDtoValidator>();

// 2. Özel Swagger Yapılandırması
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new()
    {
        Title = "Vestel MES - Üretim Takip API",
        Version = "v1.0",
        Description = "Bu API, Vestel üretim hatlarındaki ürün montaj, test ve kalite verilerini yönetmek amacıyla geliştirilmiştir.",
        Contact = new()
        {
            Name = "Teknoloji Direktörlüğü / MES Ekibi"
        }
    });
});

var app = builder.Build();

// --- ÖNEMLİ: Kendi Exception Middleware'imizi En Başa Ekliyoruz ---
app.UseMiddleware<ExceptionMiddleware>();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<MesDbContext>();
    db.Database.EnsureCreated();

    try
    {
        var createAlarmsTableSql = @"
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Alarms]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Alarms](
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [Title] NVARCHAR(100) NOT NULL,
        [Station] NVARCHAR(80) NULL,
        [Severity] NVARCHAR(20) NOT NULL,
        [Time] DATETIME2 NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [Description] NVARCHAR(400) NULL
    );
END
";
        db.Database.ExecuteSqlRaw(createAlarmsTableSql);
    }
    catch { }

    try
    {
        if (!db.Alarms.Any())
        {
            db.Alarms.AddRange(
                new Alarm
                {
                    Title = "Hız Sensörü Arızası",
                    Station = "Montaj_Hatti_02",
                    Severity = "Kritik",
                    Time = DateTime.Now.AddMinutes(-22),
                    Status = "Açık",
                    Description = "Üretim hızı beklenen değerlerin altında."
                },
                new Alarm
                {
                    Title = "Yüksek Basınç",
                    Station = "Test_Ve_Paketleme_Istasyonu",
                    Severity = "Uyarı",
                    Time = DateTime.Now.AddMinutes(-8),
                    Status = "Onaylandı",
                    Description = "Geçici basınç sapması tespit edildi."
                }
            );
            db.SaveChanges();
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Alarm seeding hatası: {ex.Message}");
    }
}

app.UseCors("AllowReactApp");

// 3. Swagger Middleware
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Vestel MES API v1");
        c.DocumentTitle = "Vestel MES API Dokümantasyonu";
    });
}

app.UseAuthorization();
app.MapControllers();

app.Run();