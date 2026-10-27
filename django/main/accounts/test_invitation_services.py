from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from main.accounts.models import CompanyMembership, Invitation, User
from main.accounts.services import (
    InvalidInvitationError,
    accept_invitation,
    create_invitation,
    hash_invitation_token,
)
from main.companies.models import Company


class InvitationServiceTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(
            name="Service Test Company",
            phone="9876543210",
            email="company@example.com",
        )
        self.inviter = User.objects.create_user(
            email="admin@example.com",
            password="TestPassword!2026",
        )

    def make_invitation(self, **overrides):
        fields = {
            "company": self.company,
            "email": "tech@example.com",
            "role": Invitation.Role.TECHNICIAN,
            "invited_by": self.inviter,
        }
        fields.update(overrides)
        return create_invitation(**fields)

    def test_is_returned_but_only_hash_is_stored(self):
        invitation, raw_token = self.make_invitation()

        self.assertTrue(raw_token)
        self.assertNotEqual(raw_token, invitation.token_hash)
        self.assertEqual(
            invitation.token_hash,
            hash_invitation_token(raw_token),
        )
        self.assertEqual(len(invitation.token_hash), 64)

    def test_invitation_has_expiry(self):
        invitation, _ = self.make_invitation()

        self.assertGreater(invitation.expires_at, timezone.now())
        self.assertLessEqual(
            invitation.expires_at,
            timezone.now() + timedelta(days=7, seconds=2),
        )

    def test_acceptance_creates_user_and_membership(self):
        invitation, token = self.make_invitation()

        user, membership = accept_invitation(
            token=token,
            password="StrongTestPassword!2026",
            first_name="Test",
            last_name="Technician",
        )

        self.assertEqual(user.email, invitation.email)
        self.assertTrue(user.check_password("StrongTestPassword!2026"))
        self.assertEqual(membership.company, self.company)
        self.assertEqual(membership.role, Invitation.Role.TECHNICIAN)
        self.assertEqual(membership.status, CompanyMembership.Status.ACTIVE)

        invitation.refresh_from_db()
        self.assertEqual(invitation.status, Invitation.Status.ACCEPTED)
        self.assertIsNotNone(invitation.accepted_at)

    def test_accepted_invitation_cannot_be_reused(self):
        _, token = self.make_invitation()

        accept_invitation(
            token=token,
            password="StrongTestPassword!2026",
        )

        with self.assertRaises(InvalidInvitationError):
            accept_invitation(
                token=token,
                password="AnotherPassword!2026",
            )

    def test_invalid_token_is_rejected(self):
        with self.assertRaises(InvalidInvitationError):
            accept_invitation(
                token="not-a-valid-token",
                password="StrongTestPassword!2026",
            )

    def test_expired_invitation_is_rejected_and_marked_expired(self):
        invitation, token = self.make_invitation(
            expires_at=timezone.now() - timedelta(minutes=1)
        )

        with self.assertRaises(InvalidInvitationError):
            accept_invitation(
                token=token,
                password="StrongTestPassword!2026",
            )

        invitation.refresh_from_db()
        self.assertEqual(invitation.status, Invitation.Status.EXPIRED)
        self.assertFalse(User.objects.filter(email=invitation.email).exists())

    def test_existing_user_can_join_another_company(self):
        user = User.objects.create_user(
            email="tech@example.com",
            password="ExistingPassword!2026",
        )
        invitation, token = self.make_invitation()

        accepted_user, membership = accept_invitation(
            token=token,
            password="IgnoredForExistingUser!2026",
        )

        self.assertEqual(accepted_user.pk, user.pk)
        self.assertEqual(membership.user, user)
        self.assertEqual(membership.company, invitation.company)
        self.assertEqual(User.objects.filter(email=user.email).count(), 1)

    def test_suspended_membership_cannot_be_reactivated_by_invitation(self):
        user = User.objects.create(
            email="tech@example.com",
            password="ExistingPassword!2026",
        )
        CompanyMembership.objects.create(
            user=user,
            company=self.company,
            role=CompanyMembership.Role.TECHNICIAN,
            status=CompanyMembership.Status.SUSPENDED,
        )
        _, token = self.make_invitation()

        with self.assertRaises(Exception):
            accept_invitation(
                token=token,
                password="IgnoredForExistingUser!2026",
            )

        membership = CompanyMembership.objects.get(
            user=user,
            company=self.company,
        )

        self.assertEqual(membership.status, CompanyMembership.Status.SUSPENDED)
