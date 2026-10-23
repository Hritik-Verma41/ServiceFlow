
import hashlib
import hmac
import json
from decimal import Decimal
from unittest.mock import patch

from django.conf import settings
from django.test import TestCase, Client
from django.utils import timezone

from main.companies.models import (
    Company,
    Customer,
    CustomerAddress,
)
from main.jobs.models import Invoice, Payment, ServiceJob


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
