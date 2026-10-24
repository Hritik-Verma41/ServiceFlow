from django.db import IntegrityError, transaction
from django.test import TestCase

from main.accounts.models import CompanyMembership, User
from main.companies.models import Company

class CompanyMembershipTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(
            name="ServiceFlow Test Company",
            phone="9876543210",
            email="company@example.com",
        )

        self.user = User.objects.create_user(
            email="techician@example.com",
            password="TestPassword!2026",
        )

    def test_membership_can_be_created(self):
        membership = CompanyMembership.objects.create(
            user=self.user,
            company=self.company,
            role=CompanyMembership.Role.TECHNICIAN,
        )

        self.assertEqual(membership.status, CompanyMembership.Status.ACTIVE)
        self.assertEqual(membership.role, CompanyMembership.Role.TECHNICIAN)
        self.assertEqual(membership.user, self.user)
        self.assertEqual(membership.company, self.company)

    def test_duplicate_user_company_membership_is_rejected(self):
        CompanyMembership.objects.create(
            user=self.user,
            company=self.company,
            role=CompanyMembership.Role.TECHNICIAN,
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                CompanyMembership.objects.create(
                    user=self.user,
                    company=self.company,
                    role=CompanyMembership.Role.MANAGER,
                )

    def test_membership_can_be_suspended(self):
        membership = CompanyMembership.objects.create(
            user=self.user,
            company=self.company,
            role=CompanyMembership.Role.TECHNICIAN,
        )

        membership.status=CompanyMembership.Status.SUSPENDED
        membership.save(update_fields=["status", "updated_at"])
        membership.refresh_from_db()

        self.assertEqual(
            membership.status,
            CompanyMembership.Status.SUSPENDED,
        )

    def test_user_can_belong_to_multiple_companies(self):
        second_company = Company.objects.create(
            name="Second Test Company",
            phone="9876543211",
            email="second@example.com",
        )

        CompanyMembership.objects.create(
            user=self.user,
            company=self.company,
            role=CompanyMembership.Role.TECHNICIAN,
        )
        CompanyMembership.objects.create(
            user=self.user,
            company=second_company,
            role=CompanyMembership.Role.MANAGER,
        )

        self.assertEqual(self.user.company_memberships.count(), 2)

        self.assertEqual(
            self.user.company_memberships.get(company=self.company).role,
            CompanyMembership.Role.TECHNICIAN,
        )
        self.assertEqual(
            self.user.company_memberships.get(company=second_company).role,
            CompanyMembership.Role.MANAGER,
        )
