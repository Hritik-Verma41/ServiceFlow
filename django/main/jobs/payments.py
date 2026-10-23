from rest_framework import serializers

from main.jobs.models import Invoice

class CreatePaymentOrderSerializer(serializers.Serializer):
    invoice_id = serializers.UUIDField()

    def validate_invoice_id(self, value):
        try:
            invoice = Invoice.objects.get(id=value)
        except Invoice.DoesNotExist:
            raise serializers.ValidationError(
                "Invoice not found."
            )

        if invoice.status == Invoice.Status.CANCELLED:
            raise serializers.ValidationError(
                "Cannot pay a cancelled invoice."
            )

        if invoice.balance_due <= 0:
            raise serializers.ValidationError(
                "Invoice has no outstanding balance."
            )

        self.invoice = invoice

        return value

class VerifyRazorpayPaymentSerializer(serializers.Serializer):
    payment_id = serializers.UUIDField()

    razorpay_order_id = serializers.CharField(
        max_length=150
    )

    razorpay_payment_id = serializers.CharField(
        max_length=150
    )

    razorpay_signature = serializers.CharField(
        max_length=255
    )
