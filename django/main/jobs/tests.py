
import hashlib
import hmac
import json
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from unittest import skipUnless
from unittest.mock import patch

from django.conf import settings
from django.db import close_old_connections, connection
from django.test import Client, TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from unittest.mock import Mock

from main.accounts.models import CompanyMembership, User
from main.companies.models import (
    Company,
    Customer,
    CustomerAddress,
)
from main.jobs.models import Invoice, Payment, ServiceJob
from main.jobs.services.razorpay_service import RazorpayService


class RazorpayWebhookTests(TestCase):
    def setUp(self):
        self.client = Client(HTTP_HOST="localhost")

        self.webhook_secret = "test-webhook-secret"
        self.url = "/api/payments/webhook/"

        self.company = Company.objects.create(
            name="Webhook Test Company",
            phone="9000000000",
            email="webhook-company@example.com",
        )

        self.customer = Customer.objects.create(
            company=self.company,
            name="Webhook Test Customer",
            email="webhook-customer@example.com",
        )

        self.address = CustomerAddress.objects.create(
            customer=self.customer,
            label="Test Address",
            address_line_1="123 Test Street",
            city="Pune",
            state="Maharashtra",
            postal_code="411001",
            country="India",
            is_primary=True,
        )

        self.job = ServiceJob.objects.create(
            company=self.company,
            customer=self.customer,
            service_address=self.address,
            title="Webhook Test Job",
        )

        self.invoice = Invoice.objects.create(
            company=self.company,
            customer=self.customer,
            job=self.job,
            invoice_number="INV-WEBHOOK-TEST",
            status=Invoice.Status.ISSUED,
            subtotal=Decimal("100.00"),
            tax_amount=Decimal("18.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("118.00"),
        )

        self.payment = Payment.objects.create(
            invoice=self.invoice,
            amount=Decimal("118.00"),
            method=Payment.Method.ONLINE,
            status=Payment.Status.PENDING,
            gateway=Payment.Gateway.RAZORPAY,
            gateway_order_id="order_webhook_test",
        )

        self.payload = {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_webhook_test",
                        "order_id": self.payment.gateway_order_id,
                        "amount": 11800,
                    }
                }
            },
        }

        # Override the configured secret for these tests.
        self.settings_override = patch.object(
            settings,
            "RAZORPAY_WEBHOOK_SECRET",
            self.webhook_secret,
        )
        self.settings_override.start()
        self.addCleanup(self.settings_override.stop)

    def post_webhook(self, payload=None, signature=None):
        raw_body = json.dumps(
            payload if payload is not None else self.payload
        )

        if signature is None:
            signature = hmac.new(
                self.webhook_secret.encode("utf-8"),
                raw_body.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()

        return self.client.post(
            self.url,
            data=raw_body,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=signature,
        )

    def test_invalid_signature_is_rejected(self):
        response = self.post_webhook(
            signature="invalid-signature",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "Invalid webhook signature.",
        )

        self.payment.refresh_from_db()
        self.assertEqual(
            self.payment.status,
            Payment.Status.PENDING,
        )

    def test_captured_payment_is_processed(self):
        response = self.post_webhook()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "processed")

        self.payment.refresh_from_db()
        self.assertEqual(
            self.payment.status,
            Payment.Status.SUCCESS,
        )
        self.assertEqual(
            self.payment.gateway_payment_id,
            "pay_webhook_test",
        )
        self.assertIsNotNone(self.payment.paid_at)

        self.invoice.refresh_from_db()
        self.assertEqual(
            self.invoice.status,
            Invoice.Status.PAID,
        )

    def test_duplicate_delivery_is_already_processed(self):
        first_response = self.post_webhook()
        second_response = self.post_webhook()

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(
            first_response.json()["status"],
            "processed",
        )

        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(
            second_response.json()["status"],
            "already_processed",
        )

        self.payment.refresh_from_db()
        self.assertEqual(
            self.payment.gateway_payment_id,
            "pay_webhook_test",
        )

    def test_different_payment_id_for_successful_order_is_rejected(self):
        first_response = self.post_webhook()
        self.assertEqual(first_response.status_code, 200)

        conflicting_payload = json.loads(
            json.dumps(self.payload)
        )
        conflicting_payload["payload"]["payment"]["entity"]["id"] = (
            "pay_different_test"
        )

        conflict_response = self.post_webhook(
            payload=conflicting_payload,
        )

        self.assertEqual(conflict_response.status_code, 409)

        self.payment.refresh_from_db()
        self.assertEqual(
            self.payment.gateway_payment_id,
            "pay_webhook_test",
        )

    def test_incorrect_amount_is_rejected(self):
        incorrect_payload = json.loads(
            json.dumps(self.payload)
        )
        incorrect_payload["payload"]["payment"]["entity"]["amount"] = (
            99999
        )

        response = self.post_webhook(
            payload=incorrect_payload,
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "Payment amount mismatch.",
        )

        self.payment.refresh_from_db()
        self.assertEqual(
            self.payment.status,
            Payment.Status.PENDING,
        )


