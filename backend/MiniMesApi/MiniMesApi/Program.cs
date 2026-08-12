using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using MiniMesApi.Models;
using MiniMesApi.Middlewares;
using FluentValidation;
using MiniMesApi.Options;
using MiniMesApi.Security;
using MiniMesApi.Services;
using MiniMesApi.Validators;

var builder = WebApplication.CreateBuilder(args);
var isTesting = builder.Environment.IsEnvironment("Testing");
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? throw new InvalidOperationException("Cors:AllowedOrigins yapılandırılmalıdır.");

if (builder.Environment.IsProduction() &&
    (builder.Configuration["AllowedHosts"] is null or "*" or ""))
{
    throw new InvalidOperationException("Production ortamında AllowedHosts açıkça yapılandırılmalıdır.");
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy => policy.WithOrigins(allowedOrigins)
                        .AllowAnyHeader()
                        .AllowAnyMethod());
});

// 1. Veritabanı Bağlantısı
builder.Services.AddDbContext<MesDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        sql => sql.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(10),
            errorNumbersToAdd: null)));

builder.Services.AddHealthChecks()
    .AddDbContextCheck<MesDbContext>(
        name: "database",
        failureStatus: HealthStatus.Unhealthy,
        tags: ["ready"]);
builder.Services.AddOptions<OeeSimulationOptions>()
    .Bind(builder.Configuration.GetSection(OeeSimulationOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
builder.Services.AddOptions<MachineMetricRetentionOptions>()
    .Bind(builder.Configuration.GetSection(MachineMetricRetentionOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
builder.Services.AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
    ?? throw new InvalidOperationException("Jwt yapılandırılmalıdır.");
if (jwt.Key.Length < 32)
{
    throw new InvalidOperationException("Jwt:Key en az 32 karakter olmalıdır.");
}

builder.Services.AddIdentityCore<ApplicationUser>(options =>
    {
        // NEDEN: Fabrika operatörü dostu parola — uzunluk + rakam yeterli (sembol/büyük-küçük harf labirenti yok).
        options.Password.RequiredLength = 6;
        options.Password.RequireDigit = true;
        options.Password.RequireLowercase = false;
        options.Password.RequireUppercase = false;
        options.Password.RequireNonAlphanumeric = false;
        options.Password.RequiredUniqueChars = 1;
        options.Lockout.AllowedForNewUsers = true;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        options.User.RequireUniqueEmail = false;
    })
    .AddRoles<IdentityRole>()
    .AddSignInManager()
    .AddEntityFrameworkStores<MesDbContext>()
    .AddDefaultTokenProviders()
    .AddErrorDescriber<TurkishIdentityErrorDescriber>();

// NEDEN: Stateless JWT Bearer — React SPA her API çağrısında Authorization: Bearer gönderir.
// NASIL: Issuer/Audience/Key doğrula; OnTokenValidated → kullanıcı aktif + security_stamp eşleşmeli (logout/rol değişiminde token ölür).
// SignalR hub'ları query string access_token ile bağlanır (browser WebSocket header kısıtı).
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            ClockSkew = TimeSpan.Zero
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var userManager = context.HttpContext.RequestServices
                    .GetRequiredService<UserManager<ApplicationUser>>();
                var user = await userManager.GetUserAsync(context.Principal!);
                var tokenStamp = context.Principal?.FindFirst("security_stamp")?.Value;

                if (user is null || !user.IsActive ||
                    !string.Equals(user.SecurityStamp, tokenStamp, StringComparison.Ordinal))
                {
                    context.Fail("Token artık geçerli değil.");
                }
            },
            OnChallenge = async context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(new ProblemDetails
                {
                    Status = StatusCodes.Status401Unauthorized,
                    Title = "Kimlik doğrulama gerekli."
                });
            },
            OnForbidden = async context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new ProblemDetails
                {
                    Status = StatusCodes.Status403Forbidden,
                    Title = "Bu işlem için yetkiniz bulunmuyor."
                });
            },
            OnMessageReceived = context =>
            {
                // NEDEN: SignalR WebSocket'te Authorization header zor; /hubs için access_token query kullanılır.
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) &&
                    path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

