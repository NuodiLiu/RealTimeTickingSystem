using FluentValidation;
using Tickets.Application.Pairing.Commands;
using Tickets.Domain.Devices;

namespace Tickets.Application.Pairing.Validators;

public sealed class CompletePairingCommandValidator : AbstractValidator<CompletePairingCommand>
{
    public CompletePairingCommandValidator()
    {
        RuleFor(c => c.PairingToken)
            .NotEmpty().WithMessage("pairingToken is required.");

        RuleFor(c => c.DeviceName)
            .NotEmpty().WithMessage("deviceName is required.")
            .MaximumLength(DeviceName.MaxLength);

        RuleFor(c => c.Mode)
            .NotEmpty().WithMessage("mode is required.");
    }
}
