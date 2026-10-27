import hashlib
import secrets
from datetime import timedelta
from django.db import transaction
from django.utils import timezone

from .models import CompanyMembership, Invitation, User

INVITATION_EXPIRY_DAYS = 7

class InvitationError(Exception):
    """Base exception for invitation-related errors."""

class InvalidInvitationError(InvitationError):
    """The invitation does not exist or cannot be used."""

class InvitationAcceptanceError(InvitationError):
    """The invitation cannot be accepted for this user."""

def hash_invitation_token(token):
    """Return the SHA-256 hex digest of a raw invitation token."""
    return hashlib.sha256(token.encode('utf-8')).hexdigest()

def create_invitation(
    *,
    company,
    email,
    role,
    invited_by,
    expires_at=None,
):
    """
    Create an invitation and return (invitation, raw_token).

    Only the token hash is persisted. Authorization checks for the
    inviting user will be enforced by the API layer.
    """
    if role not in Invitation.Role.values:
        raise ValueError("Invalid invitation role.")

    email = User.objects.normalize_email(email.strip())

    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_invitation_token(raw_token)

    invitation = Invitation.objects.create(
        company=company,
        email=email,
        role=role,
        token_hash=token_hash,
        invited_by=invited_by,
        expires_at=expires_at or (
            timezone.now() + timedelta(days=INVITATION_EXPIRY_DAYS)
        ),
    )

    return invitation, raw_token

def get_valid_invitation(token):
    """
    Find a usable invitation using the raw token.

    Expired invitations are marked EXPIRED. Revoked and accepted
    invitations are rejected without changing their status.
    """
    if not token:
        raise InvalidInvitationError("Invalid or unavailable invitation.")

    token_hash = hash_invitation_token(token)

    with transaction.atomic():
        try:
            invitation = (
                Invitation.objects.select_for_update()
                .get(token_hash=token_hash)
            )
        except Invitation.DoesNotExist:
            raise InvalidInvitationError(
                "Invalid or unavailable invitation."
            ) from None

        if invitation.status != Invitation.Status.PENDING:
            raise InvalidInvitationError(
                "Invalid or unavailable invitation."
            )

        if invitation.expires_at <= timezone.now():
            invitation.status = Invitation.Status.EXPIRED
            invitation.save(update_fields=["status", "updated_at"])
            raise InvalidInvitationError(
                "Invalid or unavailable invitation."
            )

        return invitation

def accept_invitation(*, token, password, first_name="", last_name=""):
    """
    Accept a pending invitation atomically.

    Only the token hash is stored. Existing users are reused, and
    membership changes and invitation acceptance commit together.
    """
    if not token:
        raise InvalidInvitationError("Invalid or unavailable invitation.")

    token_hash = hash_invitation_token(token)
    expired = False

    with transaction.atomic():
        try:
            invitation = (
                Invitation.objects.select_for_update()
                .select_related("company")
                .get(token_hash=token_hash)
            )
        except Invitation.DoesNotExist:
            raise InvalidInvitationError(
                "Invalid or unavailable invitation."
            ) from None

        if invitation.status != Invitation.Status.PENDING:
            raise InvalidInvitationError(
                "Invalid or unavailable invitation."
            )

        if invitation.expires_at <= timezone.now():
            invitation.status = Invitation.Status.EXPIRED
            invitation.save(update_fields=["status", "updated_at"])
            expired = True
        else:
            email = User.objects.normalize_email(invitation.email)
            user = User.objects.filter(email__iexact=email).first()

            if user is None:
                if not password:
                    raise InvitationAcceptanceError(
                        "A password is required to create an account."
                    )

                user = User.objects.create_user(
                    email=email,
                    password=password,
                    first_name=first_name,
                    last_name=last_name,
                    role=invitation.role,
                    company=invitation.company,
                )
            elif not user.is_active:
                raise InvitationAcceptanceError(
                    "This account is inactive. Contact an administrator."
                )

            membership = (
                CompanyMembership.objects.select_for_update()
                .filter(user=user, company=invitation.company)
                .first()
            )

            if membership is None:
                membership = CompanyMembership.objects.create(
                    user=user,
                    company=invitation.company,
                    role=invitation.role,
                    status=CompanyMembership.Status.ACTIVE,
                )
            elif membership.status == CompanyMembership.Status.INVITED:
                membership.role = invitation.role
                membership.status = CompanyMembership.Status.ACTIVE
                membership.save(
                    update_fields=["role", "status", "updated_at"]
                )
            elif membership.status == CompanyMembership.Status.SUSPENDED:
                raise InvitationAcceptanceError(
                    "Membership for this company is suspended."
                )
            else:
                raise InvitationAcceptanceError(
                    "This user already has an active membership in this company."
                )

            invitation.status = Invitation.Status.ACCEPTED
            invitation.accepted_at = timezone.now()
            invitation.save(
                update_fields=["status", "accepted_at", "updated_at"]
            )

    # Raise after leaving atomic so the EXPIRED status remains committed.
    if expired:
        raise InvalidInvitationError("Invalid or unavailable invitation.")

    return user, membership
