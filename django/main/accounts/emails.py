import requests

from django.conf import settings
from django.utils import timezone


BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


def send_company_invitation_email(invitation, raw_token):
    """Send a company invitation using Brevo's transactional email API."""

    if not settings.BREVO_API_KEY:
        raise RuntimeError("BREVO_API_KEY is not configured.")

    if not settings.BREVO_SENDER_EMAIL:
        raise RuntimeError("BREVO_SENDER_EMAIL is not configured.")

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

    payload = {
        "sender": {
            "name": settings.BREVO_SENDER_NAME,
            "email": settings.BREVO_SENDER_EMAIL,
        },
        "to": [
            {
                "email": invitation.email,
            }
        ],
        "subject": subject,
        "textContent": message,
    }

    headers = {
        "accept": "application/json",
        "api-key": settings.BREVO_API_KEY,
        "content-type": "application/json",
    }

    response = requests.post(
        BREVO_API_URL,
        json=payload,
        headers=headers,
        timeout=20,
    )

    if not response.ok:
        raise RuntimeError(
            f"Brevo email delivery failed "
            f"(HTTP {response.status_code}): {response.text}"
        )

    return response.json()
