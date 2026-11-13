from django.test import TestCase
from rest_framework.test import APIClient

from main.accounts.models import CompanyMembership, User
from main.companies.models import Company


class CompanyMemberListAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(
            name="ServiceFlow Test Company",
            phone="9876543210",
            email="company@example.com",
        )

        cls.other_company = Company.objects.create(
            name="Other Company",
            phone="1111111111",
            email="other@example.com",
        )

        cls.admin = User.objects.create_user(
            email="admin@example.com",
            password="TestPassword123!",
            first_name="John",
            last_name="Admin",
            phone="9876543210",
        )

        cls.technician = User.objects.create_user(
            email="tech@example.com",
            password="TestPassword123!",
            first_name="Jane",
            last_name="Technician",
        )

        cls.suspended_user = User.objects.create_user(
            email="suspended@example.com",
            password="TestPassword123!",
        )

        cls.invited_user = User.objects.create_user(
            email="invited@example.com",
            password="TestPassword123!",
        )

        cls.other_company_user = User.objects.create_user(
            email="other-user@example.com",
            password="TestPassword123!",
        )

        cls.admin_membership = CompanyMembership.objects.create(
            user=cls.admin,
            company=cls.company,
            role=CompanyMembership.Role.COMPANY_ADMIN,
            status=CompanyMembership.Status.ACTIVE,
        )

        cls.technician_membership = CompanyMembership.objects.create(
            user=cls.technician,
            company=cls.company,
            role=CompanyMembership.Role.TECHNICIAN,
            status=CompanyMembership.Status.ACTIVE,
        )

        cls.suspended_membership = CompanyMembership.objects.create(
            user=cls.suspended_user,
            company=cls.company,
            role=CompanyMembership.Role.TECHNICIAN,
            status=CompanyMembership.Status.SUSPENDED,
        )

        cls.invited_membership = CompanyMembership.objects.create(
            user=cls.invited_user,
            company=cls.company,
            role=CompanyMembership.Role.MANAGER,
            status=CompanyMembership.Status.INVITED,
        )

        CompanyMembership.objects.create(
            user=cls.other_company_user,
            company=cls.other_company,
            role=CompanyMembership.Role.COMPANY_ADMIN,
            status=CompanyMembership.Status.ACTIVE,
        )

    def setUp(self):
        self.client = APIClient()
        self.url = (
            f"/api/companies/{self.company.id}/members/"
        )

    def get_members(self, response):
        if (
            isinstance(response.data, dict)
            and "results" in response.data
        ):
            return response.data["results"]

        return response.data

    def test_active_company_member_can_list_members(self):
        self.client.force_authenticate(user=self.technician)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)

        members = self.get_members(response)
        membership_ids = {
            member["id"] for member in members
        }

        self.assertEqual(
            membership_ids,
            {
                str(self.admin_membership.id),
                str(self.technician_membership.id),
                str(self.suspended_membership.id),
                str(self.invited_membership.id),
            },
        )

    def test_member_response_includes_nested_user_details(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)

        members = self.get_members(response)

        admin_member = next(
            member
            for member in members
            if member["id"] == str(self.admin_membership.id)
        )

        self.assertEqual(
            admin_member["user"]["id"],
            str(self.admin.id),
        )
        self.assertEqual(
            admin_member["user"]["email"],
            self.admin.email,
        )
        self.assertEqual(
            admin_member["user"]["first_name"],
            "John",
        )
        self.assertEqual(
            admin_member["user"]["last_name"],
            "Admin",
        )
        self.assertEqual(
            admin_member["role"],
            CompanyMembership.Role.COMPANY_ADMIN,
        )
        self.assertEqual(
            admin_member["status"],
            CompanyMembership.Status.ACTIVE,
        )

    def test_members_from_other_company_are_not_exposed(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)

        members = self.get_members(response)
        user_ids = {
            member["user"]["id"] for member in members
        }

        self.assertNotIn(
            str(self.other_company_user.id),
            user_ids,
        )

    def test_other_company_member_cannot_list_members(self):
        self.client.force_authenticate(
            user=self.other_company_user
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 403)

    def test_suspended_member_cannot_list_members(self):
        self.client.force_authenticate(
            user=self.suspended_user
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 403)

    def test_unauthenticated_user_cannot_list_members(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 401)

class CompanyMemberRoleUpdateAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(
            name="Role Update Test Company",
            phone="9876543210",
            email="role-company@example.com",
        )

        cls.other_company = Company.objects.create(
            name="Other Role Test Company",
            phone="1111111111",
            email="other-role-company@example.com",
        )

        cls.admin = User.objects.create_user(
            email="role-admin@example.com",
            password="TestPassword123!",
        )
        cls.second_admin = User.objects.create_user(
            email="role-admin2@example.com",
            password="TestPassword123!",
        )
        cls.manager = User.objects.create_user(
            email="role-manager@example.com",
            password="TestPassword123!",
        )
        cls.technician = User.objects.create_user(
            email="role-tech@example.com",
            password="TestPassword123!",
        )
        cls.suspended_user = User.objects.create_user(
            email="role-suspended@example.com",
            password="TestPassword123!",
        )
        cls.other_admin = User.objects.create_user(
            email="role-other-admin@example.com",
            password="TestPassword123!",
        )

        cls.admin_membership = CompanyMembership.objects.create(
            user=cls.admin,
            company=cls.company,
            role=CompanyMembership.Role.COMPANY_ADMIN,
            status=CompanyMembership.Status.ACTIVE,
        )
        cls.second_admin_membership = CompanyMembership.objects.create(
            user=cls.second_admin,
            company=cls.company,
            role=CompanyMembership.Role.COMPANY_ADMIN,
            status=CompanyMembership.Status.ACTIVE,
        )
        cls.manager_membership = CompanyMembership.objects.create(
            user=cls.manager,
            company=cls.company,
            role=CompanyMembership.Role.MANAGER,
            status=CompanyMembership.Status.ACTIVE,
        )
        cls.technician_membership = CompanyMembership.objects.create(
            user=cls.technician,
            company=cls.company,
            role=CompanyMembership.Role.TECHNICIAN,
            status=CompanyMembership.Status.ACTIVE,
        )
        cls.suspended_membership = CompanyMembership.objects.create(
            user=cls.suspended_user,
            company=cls.company,
            role=CompanyMembership.Role.TECHNICIAN,
            status=CompanyMembership.Status.SUSPENDED,
        )
        cls.other_admin_membership = CompanyMembership.objects.create(
            user=cls.other_admin,
            company=cls.other_company,
            role=CompanyMembership.Role.COMPANY_ADMIN,
            status=CompanyMembership.Status.ACTIVE,
        )

    def setUp(self):
        self.client = APIClient()

    def role_url(self, membership):
        return (
            f"/api/companies/{self.company.id}/"
            f"members/{membership.id}/role/"
        )

    def test_admin_can_promote_technician_to_manager(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            self.role_url(self.technician_membership),
            {"role": CompanyMembership.Role.MANAGER},
        )

        self.assertEqual(response.status_code, 200)
        self.technician_membership.refresh_from_db()
        self.assertEqual(
            self.technician_membership.role,
            CompanyMembership.Role.MANAGER,
        )

    def test_admin_can_promote_member_to_company_admin(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            self.role_url(self.technician_membership),
            {"role": CompanyMembership.Role.COMPANY_ADMIN},
        )

        self.assertEqual(response.status_code, 200)
        self.technician_membership.refresh_from_db()
        self.assertEqual(
            self.technician_membership.role,
            CompanyMembership.Role.COMPANY_ADMIN,
        )

    def test_manager_can_promote_technician_to_manager(self):
        self.client.force_authenticate(user=self.manager)

        response = self.client.patch(
            self.role_url(self.technician_membership),
            {"role": CompanyMembership.Role.MANAGER},
        )

        self.assertEqual(response.status_code, 200)

    def test_manager_cannot_promote_member_to_company_admin(self):
        self.client.force_authenticate(user=self.manager)

        response = self.client.patch(
            self.role_url(self.technician_membership),
            {"role": CompanyMembership.Role.COMPANY_ADMIN},
        )

        self.assertEqual(response.status_code, 403)

    def test_manager_cannot_change_company_admin_role(self):
        self.client.force_authenticate(user=self.manager)

        response = self.client.patch(
            self.role_url(self.second_admin_membership),
            {"role": CompanyMembership.Role.MANAGER},
        )

        self.assertEqual(response.status_code, 403)

    def test_last_active_admin_cannot_be_demoted(self):
        self.client.force_authenticate(user=self.admin)

        self.second_admin_membership.delete()

        response = self.client.patch(
            self.role_url(self.admin_membership),
            {"role": CompanyMembership.Role.MANAGER},
        )

        self.assertEqual(response.status_code, 400)
        self.admin_membership.refresh_from_db()
        self.assertEqual(
            self.admin_membership.role,
            CompanyMembership.Role.COMPANY_ADMIN,
        )

    def test_admin_can_demote_one_of_multiple_active_admins(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            self.role_url(self.second_admin_membership),
            {"role": CompanyMembership.Role.MANAGER},
        )

        self.assertEqual(response.status_code, 200)
        self.second_admin_membership.refresh_from_db()
        self.assertEqual(
            self.second_admin_membership.role,
            CompanyMembership.Role.MANAGER,
        )

    def test_suspended_membership_cannot_be_updated(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            self.role_url(self.suspended_membership),
            {"role": CompanyMembership.Role.MANAGER},
        )

        self.assertEqual(response.status_code, 404)

    def test_membership_from_another_company_cannot_be_updated(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            self.role_url(self.other_admin_membership),
            {"role": CompanyMembership.Role.MANAGER},
        )

        self.assertEqual(response.status_code, 404)

    def test_manager_cannot_update_membership_in_another_company(self):
        self.client.force_authenticate(user=self.other_admin)

        response = self.client.patch(
            self.role_url(self.technician_membership),
            {"role": CompanyMembership.Role.MANAGER},
        )

        self.assertEqual(response.status_code, 403)

    def test_technician_cannot_update_member_role(self):
        self.client.force_authenticate(user=self.technician)

        response = self.client.patch(
            self.role_url(self.manager_membership),
            {"role": CompanyMembership.Role.TECHNICIAN},
        )

        self.assertEqual(response.status_code, 403)

    def test_unauthenticated_user_cannot_update_member_role(self):
        response = self.client.patch(
            self.role_url(self.technician_membership),
            {"role": CompanyMembership.Role.MANAGER},
        )

        self.assertEqual(response.status_code, 401)

    def test_invalid_role_is_rejected(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            self.role_url(self.technician_membership),
            {"role": "INVALID_ROLE"},
        )

        self.assertEqual(response.status_code, 400)
