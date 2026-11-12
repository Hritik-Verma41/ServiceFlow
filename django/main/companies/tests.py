from django.test import TestCase
from rest_framework.test import APIClient

from main.accounts.models import CompanyMembership, User
from main.companies.models import Company, Customer, CustomerAddress


class CompanyCustomerAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.company_a = Company.objects.create(
            name="Company A",
            phone="1111111111",
            email="a@example.com",
        )
        cls.company_b = Company.objects.create(
            name="Company B",
            phone="2222222222",
            email="b@example.com",
        )

        cls.admin = User.objects.create_user(
            email="admin@example.com",
            password="TestPassword123!",
        )
        cls.technician = User.objects.create_user(
            email="tech@example.com",
            password="TestPassword123!",
        )
        cls.other_company_user = User.objects.create_user(
            email="other@example.com",
            password="TestPassword123!",
        )

        CompanyMembership.objects.create(
            user=cls.admin,
            company=cls.company_a,
            role=CompanyMembership.Role.COMPANY_ADMIN,
            status=CompanyMembership.Status.ACTIVE,
        )
        CompanyMembership.objects.create(
            user=cls.technician,
            company=cls.company_a,
            role=CompanyMembership.Role.TECHNICIAN,
            status=CompanyMembership.Status.ACTIVE,
        )
        CompanyMembership.objects.create(
            user=cls.other_company_user,
            company=cls.company_b,
            role=CompanyMembership.Role.COMPANY_ADMIN,
            status=CompanyMembership.Status.ACTIVE,
        )

        cls.customer_a = Customer.objects.create(
            company=cls.company_a,
            name="Customer A",
            email="customer-a@example.com",
        )
        cls.customer_b = Customer.objects.create(
            company=cls.company_b,
            name="Customer B",
            email="customer-b@example.com",
        )

    def setUp(self):
        self.client = APIClient()

    def url(self, company_id=None):
        company_id = company_id or self.company_a.id
        return f"/api/companies/{company_id}/customers/"

    def test_active_company_member_can_list_customers(self):
        self.client.force_authenticate(user=self.technician)

        response = self.client.get(self.url())

        self.assertEqual(response.status_code, 200)
        customer_ids = {item["id"] for item in response.data["results"]} \
            if isinstance(response.data, dict) and "results" in response.data \
            else {item["id"] for item in response.data}

        self.assertIn(str(self.customer_a.id), customer_ids)
        self.assertNotIn(str(self.customer_b.id), customer_ids)

    def test_company_admin_can_create_customer(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            self.url(),
            {
                "name": "New Customer",
                "email": "new@example.com",
                "phone": "9999999999",
                "notes": "Created through API",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        customer = Customer.objects.get(id=response.data["id"])
        self.assertEqual(customer.company, self.company_a)

    def test_technician_cannot_create_customer(self):
        self.client.force_authenticate(user=self.technician)

        response = self.client.post(
            self.url(),
            {"name": "Unauthorized Customer"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(
            Customer.objects.filter(name="Unauthorized Customer").exists()
        )

    def test_other_company_member_cannot_access_company_a(self):
        self.client.force_authenticate(user=self.other_company_user)

        response = self.client.get(self.url())

        self.assertEqual(response.status_code, 403)

    def test_request_cannot_override_company_from_url(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            self.url(),
            {
                "name": "Company A Customer",
                "email": "forged@example.com",
                "company": str(self.company_b.id),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        customer = Customer.objects.get(id=response.data["id"])
        self.assertEqual(customer.company, self.company_a)

    def test_unauthenticated_user_cannot_list_customers(self):
        response = self.client.get(self.url())

        self.assertEqual(response.status_code, 401)

    def customer_detail_url(self, customer_id, company_id=None):
        company_id = company_id or self.company_a.id
        return (
            f"/api/companies/{company_id}/"
            f"customers/{customer_id}/"
        )

    def test_active_member_can_retrieve_customer(self):
        self.client.force_authenticate(user=self.technician)

        response = self.client.get(
            self.customer_detail_url(self.customer_a.id)
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], str(self.customer_a.id))

    def test_company_admin_can_update_customer(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            self.customer_detail_url(self.customer_a.id),
            {"name": "Updated Customer"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.customer_a.refresh_from_db()
        self.assertEqual(self.customer_a.name, "Updated Customer")

    def test_technician_cannot_update_customer(self):
        self.client.force_authenticate(user=self.technician)

        response = self.client.patch(
            self.customer_detail_url(self.customer_a.id),
            {"name": "Unauthorized Update"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

        self.customer_a.refresh_from_db()
        self.assertEqual(self.customer_a.name, "Customer A")

    def test_other_company_customer_cannot_be_retrieved(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(
            self.customer_detail_url(self.customer_b.id)
        )

        self.assertEqual(response.status_code, 404)

    def test_company_admin_can_soft_deactivate_customer(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.delete(
            self.customer_detail_url(self.customer_a.id)
        )

        self.assertEqual(response.status_code, 204)

        self.customer_a.refresh_from_db()
        self.assertFalse(self.customer_a.is_active)

    def test_deactivated_customer_is_not_in_customer_list(self):
        self.customer_a.is_active = False
        self.customer_a.save(update_fields=["is_active"])

        self.client.force_authenticate(user=self.technician)

        response = self.client.get(self.url())

        self.assertEqual(response.status_code, 200)

        customer_ids = {
            item["id"] for item in response.data["results"]
        } if isinstance(response.data, dict) and "results" in response.data else {
            item["id"] for item in response.data
        }

        self.assertNotIn(str(self.customer_a.id), customer_ids)

    def customer_address_list_url(self, customer_id=None, company_id=None):
        company_id = company_id or self.company_a.id
        customer_id = customer_id or self.customer_a.id

        return (
            f"/api/companies/{company_id}/"
            f"customers/{customer_id}/addresses/"
        )

    def customer_address_detail_url(
        self,
        address_id,
        customer_id=None,
        company_id=None,
    ):
        return (
            f"{self.customer_address_list_url(customer_id, company_id)}"
            f"{address_id}/"
        )

    def create_test_address(self, customer=None):
        return CustomerAddress.objects.create(
            customer=customer or self.customer_a,
            label="Office",
            address_line_1="123 Test Street",
            address_line_2="Floor 2",
            city="Pune",
            state="Maharashtra",
            postal_code="411001",
            country="India",
            is_primary=False,
        )

    def test_active_member_can_list_customer_addresses(self):
        address = self.create_test_address()

        self.client.force_authenticate(user=self.technician)

        response = self.client.get(
            self.customer_address_list_url()
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], str(address.id))

    def test_company_admin_can_create_customer_address(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            self.customer_address_list_url(),
            {
                "label": "Office",
                "address_line_1": "123 Test Street",
                "address_line_2": "Floor 2",
                "city": "Pune",
                "state": "Maharashtra",
                "postal_code": "411001",
                "country": "India",
                "is_primary": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        address = CustomerAddress.objects.get(
            id=response.data["id"]
        )
        self.assertEqual(address.customer, self.customer_a)

    def test_request_cannot_override_customer_from_url(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            self.customer_address_list_url(),
            {
                "customer": str(self.customer_b.id),
                "label": "Office",
                "address_line_1": "123 Test Street",
                "city": "Pune",
                "state": "Maharashtra",
                "postal_code": "411001",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        address = CustomerAddress.objects.get(
            id=response.data["id"]
        )
        self.assertEqual(address.customer, self.customer_a)

    def test_technician_cannot_create_customer_address(self):
        self.client.force_authenticate(user=self.technician)

        response = self.client.post(
            self.customer_address_list_url(),
            {
                "label": "Office",
                "address_line_1": "123 Test Street",
                "city": "Pune",
                "state": "Maharashtra",
                "postal_code": "411001",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(CustomerAddress.objects.count(), 0)

    def test_active_member_can_retrieve_customer_address(self):
        address = self.create_test_address()

        self.client.force_authenticate(user=self.technician)

        response = self.client.get(
            self.customer_address_detail_url(address.id)
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], str(address.id))

    def test_company_admin_can_update_customer_address(self):
        address = self.create_test_address()

        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            self.customer_address_detail_url(address.id),
            {"city": "Mumbai"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        address.refresh_from_db()
        self.assertEqual(address.city, "Mumbai")

    def test_technician_cannot_update_customer_address(self):
        address = self.create_test_address()

        self.client.force_authenticate(user=self.technician)

        response = self.client.patch(
            self.customer_address_detail_url(address.id),
            {"city": "Mumbai"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

        address.refresh_from_db()
        self.assertEqual(address.city, "Pune")

    def test_company_admin_can_delete_customer_address(self):
        address = self.create_test_address()

        self.client.force_authenticate(user=self.admin)

        response = self.client.delete(
            self.customer_address_detail_url(address.id)
        )

        self.assertEqual(response.status_code, 204)
        self.assertFalse(
            CustomerAddress.objects.filter(id=address.id).exists()
        )

    def test_address_from_another_customer_cannot_be_retrieved(self):
        other_customer = Customer.objects.create(
            company=self.company_a,
            name="Another Customer",
            email="another@example.com",
        )
        address = self.create_test_address(customer=other_customer)

        self.client.force_authenticate(user=self.admin)

        response = self.client.get(
            self.customer_address_detail_url(address.id)
        )

        self.assertEqual(response.status_code, 404)

    def test_other_company_customer_addresses_cannot_be_accessed(self):
        address = self.create_test_address(customer=self.customer_b)

        self.client.force_authenticate(user=self.admin)

        response = self.client.get(
            self.customer_address_list_url(
                customer_id=self.customer_b.id,
            )
        )

        self.assertEqual(response.status_code, 404)

    def test_unauthenticated_user_cannot_list_customer_addresses(self):
        response = self.client.get(
            self.customer_address_list_url()
        )

        self.assertEqual(response.status_code, 401)

class CompanyCreateAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="creator@example.com",
            password="TestPassword123!",
        )

    def test_authenticated_user_can_create_company(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            "/api/companies/",
            {
                "name": "ServiceFlow Technologies",
                "phone": "9876543210",
                "email": "contact@serviceflow.example",
                "city": "Pune",
                "state": "Maharashtra",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        company = Company.objects.get(id=response.data["id"])

        self.assertEqual(company.name, "ServiceFlow Technologies")
        self.assertTrue(company.is_active)

        membership = CompanyMembership.objects.get(
            user=self.user,
            company=company,
        )

        self.assertEqual(
            membership.role,
            CompanyMembership.Role.COMPANY_ADMIN,
        )
        self.assertEqual(
            membership.status,
            CompanyMembership.Status.ACTIVE,
        )

    def test_unauthenticated_user_cannot_create_company(self):
        response = self.client.post(
            "/api/companies/",
            {
                "name": "Unauthorized Company",
                "phone": "9876543210",
                "email": "unauthorized@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertFalse(
            Company.objects.filter(
                name="Unauthorized Company"
            ).exists()
        )

class CompanyListAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            email="company-owner@example.com",
            password="TestPassword123!",
        )
        cls.other_user = User.objects.create_user(
            email="other-owner@example.com",
            password="TestPassword123!",
        )

        cls.company_a = Company.objects.create(
            name="Alpha Services",
            phone="1111111111",
            email="alpha@example.com",
        )
        cls.company_b = Company.objects.create(
            name="Beta Services",
            phone="2222222222",
            email="beta@example.com",
        )
        cls.inactive_company = Company.objects.create(
            name="Inactive Services",
            phone="3333333333",
            email="inactive@example.com",
            is_active=False,
        )
        invited_company = Company.objects.create(
            name="Invited Services",
            phone="5555555555",
            email="invited@example.com",
        )
        suspended_company = Company.objects.create(
            name="Suspended Services",
            phone="6666666666",
            email="suspended@example.com",
        )

        CompanyMembership.objects.create(
            user=cls.user,
            company=invited_company,
            role=CompanyMembership.Role.TECHNICIAN,
            status=CompanyMembership.Status.INVITED,
        )
        CompanyMembership.objects.create(
            user=cls.user,
            company=suspended_company,
            role=CompanyMembership.Role.TECHNICIAN,
            status=CompanyMembership.Status.SUSPENDED,
        )
        CompanyMembership.objects.create(
            user=cls.user,
            company=cls.company_a,
            role=CompanyMembership.Role.COMPANY_ADMIN,
            status=CompanyMembership.Status.ACTIVE,
        )
        CompanyMembership.objects.create(
            user=cls.user,
            company=cls.company_b,
            role=CompanyMembership.Role.MANAGER,
            status=CompanyMembership.Status.ACTIVE,
        )
        CompanyMembership.objects.create(
            user=cls.user,
            company=cls.inactive_company,
            role=CompanyMembership.Role.COMPANY_ADMIN,
            status=CompanyMembership.Status.ACTIVE,
        )
        CompanyMembership.objects.create(
            user=cls.other_user,
            company=Company.objects.create(
                name="Other Company",
                phone="4444444444",
                email="other-company@example.com",
            ),
            role=CompanyMembership.Role.COMPANY_ADMIN,
            status=CompanyMembership.Status.ACTIVE,
        )

    def setUp(self):
        self.client = APIClient()

    def test_user_can_list_only_active_member_companies(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get("/api/companies/")

        self.assertEqual(response.status_code, 200)

        companies = (
            response.data["results"]
            if isinstance(response.data, dict) and "results" in response.data
            else response.data
        )
        company_ids = {item["id"] for item in companies}

        self.assertEqual(
            company_ids,
            {
                str(self.company_a.id),
                str(self.company_b.id),
            },
        )

        company_names = [item["name"] for item in companies]
        self.assertEqual(
            company_names,
            ["Alpha Services", "Beta Services"],
        )

    def test_unauthenticated_user_cannot_list_companies(self):
        response = self.client.get("/api/companies/")

        self.assertEqual(response.status_code, 401)

class CompanyDetailAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(
            email="detail-admin@example.com",
            password="TestPassword123!",
        )
        cls.manager = User.objects.create_user(
            email="detail-manager@example.com",
            password="TestPassword123!",
        )
        cls.technician = User.objects.create_user(
            email="detail-technician@example.com",
            password="TestPassword123!",
        )
        cls.other_user = User.objects.create_user(
            email="detail-other@example.com",
            password="TestPassword123!",
        )

        cls.company = Company.objects.create(
            name="Detail Test Company",
            phone="9876543210",
            email="detail@example.com",
        )

        cls.other_company = Company.objects.create(
            name="Other Detail Company",
            phone="1234567890",
            email="other-detail@example.com",
        )

        cls.inactive_company = Company.objects.create(
            name="Inactive Detail Company",
            phone="1111111111",
            email="inactive-detail@example.com",
            is_active=False,
        )

        CompanyMembership.objects.create(
            user=cls.admin,
            company=cls.company,
            role=CompanyMembership.Role.COMPANY_ADMIN,
            status=CompanyMembership.Status.ACTIVE,
        )
        CompanyMembership.objects.create(
            user=cls.manager,
            company=cls.company,
            role=CompanyMembership.Role.MANAGER,
            status=CompanyMembership.Status.ACTIVE,
        )
        CompanyMembership.objects.create(
            user=cls.technician,
            company=cls.company,
            role=CompanyMembership.Role.TECHNICIAN,
            status=CompanyMembership.Status.ACTIVE,
        )
        CompanyMembership.objects.create(
            user=cls.other_user,
            company=cls.other_company,
            role=CompanyMembership.Role.COMPANY_ADMIN,
            status=CompanyMembership.Status.ACTIVE,
        )

    def setUp(self):
        self.client = APIClient()
        self.url = f"/api/companies/{self.company.id}/"

    def test_active_company_member_can_retrieve_company(self):
        self.client.force_authenticate(user=self.technician)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["name"], self.company.name)
        self.assertEqual(response.data["id"], str(self.company.id))

    def test_company_admin_can_update_company(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            self.url,
            {"name": "Updated ServiceFlow Company"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.company.refresh_from_db()
        self.assertEqual(
            self.company.name,
            "Updated ServiceFlow Company",
        )

    def test_company_manager_can_update_company(self):
        self.client.force_authenticate(user=self.manager)

        response = self.client.patch(
            self.url,
            {"city": "Pune"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.company.refresh_from_db()
        self.assertEqual(self.company.city, "Pune")

    def test_technician_cannot_update_company(self):
        self.client.force_authenticate(user=self.technician)

        response = self.client.patch(
            self.url,
            {"name": "Unauthorized Update"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_company_admin_can_deactivate_company(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, 204)

        self.company.refresh_from_db()
        self.assertFalse(self.company.is_active)

    def test_company_manager_cannot_deactivate_company(self):
        self.client.force_authenticate(user=self.manager)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, 403)

        self.company.refresh_from_db()
        self.assertTrue(self.company.is_active)

    def test_other_company_member_cannot_retrieve_company(self):
        self.client.force_authenticate(user=self.other_user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 403)

    def test_inactive_company_cannot_be_retrieved(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(
            f"/api/companies/{self.inactive_company.id}/"
        )

        self.assertEqual(response.status_code, 404)

    def test_unauthenticated_user_cannot_retrieve_company(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 401)

    def test_update_cannot_change_company_active_status(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            self.url,
            {
                "name": "Still Active",
                "is_active": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.company.refresh_from_db()
        self.assertTrue(self.company.is_active)
