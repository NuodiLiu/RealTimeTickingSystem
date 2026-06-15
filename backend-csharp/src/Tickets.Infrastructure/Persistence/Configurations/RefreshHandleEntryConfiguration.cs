using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tickets.Infrastructure.Persistence.Converters;
using Tickets.Infrastructure.Persistence.Entities;

namespace Tickets.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps <see cref="RefreshHandleEntry"/> to the <c>refresh_handles</c> table.
/// </summary>
internal sealed class RefreshHandleEntryConfiguration : IEntityTypeConfiguration<RefreshHandleEntry>
{
    public void Configure(EntityTypeBuilder<RefreshHandleEntry> builder)
    {
        builder.ToTable("refresh_handles");

        builder.HasKey(h => h.Handle);
        builder.Property(h => h.Handle)
            .HasColumnName("handle")
            .HasMaxLength(128)
            .IsRequired();

        builder.Property(h => h.StaffId)
            .HasConversion<StaffIdConverter>()
            .HasColumnName("staff_id")
            .IsRequired();

        builder.Property(h => h.ExpireAt)
            .HasColumnName("expire_at")
            .IsRequired();

        builder.Property(h => h.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        // Revoke-all-for-staff and TTL-sweep query paths.
        builder.HasIndex(h => h.StaffId);
        builder.HasIndex(h => h.ExpireAt);
    }
}
