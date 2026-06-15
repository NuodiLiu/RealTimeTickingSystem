using System.Text.Json;
using System.Text.Json.Serialization;
using Tickets.Domain.Cases;
using Tickets.Domain.Devices;

namespace Tickets.Application.Common.Json;

/// <summary>
/// Serializes <see cref="CaseStatus"/> as the legacy UPPER_SNAKE wire strings
/// (QUEUED / IN_PROGRESS / RESOLVED_PENDING_FEEDBACK / RESOLVED) instead of the
/// default PascalCase. See <see cref="WireEnum"/> for the source of the mapping.
/// </summary>
public sealed class CaseStatusJsonConverter : JsonConverter<CaseStatus>
{
    public override CaseStatus Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (WireEnum.TryParseCaseStatus(raw, out var value))
        {
            return value;
        }
        // Tolerate PascalCase / case-insensitive fallback so internal callers
        // (and old payloads) still round-trip.
        if (Enum.TryParse<CaseStatus>(raw, ignoreCase: true, out var parsed))
        {
            return parsed;
        }
        throw new JsonException($"Unknown CaseStatus wire value '{raw}'.");
    }

    public override void Write(Utf8JsonWriter writer, CaseStatus value, JsonSerializerOptions options)
    {
        ArgumentNullException.ThrowIfNull(writer);
        writer.WriteStringValue(WireEnum.ToWire(value));
    }
}

/// <summary>
/// Serializes <see cref="DeviceMode"/> as the legacy UPPER_SNAKE wire strings
/// (REGISTRATION / FEEDBACK) instead of the default PascalCase.
/// </summary>
public sealed class DeviceModeJsonConverter : JsonConverter<DeviceMode>
{
    public override DeviceMode Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (WireEnum.TryParseDeviceMode(raw, out var value))
        {
            return value;
        }
        if (Enum.TryParse<DeviceMode>(raw, ignoreCase: true, out var parsed))
        {
            return parsed;
        }
        throw new JsonException($"Unknown DeviceMode wire value '{raw}'.");
    }

    public override void Write(Utf8JsonWriter writer, DeviceMode value, JsonSerializerOptions options)
    {
        ArgumentNullException.ThrowIfNull(writer);
        writer.WriteStringValue(WireEnum.ToWire(value));
    }
}

/// <summary>
/// Serializes the derived <see cref="DeviceStatus"/> tile state as
/// OFFLINE / IDLE / BUSY.
/// </summary>
public sealed class DeviceStatusJsonConverter : JsonConverter<DeviceStatus>
{
    public override DeviceStatus Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        return raw switch
        {
            "OFFLINE" => DeviceStatus.Offline,
            "IDLE" => DeviceStatus.Idle,
            "BUSY" => DeviceStatus.Busy,
            _ => Enum.TryParse<DeviceStatus>(raw, ignoreCase: true, out var parsed)
                ? parsed
                : throw new JsonException($"Unknown DeviceStatus wire value '{raw}'."),
        };
    }

    public override void Write(Utf8JsonWriter writer, DeviceStatus value, JsonSerializerOptions options)
    {
        ArgumentNullException.ThrowIfNull(writer);
        writer.WriteStringValue(WireEnum.ToWire(value));
    }
}

/// <summary>
/// Registers every wire-enum converter on a <see cref="JsonSerializerOptions"/>.
/// Called from BOTH the HTTP JSON pipeline (Program.ConfigureHttpJsonOptions)
/// and the SignalR hub protocol serializer (the notification gateway) so every
/// enum that crosses the wire — over REST or over SignalR — is emitted with the
/// exact legacy strings the clients expect.
/// </summary>
public static class WireJson
{
    public static void AddWireEnumConverters(JsonSerializerOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        options.Converters.Add(new CaseStatusJsonConverter());
        options.Converters.Add(new DeviceModeJsonConverter());
        options.Converters.Add(new DeviceStatusJsonConverter());
    }
}
