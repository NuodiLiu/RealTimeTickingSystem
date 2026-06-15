using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tickets.Infrastructure.Persistence.Entities;

namespace Tickets.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps <see cref="PairingTokenEntry"/> to the <c>pairing_tokens</c> table.
/// </summary>
internal sealed class PairingTokenEntryConfiguration : IEntityTypeConfiguration<PairingTokenEntry>
{
    public void Configure(EntityTypeBuilder<PairingTokenEntry> builder)
    {
        builder.ToTable("pairing_tokens");

        builder.HasKey(t => t.Token);
        builder.Property(t => t.Token)
            .HasColumnName("token")
            .HasMaxLength(128)
            .IsRequired();

        builder.Property(t => t.ExpireAt)
            .HasColumnName("expire_at")
            .IsRequired();

        builder.Property(t => t.ConsumedAt)
            .HasColumnName("consumed_at");

        builder.Property(t => t.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        // The expiry-sweep / TTL cleanup path queries by expire_at.
        builder.HasIndex(t => t.ExpireAt);
    }
}
