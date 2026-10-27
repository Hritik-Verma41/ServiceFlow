from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from main.accounts.models import CompanyMembership, Invitation, User
from main.accounts.services import create_invitation, hash_invitation_token
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

    def test_admin_can_create_invitation(self):
        response = self.invite(self.admin)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["email"], "new-tech@example.com")
        self.assertEqual(
            response.data["status"], Invitation.Status.PENDING
        )

        invitation = Invitation.objects.get(
            email="new-tech@example.com",
            company=self.company,
        )
        self.assertEqual(
            invitation.token_hash,
            hash_invitation_token(response.data["token"]),
        )
        self.assertNotEqual(invitation.token_hash, response.data["token"])

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
