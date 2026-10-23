from decimal import Decimal

import razorpay
from django.conf import settings
from django.db import transaction

from main.jobs.models import Invoice, Payment


class RazorpayService:

    def __init__(self):
        self.client = razorpay.Client(
            auth=(
                settings.RAZORPAY_KEY_ID,
                settings.RAZORPAY_KEY_SECRET,
            )
        )

    def create_order(self, invoice):
        with transaction.atomic():
            locked_invoice = (
                Invoice.objects
                .select_for_update()
                .get(pk=invoice.pk)
            )
            
            amount = locked_invoice.balance_due

            if amount <= Decimal("0.00"):
                raise ValueError(
                    "Invoice has no outstanding balance."
                )

            existing_payment = (
                Payment.objects
                .filter(
                    invoice=locked_invoice,
                    gateway=Payment.Gateway.RAZORPAY,
                    status=Payment.Status.PENDING,
                    gateway_order_id__isnull=False,
                )
                .exclude(gateway_order_id="")
                .order_by("-created_at")
                .first()
            )

            if existing_payment:
                existing_order = self.client.order.fetch(
                    existing_payment.gateway_order_id
                )
                return existing_order, existing_payment

            amount_in_paise = int(
                amount * Decimal("100")
            )

            order_data = {
                "amount": amount_in_paise,
                "currency": "INR",
                "receipt": str(locked_invoice.id),
                "notes": {
                    "invoice_number": locked_invoice.invoice_number,
                },
            }

            razorpay_order = self.client.order.create(order_data)

            payment = Payment.objects.create(
                invoice=locked_invoice,
                amount=amount,
                method=Payment.Method.ONLINE,
                status=Payment.Status.PENDING,
                gateway=Payment.Gateway.RAZORPAY,
                gateway_order_id=razorpay_order["id"],
            )

            return razorpay_order, payment

    def verify_payment_signature(
        self,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
    ):
        self.client.utility.verify_payment_signature(
            {
                "razorpay_order_id": razorpay_order_id,
                "razorpay_payment_id": razorpay_payment_id,
                "razorpay_signature": razorpay_signature,
            }
        )

        return True