// --- JSON Naming Policy Ayarı (PascalCase / Birebir İsimlendirme) ---
builder.Services.AddControllers();
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var problemDetails = new ValidationProblemDetails(context.ModelState)
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "İstek doğrulaması başarısız."
        };
        return new BadRequestObjectResult(problemDetails);
    };
});
builder.Services.AddProblemDetails();
builder.Services.AddAuthorizationBuilder()
    // NEDEN: Varsayılan politika = giriş zorunlu; ince yetki permission claim'leriyle (JWT içinde).
    .SetFallbackPolicy(new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build())
    .AddPolicy(PolicyNames.ProductionWrite, policy => policy.RequireClaim("permission", AppPermissions.ProductionWrite))
    .AddPolicy(PolicyNames.ProductionManage, policy => policy.RequireClaim("permission", AppPermissions.ProductionManage))
    .AddPolicy(PolicyNames.ProductionHardDelete, policy => policy.RequireClaim("permission", AppPermissions.ProductionHardDelete))
    .AddPolicy(PolicyNames.MetricsRead, policy => policy.RequireClaim("permission", AppPermissions.MetricsRead))
    .AddPolicy(PolicyNames.AlarmWrite, policy => policy.RequireClaim("permission", AppPermissions.AlarmWrite))
    .AddPolicy(PolicyNames.AlarmManage, policy => policy.RequireClaim("permission", AppPermissions.AlarmManage))
    .AddPolicy(PolicyNames.WorkOrderManage, policy => policy.RequireClaim("permission", AppPermissions.WorkOrderManage))
    .AddPolicy(PolicyNames.DeletedRecordsRead, policy => policy.RequireClaim("permission", AppPermissions.DeletedRecordsRead))
    .AddPolicy(PolicyNames.UserManage, policy => policy.RequireClaim("permission", AppPermissions.UserManage))
    .AddPolicy(PolicyNames.SimulationControl, policy => policy.RequireClaim("permission", AppPermissions.SimulationControl));
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await context.HttpContext.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = StatusCodes.Status429TooManyRequests,
            Title = "Çok fazla giriş denemesi.",
            Detail = "Lütfen kısa bir süre sonra yeniden deneyin."
        }, cancellationToken);
    };
    options.AddPolicy("login", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IAuditLogService, AuditLogService>();
builder.Services.AddScoped<IDowntimeEventService, DowntimeEventService>();
builder.Services.AddScoped<IProductionProgressSync, ProductionProgressSync>();
builder.Services.AddScoped<IStationRuntimeService, StationRuntimeService>();
builder.Services.AddScoped<IFactorySimulationControl, FactorySimulationControlService>();
builder.Services.AddScoped<IShopFloorResetService, ShopFloorResetService>();
builder.Services.AddScoped<ITelemetryAnomalyService, TelemetryAnomalyService>();
builder.Services.AddScoped<IMetricIngestService, MetricIngestService>();
builder.Services.AddSingleton<IMesRealtimePublisher, MesRealtimePublisher>();
builder.Services.AddSignalR();

builder.Services.AddEndpointsApiExplorer();

if (builder.Configuration.GetValue<bool>($"{OeeSimulationOptions.SectionName}:Enabled"))
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
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Identity login endpointinden alınan JWT erişim belirtecini girin."
    });
});

var app = builder.Build();

// --- ÖNEMLİ:Exception Middleware ---
app.UseMiddleware<ExceptionMiddleware>();

