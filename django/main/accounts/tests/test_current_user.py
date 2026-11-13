from django.test import TestCase
from rest_framework.test import APIClient

from main.accounts.models import CompanyMembership, User
from main.companies.models import Company


class CurrentUserProfileAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.company = Company.objects.create(
            name="ServiceFlow Test Company",
            phone="9876543210",
            email="company@example.com",
        )

        self.user = User.objects.create_user(
            email="admin@example.com",
            password="TestPassword123!",
            first_name="John",
            last_name="Admin",
            phone="9876543210",
        )

        self.membership = CompanyMembership.objects.create(
            user=self.user,
            company=self.company,
            role=CompanyMembership.Role.COMPANY_ADMIN,
            status=CompanyMembership.Status.ACTIVE,
        )

        self.url = "/api/accounts/me/"

    def test_authenticated_user_can_retrieve_own_profile(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], str(self.user.id))
        self.assertEqual(response.data["first_name"], "John")
        self.assertEqual(response.data["last_name"], "Admin")
        self.assertEqual(response.data["full_name"], "John Admin")
        self.assertEqual(response.data["email"], self.user.email)
        self.assertEqual(response.data["phone"], "9876543210")

    def test_profile_includes_active_company_membership(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["memberships"],
            [
                {
                    "company_id": str(self.company.id),
                    "company_name": self.company.name,
                    "role": CompanyMembership.Role.COMPANY_ADMIN,
                    "status": CompanyMembership.Status.ACTIVE,
                }
            ],
        )

    def test_profile_excludes_inactive_memberships(self):
        # Suspend the original membership.
        self.membership.status = CompanyMembership.Status.SUSPENDED
        self.membership.save(update_fields=["status"])

        # Create an active membership under an inactive company.
        inactive_company = Company.objects.create(
            name="Inactive Company",
            phone="1111111111",
            email="inactive@example.com",
            is_active=False,
        )

        CompanyMembership.objects.create(
            user=self.user,
            company=inactive_company,
            role=CompanyMembership.Role.MANAGER,
            status=CompanyMembership.Status.ACTIVE,
        )

        # Create one valid active membership under an active company.
        active_company = Company.objects.create(
            name="Active Company",
            phone="2222222222",
            email="active@example.com",
        )

        CompanyMembership.objects.create(
            user=self.user,
            company=active_company,
            role=CompanyMembership.Role.MANAGER,
            status=CompanyMembership.Status.ACTIVE,
        )

        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["memberships"]), 1)
        self.assertEqual(
            response.data["memberships"][0]["company_id"],
            str(active_company.id),
        )
        self.assertEqual(
            response.data["memberships"][0]["company_name"],
            "Active Company",
        )

    def test_profile_returns_empty_memberships_when_user_has_none(self):
        user_without_membership = User.objects.create_user(
            email="unassigned@example.com",
            password="TestPassword123!",
        )

        self.client.force_authenticate(user=user_without_membership)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["memberships"], [])

    def test_unauthenticated_user_cannot_retrieve_profile(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 401)
