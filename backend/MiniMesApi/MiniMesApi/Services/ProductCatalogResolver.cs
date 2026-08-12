using Microsoft.EntityFrameworkCore;
using MiniMesApi.Models;

namespace MiniMesApi.Services;

public static class ProductCatalogResolver
{
    /// <summary>
    /// Hafif arama: Products'ta ProductCode veya ProductName eşleşmesi (büyük/küçük harf duyarsız).
    /// Satır oluşturmaz — seed migration'a aittir.
    /// </summary>
    public static async Task<int?> ResolveProductIdAsync(
        MesDbContext context,
        string productLabel,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(productLabel)) return null;

        var label = productLabel.Trim();
        return await context.Products.AsNoTracking()
            .Where(product => product.ProductCode == label || product.ProductName == label)
            .Select(product => (int?)product.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }
}
