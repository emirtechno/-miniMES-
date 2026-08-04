# Vestel MES API (MiniMesApi)

Bu proje, Vestel MES (Manufacturing Execution System) Staj Projesi kapsamında geliştirilmiş olan Backend (Web API) servisidir. 

Üretim verilerinin yönetimi, veritabanı (SQL Server) entegrasyonu ve ön yüz (React) uygulamasının ihtiyaç duyduğu RESTful API servislerini sağlar.

## 🚀 Kullanılan Teknolojiler

 C# / .NET
 ASP.NET Core Web API
 Entity Framework Core
 Microsoft SQL Server
 Swagger / OpenAPI (API dokümantasyonu ve test için)

## 📌 Özellikler ve Endpoint'ler

 Üretim Takibi: Üretim kayıtlarını listeleme, ekleme ve güncelleme (`/api/Uretim`)
 Fabrika Simülasyonu: Açık iş emri + parti seed ve çok hatlı Live Stream hazırlığı (`POST /api/Simulation/factory/start`)
 CORS Desteği: React arayüzü ile güvenli haberleşme konfigürasyonu
 Swagger UI: Tüm API servislerini interaktif olarak test etme imkanı

## Veritabanı Geçişleri

EF Core migration'ları veritabanı şemasının tek kaynağıdır. Uygulama başlangıcında
bekleyen migration'lar uygulanır. Linux veya uzak SQL Server ortamlarında bağlantı
dizesini ortam değişkeniyle sağlayın:

```bash
export ConnectionStrings__DefaultConnection='Server=sql-host;Database=MiniMESDB;User Id=...;Password=...;Encrypt=True'
dotnet ef database update --project MiniMesApi/MiniMesApi.csproj
```

`EnsureCreated` ile oluşturulmuş ve `__EFMigrationsHistory` tablosu bulunmayan eski
geliştirme veritabanları doğrudan yükseltilemez. Veriyi yedekleyip geliştirme
veritabanını migration'larla yeniden oluşturun. Paylaşılan bir veritabanında geçmişi
elle işaretlemeden önce şemayı ve veriyi yedekleyip DBA incelemesi yapın.

### Migration squash (20260804060820_InitialCreate)

Geçmiş incremental migration'lar tek bir `InitialCreate` ile birleştirildi. Bu, **yalnızca
boş/yeni veritabanları** veya squash'tan sonra sıfırlanan geliştirme DB'leri için güvenlidir.

Eski migration adları (`20260729…`, `20260803…` vb.) `__EFMigrationsHistory` içinde
kayıtlı bir DB'ye bu squash uygulandığında EF, `InitialCreate`'i yeniden çalıştırmaya
çalışır ve tablo çakışmalarıyla kırılır. Yerel/dev için güvenli yol:

1. Gerekirse veriyi yedekleyin.
2. `MiniMESDB` veritabanını silin veya yeniden oluşturun.
3. Uygulamayı başlatın (`MigrateAsync`) veya `dotnet ef database update` çalıştırın.

Paylaşılan/staging/production DB'de squash **yapmayın**; orada eski geçmiş korunmalı
veya DBA tarafından bilinçli bir baseline/history rewrite planlanmalıdır.

## Identity ve JWT Yapılandırması

Kimlik doğrulama ASP.NET Core Identity kullanır. JWT imzalama anahtarı ve ilk yönetici
parolası kaynak kodda tutulmaz (`appsettings.json` içinde `Jwt:Key` yoktur).

Yerel geliştirme (Windows) için User Secrets önerilir:

```bash
cd backend/MiniMesApi
dotnet user-secrets set "Jwt:Key" "en-az-32-karakterlik-rastgele-bir-imzalama-anahtari" --project MiniMesApi/MiniMesApi.csproj
```

Alternatif olarak ortam değişkenleri:

```bash
export Jwt__Key='en-az-32-karakterlik-rastgele-bir-imzalama-anahtari'
export IdentityBootstrap__AdminUsername='admin'
export IdentityBootstrap__AdminPassword='guclu-ve-benzersiz-bir-parola'
export IdentityBootstrap__AdminDisplayName='MES Yöneticisi'
```

Bootstrap hesabı yalnızca bulunmadığında oluşturulur; mevcut hesabın parolası ortam
değişkeniyle sıfırlanmaz. İlk yönetici oluşturulduktan sonra bootstrap parola
değişkenini dağıtım ortamından kaldırın. Parolalar Identity tarafından hash'lenir;
başarısız girişler hesap kilitleme ve endpoint hız sınırlamasına tabidir.

## Production Dağıtım Notları

Üretim ortamında aşağıdaki ayarları ortam değişkenleri veya gizli depo ile sağlayın:

```bash
export ASPNETCORE_ENVIRONMENT=Production
export ConnectionStrings__DefaultConnection='Server=sql-host;Database=MiniMESDB;User Id=...;Password=...;Encrypt=True;TrustServerCertificate=False'
export Jwt__Key='en-az-32-karakterlik-rastgele-bir-imzalama-anahtari'
export Cors__AllowedOrigins__0='https://mes.example.com'
export AllowedHosts='mes-api.example.com'
export IdentityBootstrap__AdminUsername='admin'
export IdentityBootstrap__AdminPassword='guclu-ve-benzersiz-bir-parola'
```

Örnek üretim şablonu: `appsettings.Production.json.example`.

Sağlık uçları (anonim):
- `GET /health/live` — süreç ayakta mı
- `GET /health/ready` — veritabanı hazır mı

Canlı olaylar SignalR üzerinden yayınlanır:
- Hub: `/hubs/mes` (JWT `access_token` query parametresi ile)
- Olaylar: `alarmCreated`, `alarmUpdated`, `alarmDeleted`, `oeeUpdated`

SQL Server bağlantısı yeniden deneme politikası (`EnableRetryOnFailure`) açıktır.
`TrustServerCertificate=True` yalnızca güvenilir yerel geliştirme için kullanılmalıdır;
üretimde TLS doğrulaması açık (`Encrypt=True`, `TrustServerCertificate=False`) tutulmalıdır.

## Zaman Damgaları (UTC)

Kalıcı zaman alanları `DateTimeOffset` olarak saklanır ve API yazma yolları
`DateTimeOffset.UtcNow` kullanır (`UretimTarihi`, alarm `Time`, metrik `RecordedAt`,
ürün `CreatedAt`, izlenebilirlik giriş/çıkış, parti `UpdatedAt`, JWT `ExpiresAtUtc`).
İstemci tarafında gösterim için `toLocaleString` / UTC etiketi kullanın.

