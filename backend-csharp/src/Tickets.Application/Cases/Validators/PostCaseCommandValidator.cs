using FluentValidation;
using Tickets.Application.Cases.Commands;
using Tickets.Domain.Cases;
using Tickets.Domain.FeedbackSessions;

namespace Tickets.Application.Cases.Validators;

/// <summary>
/// Surface-level shape checks for <see cref="PostCaseCommand"/>. Deeper rules
/// (canonical ZId format, max lengths) live in the domain value objects and
/// are enforced when the handler calls <c>StudentName.Parse</c> etc.
/// </summary>
public sealed class PostCaseCommandValidator : AbstractValidator<PostCaseCommand>
{
    public PostCaseCommandValidator()
    {
        RuleFor(c => c.StudentName)
            .NotEmpty().WithMessage("studentName is required.")
            .MaximumLength(StudentName.MaxLength);

        RuleFor(c => c.Category)
            .NotEmpty().WithMessage("category is required.")
            .MaximumLength(Category.MaxLength);

        RuleFor(c => c.ZId)
            .Must(z => string.IsNullOrWhiteSpace(z) || ZId.TryParse(z, out _))
            .WithMessage("zId must look like 'z' followed by 6-8 digits, or be omitted.");
    }
}
