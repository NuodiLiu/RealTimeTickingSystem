using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tickets.Domain.FeedbackSessions;
using Tickets.Infrastructure.Persistence.Converters;

namespace Tickets.Infrastructure.Persistence.Configurations;

internal sealed class FeedbackSessionConfiguration : IEntityTypeConfiguration<FeedbackSession>
{
    public void Configure(EntityTypeBuilder<FeedbackSession> builder)
    {
        builder.ToTable("feedback_sessions");

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id)
            .HasConversion<FeedbackSessionIdConverter>()
            .HasColumnName("id");

        builder.Property(s => s.CaseId)
            .HasConversion<CaseIdConverter>()
            .HasColumnName("case_id").IsRequired();

        builder.Property(s => s.StaffId)
            .HasConversion<StaffIdConverter>()
            .HasColumnName("staff_id").IsRequired();

        builder.Property(s => s.DeviceId)
            .HasConversion<DeviceIdConverter>()
            .HasColumnName("device_id").IsRequired();

        builder.Property(s => s.Status)
            .HasConversion<string>()
            .HasColumnName("status")
            .HasMaxLength(16).IsRequired();

        builder.Property(s => s.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(s => s.ExpireAt).HasColumnName("expire_at").IsRequired();
        builder.Property(s => s.DeliveredAt).HasColumnName("delivered_at");
        builder.Property(s => s.SubmittedAt).HasColumnName("submitted_at");
        builder.Property(s => s.CancelledAt).HasColumnName("cancelled_at");
        builder.Property(s => s.OverriddenAt).HasColumnName("overridden_at");
        builder.Property(s => s.ExpiredAt).HasColumnName("expired_at");

        // Rating + Comment are nullable VOs; EF lifts the converters over Nullable<T>.
        builder.Property(s => s.Rating)
            .HasConversion<FeedbackRatingConverter>()
            .HasColumnName("rating");

        builder.Property(s => s.Comment)
            .HasConversion<FeedbackCommentConverter>()
            .HasColumnName("comment")
            .HasMaxLength(FeedbackComment.MaxLength);

        builder.Property(s => s.Version)
            .HasColumnName("version")
            .IsConcurrencyToken()
            .IsRequired();

        // Two query paths the Application layer uses:
        //   - active session for a case (caseId + status in Created/Delivered)
        //   - active session for a device
        //   - expired sweep (status + expireAt)
        builder.HasIndex(s => new { s.CaseId, s.Status });
        builder.HasIndex(s => new { s.DeviceId, s.Status });
        builder.HasIndex(s => new { s.Status, s.ExpireAt });

        builder.Ignore(s => s.DomainEvents);
    }
}
