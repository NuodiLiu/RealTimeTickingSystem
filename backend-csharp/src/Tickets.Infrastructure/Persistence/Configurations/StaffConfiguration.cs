using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tickets.Domain.Staff;
using Tickets.Infrastructure.Persistence.Converters;

namespace Tickets.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the <see cref="Staff"/> aggregate root to its Postgres table.
/// EF picks up the private constructor by parameter-name binding, so
/// keeping the ctor parameter names aligned with the property names
/// (already the case) is what makes this work.
/// </summary>
internal sealed class StaffConfiguration : IEntityTypeConfiguration<Staff>
{
    public void Configure(EntityTypeBuilder<Staff> builder)
    {
        builder.ToTable("staff");

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id)
            .HasConversion<StaffIdConverter>()
            .HasColumnName("id");

        builder.Property(s => s.IdentityKey)
            .HasConversion<IdentityKeyConverter>()
            .HasColumnName("identity_key")
            .HasMaxLength(128)
            .IsRequired();
        builder.HasIndex(s => s.IdentityKey).IsUnique();

        builder.Property(s => s.Email)
            .HasConversion<EmailAddressConverter>()
            .HasColumnName("email")
            .HasMaxLength(254)
            .IsRequired();
        builder.HasIndex(s => s.Email).IsUnique();

        builder.Property(s => s.EmployeeNo)
            .HasConversion<EmployeeNoConverter>()
            .HasColumnName("employee_no")
            .HasMaxLength(128)
            .IsRequired();
        builder.HasIndex(s => s.EmployeeNo).IsUnique();

        builder.Property(s => s.Role)
            .HasConversion<string>()
            .HasColumnName("role")
            .HasMaxLength(16)
            .IsRequired();

        builder.Property(s => s.Name)
            .HasColumnName("name")
            .HasMaxLength(128);

        builder.Property(s => s.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        // AGENTS.md §9.2 — optimistic concurrency.
        builder.Property(s => s.Version)
            .HasColumnName("version")
            .IsConcurrencyToken()
            .IsRequired();

        // The pending domain-events list is in-memory only.
        builder.Ignore(s => s.DomainEvents);
    }
}
