using Microsoft.AspNetCore.Authentication;

namespace Tickets.WebApi.Identity;

public sealed class DeviceAuthSchemeOptions : AuthenticationSchemeOptions
{
    // Reserved for future tuning (header name override, etc.) — kept here
    // so production config can target an Options binding even if it's empty
    // today.
}
