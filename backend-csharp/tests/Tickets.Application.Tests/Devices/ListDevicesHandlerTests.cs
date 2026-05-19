using Tickets.Application.Devices.Handlers;
using Tickets.Application.Devices.Queries;
using Tickets.Application.Tests.Shared;
using Tickets.Domain.Devices;
using Tickets.Domain.Staff;

namespace Tickets.Application.Tests.Devices;

public sealed class ListDevicesHandlerTests
{
    private readonly IKioskDeviceRepository _repo = Substitute.For<IKioskDeviceRepository>();
    private readonly FakeClock _clock = new();

    private ListDevicesHandler Handler(StaffId? staff = null) => new(
        _repo,
        staff is null ? FakeCurrentUser.AnonymousUser() : FakeCurrentUser.StaffMember(staff));

    private KioskDevice ADevice(string name, DeviceMode mode = DeviceMode.Registration) =>
        KioskDevice.Pair(DeviceName.Parse(name), SecretHash.FromRaw("hash"), mode, _clock);

    [Fact]
    public async Task HandleAsync_Anonymous_Unauthorized()
    {
        var result = await Handler(staff: null)
            .HandleAsync(new ListDevicesQuery(), CancellationToken.None);
        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(401);
    }

    [Theory]
    [InlineData(0, 50)]
    [InlineData(1, 0)]
    [InlineData(1, 201)]
    public async Task HandleAsync_InvalidPagination_ReturnsValidationError(int page, int size)
    {
        var result = await Handler(StaffId.New())
            .HandleAsync(new ListDevicesQuery(Page: page, PageSize: size), CancellationToken.None);
        result.IsSuccess.Should().BeFalse();
        result.Error!.HttpStatus.Should().Be(400);
    }

    [Fact]
    public async Task HandleAsync_ReturnsDtos()
    {
        var a = ADevice("Kiosk-A");
        var b = ADevice("Kiosk-B");
        _repo.ListPairedAsync(null, 0, 50, Arg.Any<CancellationToken>())
            .Returns(new[] { a, b });

        var result = await Handler(StaffId.New())
            .HandleAsync(new ListDevicesQuery(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(2);
    }

    [Fact]
    public async Task HandleAsync_ModeFilterPropagatesToRepository()
    {
        _repo.ListPairedAsync(DeviceMode.Feedback, 0, 50, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<KioskDevice>());

        await Handler(StaffId.New())
            .HandleAsync(new ListDevicesQuery(Mode: DeviceMode.Feedback), CancellationToken.None);

        await _repo.Received(1).ListPairedAsync(
            DeviceMode.Feedback, 0, 50, Arg.Any<CancellationToken>());
    }
}
