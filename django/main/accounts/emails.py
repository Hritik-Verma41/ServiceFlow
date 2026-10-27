from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone


def send_company_invitation_email(invitation, raw_token):
    """Send an invitation email to a prospective company member."""
    acceptance_url = (
        f"{settings.FRONTEND_URL.rstrip('/')}"
        f"/accept-invitation?token={raw_token}"
    )

    company_name = invitation.company.name
    role = invitation.role.replace("_", " ").lower()
    expires_at = timezone.localtime(invitation.expires_at)

    subject = f"You're invited to join {company_name} on ServiceFlow"

    message = (
        f"You have been invited to join {company_name} on ServiceFlow "
        f"as a {role}.\n\n"
        "Accept your invitation using the link below:\n"
        f"{acceptance_url}\n\n"
        f"This invitation expires on "
        f"{expires_at:%d %B %Y at %H:%M %Z}.\n\n"
        "If you weren't expecting this invitation, you can ignore this email."
    )

    return send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[invitation.email],
        fail_silently=False,
    )
