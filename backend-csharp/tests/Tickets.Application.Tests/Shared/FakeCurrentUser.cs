using Tickets.Application.Abstractions;
using Tickets.Domain.Staff;

namespace Tickets.Application.Tests.Shared;

internal sealed class FakeCurrentUser(StaffId? staffId = null, StaffRole? role = null) : ICurrentUser
{
    public StaffId? StaffId { get; } = staffId;
    public StaffRole? Role { get; } = role;

    public static FakeCurrentUser AnonymousUser() => new(null, null);
    public static FakeCurrentUser StaffMember(StaffId? id = null) =>
        new(id ?? Domain.Staff.StaffId.New(), StaffRole.Staff);
}