if (!isTesting)
{
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<MesDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DatabaseInitialization");
        // NEDEN: Şema EF migrations ile uygulanır (EnsureCreated değil). Ardından admin bootstrap + runtime/sim seed.
        await db.Database.MigrateAsync();
        await IdentityBootstrapper.InitializeAsync(scope.ServiceProvider, builder.Configuration, logger);
        var runtimeService = scope.ServiceProvider.GetRequiredService<IStationRuntimeService>();
        await runtimeService.EnsureSeededAsync();
        var simulationControl = scope.ServiceProvider.GetRequiredService<IFactorySimulationControl>();
        await simulationControl.EnsureSeededAsync();
        var simStatus = await simulationControl.GetStatusAsync();
        logger.LogInformation(
            "Fabrika simülasyonu durumu (kalıcı): {Enabled} · güncelleyen={UpdatedBy} · {UpdatedAt:o}",
            simStatus.Enabled ? "AÇIK" : "KAPALI",
            simStatus.UpdatedBy ?? "—",
            simStatus.UpdatedAt);

        if (app.Environment.IsDevelopment())
        {
            try
            {
                if (!await db.Alarms.AnyAsync())
                {
                    // NEDEN: Açık Kritik/engelleyici alarm seed etme — SyncWithOpenAlarms istasyonu duraklatırdı.
                    // NASIL: Örnek çözülmüş + onaylanmış alarmlar (demo geçmişi).
                    db.Alarms.AddRange(
                        new Alarm
                        {
                            Title = "Hız Sensörü Arızası",
                            Station = StationCatalog.AssemblyLine1,
                            Severity = "Kritik",
                            Time = DateTimeOffset.UtcNow.AddMinutes(-22),
                            Status = AlarmStatuses.Resolved,
                            Description = "Üretim hızı beklenen değerlerin altında (örnek — çözülmüş)."
                        },
                        new Alarm
                        {
                            Title = "Yüksek Basınç",
                            Station = StationCatalog.TestAndQuality,
                            Severity = "Uyarı",
                            Time = DateTimeOffset.UtcNow.AddMinutes(-8),
                            Status = "Onaylandı",
                            Description = "Geçici basınç sapması tespit edildi."
                        }
                    );
                    await db.SaveChangesAsync();
                }

                if (!await db.WorkOrders.AnyAsync())
                {
                    var wo1 = new WorkOrder
                    {
                        OrderNo = "WO-2026-001",
                        Product = "Montaj Kiti A",
                        Station = StationCatalog.AssemblyLine1,
                        Quantity = 1000,
                        CompletedQuantity = 0,
                        Status = WorkOrderStatuses.InProgress
                    };
                    var wo2 = new WorkOrder
                    {
                        OrderNo = "WO-2026-002",
                        Product = "Elektronik Kart B",
                        Station = StationCatalog.ElectronicsBoardAssembly,
                        Quantity = 1000,
                        CompletedQuantity = 0,
                        Status = WorkOrderStatuses.InProgress
                    };
                    var wo3 = new WorkOrder
                    {
                        OrderNo = "WO-2026-003",
                        Product = "Paketleme Ünitesi C",
                        Station = StationCatalog.PackagingLine1,
                        Quantity = 800,
                        CompletedQuantity = 0,
                        Status = WorkOrderStatuses.Waiting
                    };
                    var wo4 = new WorkOrder
                    {
                        OrderNo = "WO-2026-004",
                        Product = "Final Kontrol Ürünü D",
                        Station = StationCatalog.FinalInspection,
                        Quantity = 500,
                        CompletedQuantity = 0,
                        Status = WorkOrderStatuses.Waiting
                    };
                    db.WorkOrders.AddRange(wo1, wo2, wo3, wo4);
                    await db.SaveChangesAsync();
                    logger.LogInformation("İş emri örnek verileri eklendi.");
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Alarm başlangıç verileri eklenemedi.");
            }
        }

        await runtimeService.SyncWithOpenAlarmsAsync();
    }
}

app.UseCors("AllowReactApp");
app.UseRateLimiter();

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
app.MapHub<MiniMesApi.Hubs.MesHub>(MiniMesApi.Hubs.MesHub.Route);
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false
}).AllowAnonymous();
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
}).AllowAnonymous();

app.Run();

public partial class Program;
