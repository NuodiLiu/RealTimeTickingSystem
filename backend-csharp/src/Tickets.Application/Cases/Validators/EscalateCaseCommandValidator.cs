using FluentValidation;
using Tickets.Application.Cases.Commands;

namespace Tickets.Application.Cases.Validators;

public sealed class EscalateCaseCommandValidator : AbstractValidator<EscalateCaseCommand>
{
    public EscalateCaseCommandValidator()
    {
        RuleFor(c => c.CaseId)
            .NotEmpty().WithMessage("caseId is required.");

        RuleFor(c => c.Department)
            .NotEmpty().WithMessage("department is required.")
            .MaximumLength(64);
    }
}
