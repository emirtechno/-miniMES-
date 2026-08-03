using System.Net;
using System.Net.Http.Json;

namespace MiniMesApi.Tests;

public sealed class AuthSmokeTests : IClassFixture<MiniMesApiFactory>
{
    private readonly HttpClient _client;

    public AuthSmokeTests(MiniMesApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Protected_endpoint_returns_401_without_token()
    {
        var response = await _client.GetAsync("/api/Uretim");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_validation_returns_problem_details_for_empty_body()
    {
        var response = await _client.PostAsJsonAsync("/api/Auth/login", new { username = "", password = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Liveness_health_endpoint_is_anonymous()
    {
        var response = await _client.GetAsync("/health/live");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
