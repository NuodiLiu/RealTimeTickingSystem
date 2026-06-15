using FluentValidation;
using Tickets.Application.Feedback.Commands;
using Tickets.Domain.FeedbackSessions;

namespace Tickets.Application.Feedback.Validators;

public sealed class SubmitFeedbackCommandValidator : AbstractValidator<SubmitFeedbackCommand>
{
    public SubmitFeedbackCommandValidator()
    {
        RuleFor(c => c.SessionId)
            .NotEmpty().WithMessage("sessionId is required.");

        RuleFor(c => c.Rating)
            .InclusiveBetween(FeedbackRating.MinValue, FeedbackRating.MaxValue)
            .WithMessage($"rating must be in [{FeedbackRating.MinValue}, {FeedbackRating.MaxValue}].");

        // Comment optional; if present, length cap is enforced by FeedbackComment.Parse.
        RuleFor(c => c.Comment)
            .MaximumLength(FeedbackComment.MaxLength)
            .When(c => !string.IsNullOrWhiteSpace(c.Comment));
    }
}
