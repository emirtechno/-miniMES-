using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

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
                _logger.LogError(
                    ex,
                    "[MES AKIŞ HATASI] {Method} {Path} işlenirken hata oluştu. TraceId: {TraceId}",
                    httpContext.Request.Method,
                    httpContext.Request.Path,
                    httpContext.TraceIdentifier);

                await HandleExceptionAsync(httpContext);
            }
        }

        private static Task HandleExceptionAsync(HttpContext context)
        {
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

            var response = new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "Sunucu tarafında beklenmeyen bir hata oluştu.",
                Detail = "Hata ayrıntıları sunucu günlüklerine kaydedildi."
            };
            response.Extensions["traceId"] = context.TraceIdentifier;

            var jsonOptions = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };

            var jsonResponse = JsonSerializer.Serialize(response, jsonOptions);
            return context.Response.WriteAsync(jsonResponse);
        }
    }
}