using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tickets.Domain.Devices;
using Tickets.Infrastructure.Persistence.Converters;

namespace Tickets.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps <see cref="KioskDevice"/> and its embedded <see cref="KioskLock"/>.
/// The lock is the device's internal entity (AGENTS.md §4.3); EF Core models
/// it via <c>OwnsOne</c>, materialising the columns into the same row.
/// When the device is Idle the <see cref="KioskDevice.CurrentLock"/>
/// reference is <c>null</c> and the corresponding columns are <c>NULL</c>.
/// </summary>
internal sealed class KioskDeviceConfiguration : IEntityTypeConfiguration<KioskDevice>
{
    public void Configure(EntityTypeBuilder<KioskDevice> builder)
    {
        builder.ToTable("kiosk_devices");

        builder.HasKey(d => d.Id);
        builder.Property(d => d.Id)
            .HasConversion<DeviceIdConverter>()
            .HasColumnName("id");

        builder.Property(d => d.Name)
            .HasConversion<DeviceNameConverter>()
            .HasColumnName("name")
            .HasMaxLength(DeviceName.MaxLength)
            .IsRequired();

        builder.Property(d => d.SecretHash)
            .HasConversion<SecretHashConverter>()
            .HasColumnName("secret_hash")
            .HasMaxLength(256)
            .IsRequired();

        builder.Property(d => d.Mode)
            .HasConversion<string>()
            .HasColumnName("mode")
            .HasMaxLength(16)
            .IsRequired();

        builder.Property(d => d.PairingStatus)
            .HasConversion<string>()
            .HasColumnName("pairing_status")
            .HasMaxLength(16)
            .IsRequired();

        builder.Property(d => d.LastSeenAt).HasColumnName("last_seen_at").IsRequired();
        builder.Property(d => d.IsConnected).HasColumnName("is_connected").IsRequired();

        builder.Property(d => d.Version)
            .HasColumnName("version")
            .IsConcurrencyToken()
            .IsRequired();

        builder.HasIndex(d => d.PairingStatus);
        builder.HasIndex(d => d.LastSeenAt);

        // KioskLock is the internal entity. OwnsOne flattens its properties
        // into the parent row; when the device is Idle, all current_lock_*
        // columns are NULL.
        builder.OwnsOne(d => d.CurrentLock, lk =>
        {
            lk.Property(l => l.Id)
                .HasConversion<KioskLockIdConverter>()
                .HasColumnName("current_lock_id");
            lk.Property(l => l.StaffId)
                .HasConversion<StaffIdConverter>()
                .HasColumnName("current_lock_staff_id");
            lk.Property(l => l.CaseId)
                .HasConversion<CaseIdConverter>()
                .HasColumnName("current_lock_case_id");
            lk.Property(l => l.CreatedAt).HasColumnName("current_lock_created_at");
            lk.Property(l => l.LeaseExpireAt).HasColumnName("current_lock_lease_expire_at");
            lk.Property(l => l.Version).HasColumnName("current_lock_version");

            // Allow these to be NULL when there is no active lock.
            lk.WithOwner();
        });

        builder.Navigation(d => d.CurrentLock).IsRequired(false);

        builder.Ignore(d => d.DomainEvents);
    }
}
