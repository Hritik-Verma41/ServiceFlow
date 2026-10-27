from datetime import timedelta

from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from main.accounts.models import Invitation, User
from main.companies.models import Company

class InvitationModelTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(
            name="ServiceFlow Test Company",
            phone="9876543210",
            email="company@example.com",
        )
        self.inviter = User.objects.create_user(
            email="admin@example.com",
            password="TestPassword!2026",
        )

    def create_invitation(self, **overrides):
        fields = {
            "company": self.company,
            "email": "technician@example.com",
            "role": Invitation.Role.TECHNICIAN,
            "token_hash": "a" * 64,
            "invited_by": self.inviter,
            "expires_at": timezone.now() + timedelta(days=7),
        }
        fields.update(overrides)
        return Invitation.objects.create(**fields)

    def test_invitation_defaults_to_pending(self):
        invitation = self.create_invitation()

        self.assertEqual(invitation.status, Invitation.Status.PENDING)
        self.assertIsNone(invitation.accepted_at)

    def test_token_hash_must_be_unique(self):
        self.create_invitation()

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                self.create_invitation(email="another@example.com")

    def test_same_email_can_be_invited_by_different_companies(self):
        second_company = Company.objects.create(
            name="Second Test Company",
            phone="9876543211",
            email="second@example.com",
        )

        first = self.create_invitation()
        second = self.create_invitation(
            company=second_company,
            token_hash="b" * 64,
        )

        self.assertEqual(first.email, second.email)
        self.assertNotEqual(first.company, second.company)

    def test_invitation_status_can_be_updated(self):
        invitation = self.create_invitation(
            status=Invitation.Status.REVOKED,
        )
        invitation.refresh_from_db()

        self.assertEqual(invitation.status, Invitation.Status.REVOKED)

    def test_invitation_can_be_expired(self):
        inviation = self.create_invitation(
            expires_at=timezone.now() - timedelta(minutes=1),
        )

        self.assertLess(inviation.expires_at, timezone.now())
        self.assertEqual(inviation.status, Invitation.Status.PENDING)
