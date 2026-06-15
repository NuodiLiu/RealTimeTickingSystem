using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tickets.Domain.Cases;
using Tickets.Infrastructure.Persistence.Converters;

namespace Tickets.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the <see cref="Case"/> aggregate root. The aggregate's static
/// factory <c>Case.Queue</c> bumps <c>Version</c> to 1 on creation, so the
/// concurrency token starts correctly without any extra default-value config.
/// </summary>
internal sealed class CaseConfiguration : IEntityTypeConfiguration<Case>
{
    public void Configure(EntityTypeBuilder<Case> builder)
    {
        builder.ToTable("cases");

        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id)
            .HasConversion<CaseIdConverter>()
            .HasColumnName("id");

        builder.Property(c => c.StudentName)
            .HasConversion<StudentNameConverter>()
            .HasColumnName("student_name")
            .HasMaxLength(StudentName.MaxLength)
            .IsRequired();

        builder.Property(c => c.Category)
            .HasConversion<CategoryConverter>()
            .HasColumnName("category")
            .HasMaxLength(Category.MaxLength)
            .IsRequired();

        // ZId is nullable; EF lifts the value converter over Nullable<T>.
        builder.Property(c => c.ZId)
            .HasConversion<ZIdConverter>()
            .HasColumnName("z_id")
            .HasMaxLength(16);

        builder.Property(c => c.CreatedByDeviceId)
            .HasConversion<DeviceIdConverter>()
            .HasColumnName("created_by_device_id");

        builder.Property(c => c.Status)
            .HasConversion<string>()
            .HasColumnName("status")
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(c => c.AssignedStaffId)
            .HasConversion<StaffIdConverter>()
            .HasColumnName("assigned_staff_id");

        builder.Property(c => c.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(c => c.StartedAt).HasColumnName("started_at");
        builder.Property(c => c.ResolvedAt).HasColumnName("resolved_at");

        builder.Property(c => c.EscalatedTo).HasColumnName("escalated_to").HasMaxLength(64);
        builder.Property(c => c.ResolvedOnSite).HasColumnName("resolved_on_site");
        builder.Property(c => c.EscalatedAt).HasColumnName("escalated_at");

        builder.Property(c => c.Version)
            .HasColumnName("version")
            .IsConcurrencyToken()
            .IsRequired();

        // Composite index covers FIFO queue lookup (status + createdAt) used by
        // FindOldestQueued and ListByStatusAsync.
        builder.HasIndex(c => new { c.Status, c.CreatedAt });

        builder.Ignore(c => c.DomainEvents);
    }
}
