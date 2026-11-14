from datetime import timedelta
from unittest.mock import patch

from django.core import mail
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from main.accounts.models import CompanyMembership, Invitation, User
from main.accounts.services import (
    create_invitation,
    get_valid_invitation,
    hash_invitation_token,
    InvalidInvitationError,
)
from main.companies.models import Company


class CompanyInvitationAPITests(APITestCase):
    def setUp(self):
        self.company = Company.objects.create(
            name="ServiceFlow Test Company",
            phone="9876543210",
            email="company@example.com",
        )
        self.other_company = Company.objects.create(
            name="Other Test Company",
            phone="9876543211",
            email="other@example.com",
        )

        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="TestPassword123!",
        )
        self.manager = User.objects.create_user(
            email="manager@example.com",
            password="TestPassword123!",
        )
        self.technician = User.objects.create_user(
            email="technician@example.com",
            password="TestPassword123!",
        )
        self.other_admin = User.objects.create_user(
            email="other-admin@example.com",
            password="TestPassword123!",
        )

        self.add_membership(
            self.admin, self.company,
            CompanyMembership.Role.COMPANY_ADMIN,
        )
        self.add_membership(
            self.manager, self.company,
            CompanyMembership.Role.MANAGER,
        )
        self.add_membership(
            self.technician, self.company,
            CompanyMembership.Role.TECHNICIAN,
        )
        self.add_membership(
            self.other_admin, self.other_company,
            CompanyMembership.Role.COMPANY_ADMIN,
        )

        self.url = reverse(
            "company-invitation-create",
            kwargs={"company_id": self.company.id},
        )

    def add_membership(self, user, company, role):
        return CompanyMembership.objects.create(
            user=user,
            company=company,
            role=role,
            status=CompanyMembership.Status.ACTIVE,
        )

    def invite(self, user, email="new-tech@example.com",
               role=Invitation.Role.TECHNICIAN):
        self.client.force_authenticate(user=user)
        return self.client.post(
            self.url,
            {"email": email, "role": role},
            format="json",
        )

    @override_settings(
        FRONTEND_URL="http://localhost:3000",
    )
    @patch("main.accounts.views.send_company_invitation_email")
    def test_admin_can_create_invitation(self, mock_send_email):
        response = self.invite(self.admin)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["email"], "new-tech@example.com")
        self.assertEqual(response.data["status"], Invitation.Status.PENDING)
        self.assertNotIn("token", response.data)

        invitation = Invitation.objects.get(
            email="new-tech@example.com",
            company=self.company,
        )
        
        mock_send_email.assert_called_once()

        invitation_arg, raw_token = mock_send_email.call_args.args

        self.assertEqual(invitation_arg.id, invitation.id)
        self.assertTrue(raw_token)
        self.assertEqual(
            invitation.token_hash,
            hash_invitation_token(raw_token),
        )
        self.assertNotEqual(invitation.token_hash, raw_token)

        self.assertEqual(
            invitation.token_hash,
            hash_invitation_token(raw_token),
        )
        self.assertNotEqual(invitation.token_hash, raw_token)

    def test_manager_can_invite_technician(self):
        response = self.invite(self.manager)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_manager_cannot_invite_company_admin(self):
        response = self.invite(
            self.manager,
            email="new-admin@example.com",
            role=Invitation.Role.COMPANY_ADMIN,
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(
            Invitation.objects.filter(
                company=self.company,
                email="new-admin@example.com",
            ).exists()
        )

    def test_technician_cannot_create_invitation(self):
        response = self.invite(self.technician)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_from_another_company_cannot_invite(self):
        response = self.invite(self.other_admin)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_user_cannot_invite(self):
        response = self.client.post(
            self.url,
            {
                "email": "new-tech@example.com",
                "role": Invitation.Role.TECHNICIAN,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_invalid_email_is_rejected(self):
        response = self.invite(self.admin, email="not-an-email")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            Invitation.objects.filter(company=self.company).exists()
        )

    def test_invalid_role_is_rejected(self):
        response = self.invite(self.admin, role="SUPER_ADMIN")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_pending_invitation_is_rejected(self):
        first_response = self.invite(self.admin)

        self.assertEqual(
            first_response.status_code, status.HTTP_201_CREATED
        )

        second_response = self.invite(self.admin)

        self.assertEqual(
            second_response.status_code, status.HTTP_409_CONFLICT
        )
        self.assertEqual(
            Invitation.objects.filter(
                company=self.company,
                email="new-tech@example.com",
                status=Invitation.Status.PENDING,
            ).count(),
            1,
        )

    def test_duplicate_pending_invitation_is_case_insensitive(self):
        first_response = self.invite(
            self.admin,
            email="New-Tech@example.com",
        )
        self.assertEqual(
            first_response.status_code,
            status.HTTP_201_CREATED,
        )

        second_response = self.invite(
            self.admin,
            email="new-tech@EXAMPLE.com",
        )
        self.assertEqual(
            second_response.status_code,
            status.HTTP_409_CONFLICT,
        )

    def test_new_user_can_accept_invitation(self):
        invitation, token = create_invitation(
            company=self.company,
            email="new-tech@example.com",
            role=Invitation.Role.TECHNICIAN,
            invited_by=self.admin,
        )

        response = self.client.post(
            reverse("invitation-accept"),
            {
                "token": token,
                "password": "StrongPassword!2026",
                "first_name": "New",
                "last_name": "Technician",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            User.objects.filter(email="new-tech@example.com").exists()
        )
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, Invitation.Status.ACCEPTED)

    def test_existing_user_must_authenticate(self):
        _, token = create_invitation(
            company=self.company,
            email=self.technician.email,
            role=Invitation.Role.TECHNICIAN,
            invited_by=self.admin,
        )

        response = self.client.post(
            reverse("invitation-accept"),
            {"token": token},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_different_authenticated_user_cannot_accept_invitation(self):
        _, token = create_invitation(
            company=self.company,
            email=self.technician.email,
            role=Invitation.Role.TECHNICIAN,
            invited_by=self.admin,
        )
        self.client.force_authenticate(user=self.manager)

        response = self.client.post(
            reverse("invitation-accept"),
            {"token": token},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_authenticated_matching_user_can_accept_invitation(self):
        invitation, token = create_invitation(
            company=self.other_company,
            email=self.technician.email,
            role=Invitation.Role.TECHNICIAN,
            invited_by=self.other_admin,
        )
        self.client.force_authenticate(user=self.technician)

        response = self.client.post(
            reverse("invitation-accept"),
            {"token": token},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        invitation.refresh_from_db()
        self.assertEqual(invitation.status, Invitation.Status.ACCEPTED)

        membership = CompanyMembership.objects.get(
            user=self.technician,
            company=self.other_company,
        )
        self.assertEqual(membership.status, CompanyMembership.Status.ACTIVE)

    def test_invalid_invitation_token_is_rejected(self):
        response = self.client.post(
            reverse("invitation-accept"),
            {"token": "invalid-token"},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_expired_invitation_is_rejected_and_marked_expired(self):
        invitation, token = create_invitation(
            company=self.company,
            email="expired-tech@example.com",
            role=Invitation.Role.TECHNICIAN,
            invited_by=self.admin,
            expires_at=timezone.now() - timedelta(minutes=1),
        )

        response = self.client.post(
            reverse("invitation-accept"),
            {
                "token": token,
                "password": "StrongPassword!2026",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        invitation.refresh_from_db()
        self.assertEqual(invitation.status, Invitation.Status.EXPIRED)
        self.assertFalse(
            User.objects.filter(email="expired-tech@example.com").exists()
        )

    @patch(
        "main.accounts.views.send_company_invitation_email",
        side_effect=OSError("SMTP unavailable"),
    )
    def test_email_failure_rolls_back_invitation(self, mock_send_email):
        response = self.invite(self.admin)

        self.assertEqual(
            response.status_code,
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )
        self.assertIn("could not be sent", response.data["detail"])

        self.assertFalse(
            Invitation.objects.filter(
                company=self.company,
                email="new-tech@example.com",
                status=Invitation.Status.PENDING,
            ).exists()
        )

        mock_send_email.assert_called_once()

    def test_admin_can_list_pending_invitations(self):
        first, _ = create_invitation(
            company=self.company,
            email="first@example.com",
            role=Invitation.Role.TECHNICIAN,
            invited_by=self.admin,
        )

        second, _ = create_invitation(
            company=self.company,
            email="second@example.com",
            role=Invitation.Role.MANAGER,
            invited_by=self.admin,
        )

        response = self.client.get(
            reverse(
                "company-invitation-list",
                kwargs={"company_id": self.company.id},
            )
        )

        self.client.force_authenticate(user=self.admin)

        response = self.client.get(
            reverse(
                "company-invitation-list",
                kwargs={"company_id": self.company.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

        returned_ids = {item["id"] for item in response.data}
        self.assertEqual(
            returned_ids,
            {str(first.id), str(second.id)},
        )


    def test_invitation_list_excludes_non_pending_invitations(self):
        invitation, _ = create_invitation(
            company=self.company,
            email="accepted@example.com",
            role=Invitation.Role.TECHNICIAN,
            invited_by=self.admin,
        )

        invitation.status = Invitation.Status.ACCEPTED
        invitation.save(update_fields=["status", "updated_at"])

        self.client.force_authenticate(user=self.admin)

        response = self.client.get(
            reverse(
                "company-invitation-list",
                kwargs={"company_id": self.company.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)


    def test_manager_can_list_pending_invitations(self):
        create_invitation(
            company=self.company,
            email="pending@example.com",
            role=Invitation.Role.TECHNICIAN,
            invited_by=self.admin,
        )

        self.client.force_authenticate(user=self.manager)

        response = self.client.get(
            reverse(
                "company-invitation-list",
                kwargs={"company_id": self.company.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)


    def test_technician_cannot_list_pending_invitations(self):
        self.client.force_authenticate(user=self.technician)

        response = self.client.get(
            reverse(
                "company-invitation-list",
                kwargs={"company_id": self.company.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    def test_user_from_another_company_cannot_list_invitations(self):
        self.client.force_authenticate(user=self.other_admin)

        response = self.client.get(
            reverse(
                "company-invitation-list",
                kwargs={"company_id": self.company.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

class CompanyInvitationRevokeAPITests(APITestCase):
    def setUp(self):
        self.company = Company.objects.create(
            name="Revoke Test Company",
            phone="9876543210",
            email="revoke-company@example.com",
        )
        self.other_company = Company.objects.create(
            name="Other Revoke Company",
            phone="9876543211",
            email="other-revoke@example.com",
        )

        self.admin = User.objects.create_user(
            email="revoke-admin@example.com",
            password="TestPassword123!",
        )
        self.manager = User.objects.create_user(
            email="revoke-manager@example.com",
            password="TestPassword123!",
        )
        self.technician = User.objects.create_user(
            email="revoke-tech@example.com",
            password="TestPassword123!",
        )
        self.other_admin = User.objects.create_user(
            email="other-revoke-admin@example.com",
            password="TestPassword123!",
        )

        self.add_membership(
            self.admin, self.company,
            CompanyMembership.Role.COMPANY_ADMIN,
        )
        self.add_membership(
            self.manager, self.company,
            CompanyMembership.Role.MANAGER,
        )
        self.add_membership(
            self.technician, self.company,
            CompanyMembership.Role.TECHNICIAN,
        )
        self.add_membership(
            self.other_admin, self.other_company,
            CompanyMembership.Role.COMPANY_ADMIN,
        )

    def add_membership(self, user, company, role):
        return CompanyMembership.objects.create(
            user=user,
            company=company,
            role=role,
            status=CompanyMembership.Status.ACTIVE,
        )

    def create_invitation(self, company=None, role=None, status_value=None):
        invitation, token = create_invitation(
            company=company or self.company,
            email="pending-tech@example.com",
            role=role or Invitation.Role.TECHNICIAN,
            invited_by=self.admin,
        )

        if status_value:
            invitation.status = status_value
            invitation.save(update_fields=["status", "updated_at"])

        return invitation, token

    def revoke(self, user, invitation):
        self.client.force_authenticate(user=user)

        return self.client.delete(
            reverse(
                "company-invitation-revoke",
                kwargs={
                    "company_id": self.company.id,
                    "invitation_id": invitation.id,
                },
            )
        )

    def test_admin_can_revoke_pending_invitation(self):
        invitation, _ = self.create_invitation()

        response = self.revoke(self.admin, invitation)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        invitation.refresh_from_db()
        self.assertEqual(invitation.status, Invitation.Status.REVOKED)

    def test_manager_can_revoke_technician_invitation(self):
        invitation, _ = self.create_invitation()

        response = self.revoke(self.manager, invitation)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        invitation.refresh_from_db()
        self.assertEqual(invitation.status, Invitation.Status.REVOKED)

    def test_manager_cannot_revoke_company_admin_invitation(self):
        invitation, _ = self.create_invitation(
            role=Invitation.Role.COMPANY_ADMIN,
        )

        response = self.revoke(self.manager, invitation)

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        invitation.refresh_from_db()
        self.assertEqual(invitation.status, Invitation.Status.PENDING)

    def test_technician_cannot_revoke_invitation(self):
        invitation, _ = self.create_invitation()

        response = self.revoke(self.technician, invitation)

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_user_from_another_company_cannot_revoke_invitation(self):
        invitation, _ = self.create_invitation()

        response = self.revoke(self.other_admin, invitation)

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_invitation_from_another_company_returns_not_found(self):
        invitation, _ = self.create_invitation(
            company=self.other_company,
        )

        response = self.revoke(self.admin, invitation)

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_non_pending_invitation_cannot_be_revoked(self):
        for invitation_status in [
            Invitation.Status.ACCEPTED,
            Invitation.Status.EXPIRED,
            Invitation.Status.REVOKED,
        ]:
            invitation, _ = self.create_invitation(
                status_value=invitation_status,
            )

            response = self.revoke(self.admin, invitation)

            self.assertEqual(
                response.status_code,
                status.HTTP_404_NOT_FOUND,
            )

    def test_unauthenticated_user_cannot_revoke_invitation(self):
        invitation, _ = self.create_invitation()

        response = self.client.delete(
            reverse(
                "company-invitation-revoke",
                kwargs={
                    "company_id": self.company.id,
                    "invitation_id": invitation.id,
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

class CompanyInvitationResendAPITests(APITestCase):
    def setUp(self):
        self.company = Company.objects.create(
            name="Resend Test Company",
            phone="9876543210",
            email="resend-company@example.com",
        )
        self.other_company = Company.objects.create(
            name="Other Resend Company",
            phone="9876543211",
            email="other-resend@example.com",
        )

        self.admin = User.objects.create_user(
            email="resend-admin@example.com",
            password="TestPassword123!",
        )
        self.manager = User.objects.create_user(
            email="resend-manager@example.com",
            password="TestPassword123!",
        )
        self.technician = User.objects.create_user(
            email="resend-tech@example.com",
            password="TestPassword123!",
        )
        self.other_admin = User.objects.create_user(
            email="other-resend-admin@example.com",
            password="TestPassword123!",
        )

        self.add_membership(
            self.admin, self.company,
            CompanyMembership.Role.COMPANY_ADMIN,
        )
        self.add_membership(
            self.manager, self.company,
            CompanyMembership.Role.MANAGER,
        )
        self.add_membership(
            self.technician, self.company,
            CompanyMembership.Role.TECHNICIAN,
        )
        self.add_membership(
            self.other_admin, self.other_company,
            CompanyMembership.Role.COMPANY_ADMIN,
        )

    def add_membership(self, user, company, role):
        return CompanyMembership.objects.create(
            user=user,
            company=company,
            role=role,
            status=CompanyMembership.Status.ACTIVE,
        )

    def create_invitation(self, company=None, role=None, status_value=None):
        invitation, token = create_invitation(
            company=company or self.company,
            email="pending-resend@example.com",
            role=role or Invitation.Role.TECHNICIAN,
            invited_by=self.admin,
        )

        if status_value:
            invitation.status = status_value
            invitation.save(update_fields=["status", "updated_at"])

        return invitation, token

    def resend(self, user, invitation):
        self.client.force_authenticate(user=user)

        return self.client.post(
            reverse(
                "company-invitation-resend",
                kwargs={
                    "company_id": self.company.id,
                    "invitation_id": invitation.id,
                },
            )
        )

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
        FRONTEND_URL="http://localhost:3000",
    )
    def test_admin_can_resend_pending_invitation(self):
        invitation, old_token = self.create_invitation()
        old_expiry = invitation.expires_at

        response = self.resend(self.admin, invitation)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        invitation.refresh_from_db()
        self.assertEqual(invitation.status, Invitation.Status.PENDING)
        self.assertNotEqual(
            invitation.token_hash,
            hash_invitation_token(old_token),
        )
        self.assertGreater(invitation.expires_at, old_expiry)

        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertEqual(email.to, ["pending-resend@example.com"])

        new_token = email.body.split(
            "/accept-invitation?token=", 1
        )[1].split()[0]

        self.assertEqual(
            invitation.token_hash,
            hash_invitation_token(new_token),
        )
        self.assertNotEqual(new_token, old_token)

        with self.assertRaises(InvalidInvitationError):
            get_valid_invitation(old_token)

        self.assertEqual(
            get_valid_invitation(new_token).id,
            invitation.id,
        )

    def test_manager_can_resend_technician_invitation(self):
        invitation, _ = self.create_invitation()

        response = self.resend(self.manager, invitation)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_manager_cannot_resend_company_admin_invitation(self):
        invitation, _ = self.create_invitation(
            role=Invitation.Role.COMPANY_ADMIN,
        )
        old_hash = invitation.token_hash

        response = self.resend(self.manager, invitation)

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        invitation.refresh_from_db()
        self.assertEqual(invitation.token_hash, old_hash)

    def test_technician_cannot_resend_invitation(self):
        invitation, _ = self.create_invitation()

        response = self.resend(self.technician, invitation)

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_user_from_another_company_cannot_resend_invitation(self):
        invitation, _ = self.create_invitation()

        response = self.resend(self.other_admin, invitation)

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_invitation_from_another_company_returns_not_found(self):
        invitation, _ = self.create_invitation(
            company=self.other_company,
        )

        response = self.resend(self.admin, invitation)

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_non_pending_invitation_cannot_be_resent(self):
        for invitation_status in [
            Invitation.Status.ACCEPTED,
            Invitation.Status.EXPIRED,
            Invitation.Status.REVOKED,
        ]:
            invitation, _ = self.create_invitation(
                status_value=invitation_status,
            )

            response = self.resend(self.admin, invitation)

            self.assertEqual(
                response.status_code,
                status.HTTP_404_NOT_FOUND,
            )

    @patch(
        "main.accounts.views.send_company_invitation_email",
        side_effect=OSError("SMTP unavailable"),
    )
    def test_email_failure_rolls_back_token_and_expiry(self, mock_send_email):
        invitation, old_token = self.create_invitation()
        old_hash = invitation.token_hash
        old_expiry = invitation.expires_at

        response = self.resend(self.admin, invitation)

        self.assertEqual(
            response.status_code,
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )

        invitation.refresh_from_db()
        self.assertEqual(invitation.token_hash, old_hash)
        self.assertEqual(invitation.expires_at, old_expiry)

        self.assertEqual(
            get_valid_invitation(old_token).id,
            invitation.id,
        )
        mock_send_email.assert_called_once()

    def test_unauthenticated_user_cannot_resend_invitation(self):
        invitation, _ = self.create_invitation()

        response = self.client.post(
            reverse(
                "company-invitation-resend",
                kwargs={
                    "company_id": self.company.id,
                    "invitation_id": invitation.id,
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
