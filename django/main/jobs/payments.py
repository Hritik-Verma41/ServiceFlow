from rest_framework import serializers

from main.jobs.models import Invoice

class CreatePaymentOrderSerializer(serializers.Serializer):
    invoice_id = serializers.UUIDField()

    def validate_invoice_id(self, value):
        try:
            invoice = Invoice.objects.get(id=value)
        except Invoice.DoesNotExist:
            raise serializers.ValidationError("Invoice not found.")

        payable_statuses = {
            Invoice.Status.ISSUED,
            Invoice.Status.PARTIALLY_PAID,
        }

        if invoice.status not in payable_statuses:
            raise serializers.ValidationError(
                "Only issued or partially paid invoices can be paid."
            )

        if invoice.balance_due <= 0:
            raise serializers.ValidationError(
                "Invoice has no outstanding balance."
            )

        return invoice

    def validate(self, attrs):
        attrs["invoice"] = attrs.pop("invoice_id")
        return attrs


class VerifyRazorpayPaymentSerializer(serializers.Serializer):
    payment_id = serializers.UUIDField()
    razorpay_order_id = serializers.CharField(max_length=150)
    razorpay_payment_id = serializers.CharField(max_length=150)
    razorpay_signature = serializers.CharField(max_length=255)