class RazorpayCheckoutVerificationTests(RazorpayWebhookTests):
    """
    Reuse the isolated company, customer, address, invoice,
    and payment setup from RazorpayWebhookTests
    """

    def setUp(self):
        super().setUp()

        self.api_client = APIClient()
        self.api_client.force_authenticate(
            user=self.make_company_admin()
        )

        self.verify_url = "/api/payments/verify/"

        self.verify_payload = {
            "payment_id": str(self.payment.id),
            "razorpay_order_id": self.payment.gateway_order_id,
            "razorpay_payment_id": "pay_checkout_test",
            "razorpay_signature": "test-signature",
        }

    def make_company_admin(self):
        user = User.objects.create_user(
            email="webhook-admin@example.com",
            password="TestPassword-123!",
            role="COMPANY_ADMIN",
            company=self.company,
        )

        CompanyMembership.objects.create(
            user=user,
            company=self.company,
            role=CompanyMembership.Role.COMPANY_ADMIN,
            status=CompanyMembership.Status.ACTIVE,
        )

        return user

    @patch("main.jobs.payment_views.RazorpayService")
    def test_invalid_checkout_signature_is_rejected(
        self, mock_service_class
    ):
        mock_service = mock_service_class.return_value
        mock_service.verify_payment_signature.side_effect = (
            Exception("Invalid signature")
        )

        response = self.api_client.post(
            self.verify_url,
            self.verify_payload,
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn(
            "Payment verification failed.",
            response.data["detail"],
        )

        self.payment.refresh_from_db()
        self.assertEqual(
            self.payment.status,
            Payment.Status.PENDING,
        )

    @patch("main.jobs.payment_views.RazorpayService")
    def test_order_id_mismatch_is_rejected(
        self, mock_service_class
    ):
        mock_service = mock_service_class.return_value
        mock_service.client.payment.fetch.return_value = {
            "order_id": "order_wrong",
            "amount": 11800,
            "status": "captured",
        }

        response = self.api_client.post(
            self.verify_url,
            self.verify_payload,
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data["detail"],
            "Payment does not match the order.",
        )

        self.payment.refresh_from_db()
        self.assertEqual(
            self.payment.status,
            Payment.Status.PENDING,
        )

    @patch("main.jobs.payment_views.RazorpayService")
    def test_amount_mismatch_is_rejected(
        self, mock_service_class
    ):
        mock_service = mock_service_class.return_value
        mock_service.client.payment.fetch.return_value = {
            "order_id": self.payment.gateway_order_id,
            "amount": 99999,
            "status": "captured",
        }

        response = self.api_client.post(
            self.verify_url,
            self.verify_payload,
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data["detail"],
            "Payment amount mismatch.",
        )

        self.payment.refresh_from_db()
        self.assertEqual(
            self.payment.status,
            Payment.Status.PENDING,
        )

    @patch("main.jobs.payment_views.RazorpayService")
    def test_uncaptured_payment_is_not_marked_successful(
        self, mock_service_class
    ):
        mock_service = mock_service_class.return_value
        mock_service.client.payment.fetch.return_value = {
            "order_id": self.payment.gateway_order_id,
            "amount": 11800,
            "status": "authorized",
        }

        response = self.api_client.post(
            self.verify_url,
            self.verify_payload,
            format="json",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.data["detail"],
            "Payment has not been captured yet.",
        )

        self.payment.refresh_from_db()
        self.assertEqual(
            self.payment.status,
            Payment.Status.PENDING,
        )

    @patch("main.jobs.payment_views.RazorpayService")
    def test_razorpay_order_creation_failure_is_handled(
        self, mock_service_class
    ):
        mock_service = mock_service_class.return_value
        mock_service.create_order.side_effect = Exception(
            "Gateway internal secret details"
        )

        response = self.api_client.post(
            "/api/payments/create-order/",
            {"invoice_id": str(self.invoice.id)},
            format="json",
        )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.data["detail"],
            "Unable to create payment order. Please try again later.",
        )
        self.assertNotIn(
            "Gateway internal secret details",
            str(response.data),
        )
        self.assertFalse(
            Payment.objects.filter(
                invoice=self.invoice,
                gateway=Payment.Gateway.RAZORPAY,
                gateway_order_id="",
            ).exists()
        )
    
    @patch("main.jobs.payment_views.RazorpayService")
    def test_company_admin_can_create_payment_order(
        self, mock_service_class
    ):
        mock_service = mock_service_class.return_value
        mock_service.client.auth = (
            "rzp_test_example",
            "mock_secret",
        )

        payment = Payment.objects.create(
            invoice=self.invoice,
            amount=Decimal("118.00"),
            method=Payment.Method.ONLINE,
            status=Payment.Status.PENDING,
            gateway=Payment.Gateway.RAZORPAY,
            gateway_order_id="order_created_test",
        )

        mock_service.create_order.return_value = (
            {
                "id": "order_created_test",
                "amount": 11800,
                "currency": "INR",
            },
            payment,
        )

        response = self.api_client.post(
            "/api/payments/create-order/",
            {"invoice_id": str(self.invoice.id)},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.data["order_id"],
            "order_created_test",
        )
        self.assertEqual(response.data["amount"], 11800)
        self.assertEqual(response.data["currency"], "INR")
        self.assertEqual(
            response.data["key_id"],
            "rzp_test_example",
        )
        self.assertIn("payment_id", response.data)

        mock_service.create_order.assert_called_once_with(
            self.invoice
        )
    
    def test_already_successful_payment_is_independent(self):
        self.payment.status = Payment.Status.SUCCESS
        self.payment.gateway_payment_id = "pay_checkout_test"
        self.payment.paid_at = timezone.now()
        self.payment.save(
            update_fields=[
                "status",
                "gateway_payment_id",
                "paid_at",
                "updated_at",
            ]
        )

        response = self.api_client.post(
            self.verify_url,
            self.verify_payload,
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["detail"],
            "Payment already verified."
        )

    def test_draft_invoice_cannot_create_payment_order(self):
        self.invoice.status = Invoice.Status.DRAFT
        self.invoice.save(update_fields=["status", "updated_at"])

        response = self.api_client.post(
            "/api/payments/create-order/",
            {"invoice_id": str(self.invoice.id)},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_unauthenticated_user_cannot_verify_payment(self):
        client = APIClient()

        response = client.post(
            self.verify_url,
            self.verify_payload,
            format="json",
        )

        self.assertIn(response.status_code, (401, 403))

    def test_user_from_another_company_cannot_verify_payment(self):
        other_company = Company.objects.create(
            name="Other Test Company",
            phone="9000000001",
            email="other-company@example.com",
        )

        other_user = User.objects.create_user(
            email="other-admin@example.com",
            password="OtherTestPassword-123!",
            role="COMPANY_ADMIN",
            company=other_company,
        )

        client = APIClient()
        client.force_authenticate(user=other_user)

        reponse = client.post(
            self.verify_url,
            self.verify_payload,
            format="json",
        )

        self.assertEqual(reponse.status_code, 403)

    def test_admin_in_one_company_cannot_manage_payments_as_technician_in_another(self):
        other_company = Company.objects.create(
            name="Second Membership Company",
            phone="9000000003",
            email="second-membership@example.com",
        )

        user = User.objects.create_user(
            email="multi-company-user@example.com",
            password="MultiCompanyPassword-123!",
            role="COMPANY_ADMIN",
            company=self.company,
        )

        CompanyMembership.objects.create(
            user=user,
            company=self.company,
            role=CompanyMembership.Role.COMPANY_ADMIN,
            status=CompanyMembership.Status.ACTIVE,
        )

        CompanyMembership.objects.create(
            user=user,
            company=other_company,
            role=CompanyMembership.Role.TECHNICIAN,
            status=CompanyMembership.Status.ACTIVE,
        )

        # Keep the invoice in the second company.
        other_customer = Customer.objects.create(
            company=other_company,
            name="Second Company Customer",
            email="second-customer@example.com",
        )
        other_address = CustomerAddress.objects.create(
            customer=other_customer,
            label="Test Address",
            address_line_1="456 Test Street",
            city="Pune",
            state="Maharashtra",
            postal_code="411002",
            country="India",
            is_primary=True,
        )
        other_job = ServiceJob.objects.create(
            company=other_company,
            customer=other_customer,
            service_address=other_address,
            title="Second Company Job",
        )
        other_invoice = Invoice.objects.create(
            company=other_company,
            customer=other_customer,
            job=other_job,
            invoice_number="INV-MULTI-COMPANY-TEST",
            status=Invoice.Status.ISSUED,
            subtotal=Decimal("100.00"),
            tax_amount=Decimal("18.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("118.00"),
        )

        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            "/api/payments/create-order/",
            {"invoice_id": str(other_invoice.id)},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_unauthenticated_user_cannot_create_payment_order(self):
        client = APIClient()

        response = client.post(
            "/api/payments/create-order/",
            {"invoice_id": str(self.invoice)},
            format="json",
        )

        self.assertIn(response.status_code, (401, 403))

    def test_user_from_another_company_cannot_create_payment_order(self):
        other_company = Company.objects.create(
            name="Other Order Test Company",
            phone="9000000002",
            email="other-order-company@example.com",
        )

        other_user = User.objects.create_user(
            email="other-order-admin@example.com",
            password="OtherOrderTestPassword-123!",
            role="COMPANY_ADMIN",
            company=other_company,
        )

        client = APIClient()
        client.force_authenticate(user=other_user)

        response = client.post(
            "/api/payments/create-order.",
            {"invoice_id": str(self.invoice.id)},
            format="json",
        )

        self.assertIn(response.status_code, (403, 404))

    def test_technician_cannot_create_payment_order(self):
        technician = User.objects.create_user(
            email="order-technician@example.com",
            password="OrderTechnicianPassword-123!",
            role="TECHNICIAN",
            company=self.company,
        )

        client = APIClient()
        client.force_authenticate(user=technician)

        response = client.post(
            "/api/payments/create-order/",
            {"invoice_id": str(self.invoice.id)},
            format="json",
        )

        self.assertEqual(response.status_code, 403)


class RazorpayServiceTests(RazorpayWebhookTests):
    @patch("main.jobs.services.razorpay_service.razorpay.Client")
    def test_order_creation_failure_does_not_create_payment_record(
        self, mock_client_class
    ):
        mock_client = mock_client_class.return_value
        mock_client.order.create.side_effect = Exception(
            "Simulated Razorpay outage"
        )

        self.payment.delete()

        service = RazorpayService()

        payment_count_before = Payment.objects.filter(
            invoice=self.invoice,
            gateway=Payment.Gateway.RAZORPAY,
        ).count()

        with self.assertRaisesRegex(
            Exception, "Simulated Razorpay outage"
        ):
            service.create_order(self.invoice)

        payment_count_after = Payment.objects.filter(
            invoice=self.invoice,
            gateway=Payment.Gateway.RAZORPAY,
        ).count()

        self.assertEqual(
            payment_count_after,
            payment_count_before,
        )
        mock_client.order.create.assert_called_once()

    @patch("main.jobs.services.razorpay_service.razorpay.Client")
    def test_existing_pending_order_is_reused(
        self, mock_client_class
    ):
        mock_client = mock_client_class.return_value
        mock_client.order.fetch.return_value = {
            "id": self.payment.gateway_order_id,
            "amount": 11800,
            "currency": "INR",
        }

        service = RazorpayService()

        order, payment = service.create_order(self.invoice)

        self.assertEqual(
            order["id"],
            self.payment.gateway_order_id,
        )
        self.assertEqual(payment.id, self.payment.id)

        mock_client.order.fetch.assert_called_once_with(
            self.payment.gateway_order_id
        )
        mock_client.order.create.assert_not_called()

    @patch("main.jobs.services.razorpay_service.razorpay.Client")
    def test_unfetchable_pending_order_remains_pending(
        self, mock_client_class
    ):
        mock_client = mock_client_class.return_value
        mock_client.order.fetch.side_effect = Exception(
            "Temporary gateway failure"
        )

        service = RazorpayService()

        with self.assertRaisesRegex(
            Exception, "Temporary gateway failure"
        ):
            service.create_order(self.invoice)

        self.payment.refresh_from_db()

        self.assertEqual(
            self.payment.status,
            Payment.Status.PENDING,
        )
        mock_client.order.create.assert_not_called()

@skipUnless(
    connection.vendor == "postgresql",
    "This concurrency test required PostgreSQL."
)
class RazorpayOrderConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.company = Company.objects.create(
            name="Concurrency Test Company",
            phone="9000000001",
            email="concurrency-company@example.com"
        )

        self.customer = Customer.objects.create(
            company=self.company,
            name="Concurrency Test Customer",
            email="concurrency-customer@example.com"
        )

        self.address = CustomerAddress.objects.create(
            customer=self.customer,
            label="Test Address",
            address_line_1="123 Test Street",
            city="Pune",
            state="Maharashtra",
            postal_code="411001",
            country="India",
            is_primary=True,
        )

        self.job = ServiceJob.objects.create(
            company=self.company,
            customer=self.customer,
            service_address=self.address,
            title="Concurrency Test Job",
        )

        self.invoice = Invoice.objects.create(
            company=self.company,
            customer=self.customer,
            job=self.job,
            invoice_number="INV-CONCURRENCY-TEST",
            status=Invoice.Status.ISSUED,
            subtotal=Decimal("100.00"),
            tax_amount=Decimal("18.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("118.00"),
        )

    @patch("main.jobs.services.razorpay_service.razorpay.Client")
    def test_concurrent_requests_reuse_one_pending_order(
        self, mock_client_class
    ):
        mock_client = mock_client_class.return_value
        mock_client.order.create.return_value = {
            "id": "order_concurrent_test",
            "amount": 11800,
            "currency": "INR",
        }
        mock_client.order.fetch.return_value = {
            "id": "order_concurrent_test",
            "amount": 11800,
            "currency": "INR",
        }

        barrier = Barrier(2)
        invoice_id = self.invoice.pk

        def create_order():
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                invoice = Invoice.objects.get(pk=invoice_id)
                service = RazorpayService()
                order, payment = service.create_order(invoice)
                return order["id"], str(payment.pk)
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [
                executor.submit(create_order),
                executor.submit(create_order),
            ]
            results = [future.result(timeout=30) for future in futures]

        self.assertEqual(
            results[0][0],
            results[1][0],
        )
        self.assertEqual(
            Payment.objects.filter(
                invoice=self.invoice,
                gateway=Payment.Gateway.RAZORPAY,
                status=Payment.Status.PENDING,
            ).count(),
            1,
        )
        mock_client.order.create.assert_called_once()
