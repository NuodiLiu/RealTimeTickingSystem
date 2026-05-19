namespace Tickets.Application.Pairing.Abstractions;

/// <summary>
/// Generates the opaque random token printed on the QR code. The Application
/// layer never inspects the format — implementations should produce something
/// unguessable, e.g. 32 bytes of CSPRNG encoded as hex (matching the legacy
/// Node behaviour at backend/src/services/pair.service.ts).
/// </summary>
public interface IPairingTokenGenerator
{
    string Generate();
}
