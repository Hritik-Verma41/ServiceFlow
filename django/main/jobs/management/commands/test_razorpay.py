from django.core.management.base import BaseCommand
from django.db.models import Q

from main.jobs.models import Invoice
from main.jobs.services.razorpay_service import RazorpayService

class Command(BaseCommand):
    help = "Test Razorpay Test Mode order creation"

    def handle(self, *args, **options):

        invoice = (
            Invoice.objects
            .filter(
                Q(status=Invoice.Status.ISSUED)
                | Q(status=Invoice.Status.PARTIALLY_PAID)
            )
            .first()
        )

        if not invoice:
            self.stdout.write(
                self.style.ERROR(
                    "No payable invoice found."
                )
            )
            return

        self.stdout.write(
            f"Invoice: {invoice.invoice_number}"
        )

        self.stdout.write(
            f"Total:  ₹{invoice.total_amount}"
        )

        self.stdout.write(
            f"Paid:  ₹{invoice.paid_amount}"
        )

        self.stdout.write(
            f"Balance:  ₹{invoice.balance_due}"
        )

        try:
            service = RazorpayService()

            order, payment = service.create_order(invoice)

            self.stdout.write(
                self.style.SUCCESS(
                    "Razorpay order created successfully!"
                )
            )

            self.stdout.write(
                f"Payment ID: {payment.id}"
            )

            self.stdout.write(
                f"Order ID: {order['id']}"
            )

            self.stdout.write(
                f"Amount: {order['amount']}"
            )

            self.stdout.write(
                f"Currency: {order['currency']}"
            )

        except Exception as error:
            self.stdout.write(
                self.style.ERROR(
                    f"Razorypay error: {error}"
                )
            )
