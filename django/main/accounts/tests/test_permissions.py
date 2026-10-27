
from types import SimpleNamespace
from unittest.mock import Mock

from django.test import TestCase
from rest_framework.test import APIRequestFactory

from main.accounts.models import CompanyMembership, User
from main.accounts.permissions import (
    IsActiveCompanyMember,
    IsCompanyAdminOrManager,
)
from main.companies.models import Company


class CompanyPermissionTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.company = Company.objects.create(
            name="Permission Test Company",
            phone="9876543210",
            email="permission@example.com",
        )
        self.other_company = Company.objects.create(
            name="Other Test Company",
            phone="9876543211",
            email="other@example.com",
        )
        self.user = User.objects.create_user(
            email="manager@example.com",
            password="TestPassword!2026",
        )

    def make_view(self, company=None):
        view = SimpleNamespace()
        view.get_company = Mock(return_value=company or self.company)
        return view

    def make_request(self, user):
        request = self.factory.get("/api/invitations/")
        request.user = user
        return request

    def add_membership(
        self,
        *,
        user=None,
        company=None,
        role=CompanyMembership.Role.TECHNICIAN,
        status=CompanyMembership.Status.ACTIVE,
    ):
        return CompanyMembership.objects.create(
            user=user or self.user,
            company=company or self.company,
            role=role,
            status=status,
        )

    def test_active_company_member_is_allowed(self):
        self.add_membership()

        permission = IsActiveCompanyMember()

        self.assertTrue(
            permission.has_permission(
                self.make_request(self.user),
                self.make_view(),
            )
        )

    def test_member_of_another_company_is_denied(self):
        self.add_membership(company=self.other_company)

        permission = IsActiveCompanyMember()

        self.assertFalse(
            permission.has_permission(
                self.make_request(self.user),
                self.make_view(self.company),
            )
        )

    def test_suspended_member_is_denied(self):
        self.add_membership(status=CompanyMembership.Status.SUSPENDED)

        permission = IsActiveCompanyMember()

        self.assertFalse(
            permission.has_permission(
                self.make_request(self.user),
                self.make_view(),
            )
        )

    def test_technician_cannot_manage_company(self):
        self.add_membership(role=CompanyMembership.Role.TECHNICIAN)

        permission = IsCompanyAdminOrManager()

        self.assertFalse(
            permission.has_permission(
                self.make_request(self.user),
                self.make_view(),
            )
        )

    def test_manager_can_manage_company(self):
        self.add_membership(role=CompanyMembership.Role.MANAGER)

        permission = IsCompanyAdminOrManager()

        self.assertTrue(
            permission.has_permission(
                self.make_request(self.user),
                self.make_view(),
            )
        )

    def test_company_admin_can_manage_company(self):
        self.add_membership(role=CompanyMembership.Role.COMPANY_ADMIN)

        permission = IsCompanyAdminOrManager()

        self.assertTrue(
            permission.has_permission(
                self.make_request(self.user),
                self.make_view(),
            )
        )

    def test_superuser_can_manage_company(self):
        superuser = User.objects.create_superuser(
            email="support@example.com",
            password="SupportPassword!2026",
        )

        permission = IsCompanyAdminOrManager()

        self.assertTrue(
            permission.has_permission(
                self.make_request(superuser),
                self.make_view(),
            )
        )
