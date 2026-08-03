using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MiniMesApi.Models;
using MiniMesApi.Middlewares;
using FluentValidation;
using MiniMesApi.Options;
using MiniMesApi.Services;
using MiniMesApi.Validators;

// ... diğer servisler ...

var builder = WebApplication.CreateBuilder(args);
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? throw new InvalidOperationException("Cors:AllowedOrigins yapılandırılmalıdır.");

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy => policy.WithOrigins(allowedOrigins)
                        .AllowAnyHeader()
                        .AllowAnyMethod());
});

// 1. Veritabanı Bağlantısı
builder.Services.AddDbContext<MesDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddOptions<OeeSimulationOptions>()
    .Bind(builder.Configuration.GetSection(OeeSimulationOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
builder.Services.AddOptions<MachineMetricRetentionOptions>()
    .Bind(builder.Configuration.GetSection(MachineMetricRetentionOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key yapılandırılmalıdır.");
var jwtIssuer = builder.Configuration["Jwt:Issuer"]
    ?? throw new InvalidOperationException("Jwt:Issuer yapılandırılmalıdır.");
var jwtAudience = builder.Configuration["Jwt:Audience"]
    ?? throw new InvalidOperationException("Jwt:Audience yapılandırılmalıdır.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ClockSkew = TimeSpan.Zero
    });

// --- JSON Naming Policy Ayarı (PascalCase / Birebir İsimlendirme) ---
builder.Services.AddControllers();

builder.Services.AddEndpointsApiExplorer();

if (builder.Environment.IsDevelopment() &&
    builder.Configuration.GetValue<bool>($"{OeeSimulationOptions.SectionName}:Enabled"))
{
    builder.Services.AddHostedService<OeeSimulationService>();
}

if (builder.Configuration.GetValue<bool>($"{MachineMetricRetentionOptions.SectionName}:Enabled"))
{
    builder.Services.AddHostedService<MachineMetricRetentionService>();
}

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

// --- ÖNEMLİ:Exception Middleware ---
app.UseMiddleware<ExceptionMiddleware>();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<MesDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DatabaseInitialization");
    await db.Database.MigrateAsync();

    if (app.Environment.IsDevelopment())
    {
        try
        {
            if (!await db.Alarms.AnyAsync())
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
                await db.SaveChangesAsync();
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Alarm başlangıç verileri eklenemedi.");
        }
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

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
