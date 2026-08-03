using System.Text.Json.Serialization;

namespace MiniMesApi.DTOs
{
    // POST / PUT isteklerinde istemcinin göndereceği veri
    public class CreateUretimKayitDto
    {
        [JsonPropertyName("urun20liKod")]
        public string Urun20liKod { get; set; } = string.Empty;

        [JsonPropertyName("malzeme12liKod")]
        public string Malzeme12liKod { get; set; } = string.Empty;

        [JsonPropertyName("istasyonAdi")]
        public string IstasyonAdi { get; set; } = string.Empty;

        [JsonPropertyName("kaliteDurumu")]
        public string KaliteDurumu { get; set; } = "OK";
    }

    // GET isteklerinde istemciye döneceğimiz veri
    public class UretimKayitResponseDto
    {
        [JsonPropertyName("id")]
        public int ID { get; set; }

        [JsonPropertyName("urun20liKod")]
        public string Urun20liKod { get; set; } = string.Empty;

        [JsonPropertyName("malzeme12liKod")]
        public string Malzeme12liKod { get; set; } = string.Empty;

        [JsonPropertyName("istasyonAdi")]
        public string IstasyonAdi { get; set; } = string.Empty;

        [JsonPropertyName("kaliteDurumu")]
        public string KaliteDurumu { get; set; } = string.Empty;

        [JsonPropertyName("uretimTarihi")]
        public DateTimeOffset UretimTarihi { get; set; }

        [JsonPropertyName("deletedAtUtc")]
        public DateTimeOffset? DeletedAtUtc { get; set; }

        [JsonPropertyName("deletedByUsername")]
        public string? DeletedByUsername { get; set; }
    }
}