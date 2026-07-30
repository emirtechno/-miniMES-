using System.Net;
using System.Text.Json;
using MiniMesApi.DTOs;

namespace MiniMesApi.Middlewares
{
    public class ExceptionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ExceptionMiddleware> _logger;

        public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext httpContext)
        {
            try
            {
                await _next(httpContext);
            }
            catch (Exception ex)
            {
                // Hatayı konsola/log dosyasına detaylıca basıyoruz
                _logger.LogError(ex, $"[MES AKIŞ HATASI]: {ex.Message}");
                
                await HandleExceptionAsync(httpContext, ex);
            }
        }

        private static Task HandleExceptionAsync(HttpContext context, Exception exception)
        {
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

            // Senin mevcut ApiResponse.FailResult metodunu kullanıyoruz
            var response = ApiResponse<string>.FailResult(
                message: "Sunucu tarafında beklenmeyen bir hata oluştu.",
                errors: new List<string> { exception.Message }
            );

            var jsonOptions = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };

            var jsonResponse = JsonSerializer.Serialize(response, jsonOptions);
            return context.Response.WriteAsync(jsonResponse);
        }
    }
}