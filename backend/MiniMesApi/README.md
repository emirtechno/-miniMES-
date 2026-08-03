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

`AlignPhaseOneSchema` migration'ı benzersiz indeksleri eklemeden önce yinelenen iş
emri, kullanıcı, ürün, istasyon ve aktif barkod kayıtlarını kontrol eder; uyumsuz
veri varsa veri silmek yerine açıklayıcı bir hatayla durur.

## Telemetri Güvenlik Ayarları

OEE simülasyonu yalnızca Development ortamında ve `OeeSimulation:Enabled=true`
olduğunda çalışır. Varsayılan olarak kapalıdır. Makine metrikleri varsayılan olarak
30 gün saklanır; süre, temizleme aralığı ve parti boyutu `MachineMetricRetention`
ayarlarıyla değiştirilebilir.
