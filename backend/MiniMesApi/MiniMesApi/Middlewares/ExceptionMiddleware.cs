using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MiniMesApi.Middlewares
{
    public class ExceptionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ExceptionMiddleware> _logger;
        private readonly IHostEnvironment _environment;

        public ExceptionMiddleware(
            RequestDelegate next,
            ILogger<ExceptionMiddleware> logger,
            IHostEnvironment environment)
        {
            _next = next;
            _logger = logger;
            _environment = environment;
        }

        public async Task InvokeAsync(HttpContext httpContext)
        {
            try
            {
                await _next(httpContext);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "[MES AKIŞ HATASI] {Method} {Path} işlenirken hata oluştu. TraceId: {TraceId}",
                    httpContext.Request.Method,
                    httpContext.Request.Path,
                    httpContext.TraceIdentifier);

                await HandleExceptionAsync(httpContext, ex);
            }
        }

        private Task HandleExceptionAsync(HttpContext context, Exception exception)
        {
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

            var (title, detail) = ResolveClientMessage(exception);

            var response = new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = title,
                Detail = detail
            };
            response.Extensions["traceId"] = context.TraceIdentifier;

            var jsonOptions = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };

            var jsonResponse = JsonSerializer.Serialize(response, jsonOptions);
            return context.Response.WriteAsync(jsonResponse);
        }

        private (string Title, string Detail) ResolveClientMessage(Exception exception)
        {
            // Prefer explicit InvalidOperationException messages (e.g. shop-floor reset).
            if (exception is InvalidOperationException &&
                !string.IsNullOrWhiteSpace(exception.Message) &&
                exception.Message is not ("Operation is not valid due to the current state of the object."))
            {
                return ("İşlem tamamlanamadı.", exception.Message);
            }

            if (exception is DbUpdateConcurrencyException)
            {
                return (
                    "Eşzamanlılık çakışması.",
                    "Kayıt başka bir işlem tarafından değiştirildi. Sayfayı yenileyip tekrar deneyin.");
            }

            if (exception is DbUpdateException)
            {
                var dbDetail = _environment.IsDevelopment()
                    ? FirstUsefulMessage(exception)
                    : "Veritabanı güncellemesi başarısız oldu. İlişkili kayıtlar veya kısıtlar engelliyor olabilir.";
                return ("Veritabanı hatası.", dbDetail);
            }

            if (_environment.IsDevelopment())
            {
                return (
                    "Sunucu tarafında beklenmeyen bir hata oluştu.",
                    FirstUsefulMessage(exception));
            }

            return (
                "Sunucu tarafında beklenmeyen bir hata oluştu.",
                "Hata ayrıntıları sunucu günlüklerine kaydedildi.");
        }

        private static string FirstUsefulMessage(Exception exception)
        {
            var current = exception;
            while (current.InnerException is not null)
                current = current.InnerException;
            return string.IsNullOrWhiteSpace(current.Message)
                ? exception.Message
                : current.Message;
        }
    }
}
