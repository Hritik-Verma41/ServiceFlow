from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from main.accounts.models import CompanyMembership, Invitation, User
from main.accounts.services import hash_invitation_token
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
