import hashlib
import hmac
import json
import logging

from decimal import Decimal

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from main.accounts.models import CompanyMembership
from main.jobs.models import Invoice, Payment
from main.jobs.payments import CreatePaymentOrderSerializer, VerifyRazorpayPaymentSerializer
from main.jobs.services.razorpay_service import RazorpayService

logger = logging.getLogger(__name__)

def ensure_invoice_payment_access(user, invoice):
    # Superusers can manage payemnts for support purposes.
    if user.is_superuser:
        return

    allowed_roles = {
        CompanyMembership.Role.COMPANY_ADMIN,
        CompanyMembership.Role.MANAGER,
    }

    has_permission = CompanyMembership.objects.filter(
        user=user,
        company_id=invoice.company_id,
        status=CompanyMembership.Status.ACTIVE,
        role__in=allowed_roles,
    ).exists()

    if not has_permission:
        raise PermissionDenied(
            "You are not authorized to manage payments for this company."
        )

class CreatePaymentOrderView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CreatePaymentOrderSerializer(
            data=request.data
        )

        serializer.is_valid(raise_exception=True)

        invoice = serializer.validated_data["invoice"]

        ensure_invoice_payment_access(
            request.user,
            invoice,
        )

        try:
            service = RazorpayService()

            razorpay_order, payment = (
                service.create_order(invoice)
            )

            return Response(
                {
                    "payment_id": str(payment.id),
                    "order_id": razorpay_order["id"],
                    "amount": razorpay_order["amount"],
                    "currency": razorpay_order["currency"],
                    "key_id": service.client.auth[0],
                },
                status=status.HTTP_201_CREATED,
            )

        
        except Exception:
            logger.exception(
                "Failed to create Razorpay order for invoice %s",
                invoice.id,
            )
            return Response(
                {
                    "detail": (
                        "Unable to create payment order. "
                        "Please try again later."
                    ),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class VerifyRazorpayPaymentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = VerifyRazorpayPaymentSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        payment = (
            Payment.objects
            .select_related("invoice")
            .filter(
                id=data["payment_id"],
                gateway=Payment.Gateway.RAZORPAY,
            )
            .first()
        )

        if payment is None:
            return Response(
                {"detail": "Payment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check the user's role and company
        ensure_invoice_payment_access(
            request.user,
            payment.invoice,
        )

        # The submitted order must match our database
        if (
            payment.gateway_order_id
            != data["razorpay_order_id"]
        ):
            return Response(
                {"detail": "Order ID mismatch."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Make repeated successful verification requests safe.
        if payment.status == Payment.Status.SUCCESS:
            return Response({
                "detail": "Payment already verified.",
                "payment_id": str(payment.id),
                "status": payment.status,
                "invoice_status": payment.invoice.status,
                "balance_due": str(payment.invoice.balance_due),
            })

        service = RazorpayService()

        try:
            # Verify using the order ID stored by our backend.
            service.verify_payment_signature(
                payment.gateway_order_id,
                data["razorpay_payment_id"],
                data["razorpay_signature"],
            )

            # Fetch payment details directly from Razorpay.
            gateway_payment = service.client.payment.fetch(
                data["razorpay_payment_id"]
            )

        except Exception:
            return Response(
                {
                    "detail": (
                        "Payment verification failed. "
                        "The signature or payment details "
                        "could not be verified."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Confirm that Razorpay associates this payment
        # with the order stored in ServiceFlow.
        if (
            gateway_payment.get("order_id")
            != payment.gateway_order_id
        ):
            return Response(
                {"detail": "Payment does not match the order."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        expected_amount = int(
            payment.amount * Decimal("100")
        )

        if gateway_payment.get("amount") != expected_amount:
            return Response(
                {"detail": "Payment amount mismatch."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Do not mark an authorized or failed payment as paid.
        if gateway_payment.get("status") != "captured":
            return Response(
                {
                    "detail": (
                        "Payment has not been captured yet."
                    ),
                    "gateway_status": gateway_payment.get("status"),
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Lock and recheck the database row before updating it.
        with transaction.atomic():
            locked_payment = (
                Payment.objects
                .select_for_update()
                .select_related("invoice")
                .filter(pk=payment.pk)
                .first()
            )

            if locked_payment is None:
                return Response(
                    {"detail": "Payment not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # The webhook or another request may have completed it
            # while we were communicating with Razorpay.
            if locked_payment.status == Payment.Status.SUCCESS:
                return Response({
                    "detail": "Payment already verified.",
                    "payment_id": str(locked_payment.id),
                    "status": locked_payment.status,
                    "invoice_status": locked_payment.invoice.status,
                    "balance_due": str(locked_payment.invoice.balance_due),
                })

            if locked_payment.status != Payment.Status.PENDING:
                return Response(
                    {"detail": "This payment is no longer pending."},
                    status=status.HTTP_409_CONFLICT,
                )

            # Recheck the order after acquiring the lock.
            if locked_payment.gateway_order_id != gateway_payment.get("order_id"):
                return Response(
                    {"detail": "Payment order changed."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            locked_payment.status = Payment.Status.SUCCESS
            locked_payment.gateway_payment_id = (
                data["razorpay_payment_id"]
            )
            locked_payment.gateway_signature = (
                data["razorpay_signature"]
            )
            locked_payment.paid_at = timezone.now()

            locked_payment.save(
                update_fields=[
                    "status",
                    "gateway_payment_id",
                    "gateway_signature",
                    "paid_at",
                    "updated_at",
                ]
            )

            locked_payment.invoice.update_payment_status()
        
        return Response({
            "detail": "Payment verified successfully.",
            "payment_id": str(locked_payment.id),
            "status": locked_payment.status,
            "invoice_status": locked_payment.invoice.status,
            "balance_due": str(locked_payment.invoice.balance_due),
        })

@login_required
def razorpay_checkout_page(request, invoice_id):
    invoice = get_object_or_404(
        Invoice,
        id=invoice_id,
    )

    try:
        ensure_invoice_payment_access(
            request.user,
            invoice,
        )
    except PermissionDenied:
        return JsonResponse(
            {"detail": "You are not authorized to access this invoice."},
            status=403,
        )

    if (
        invoice.status == Invoice.Status.CANCELLED
        or invoice.balance_due <= 0
    ):
        return render(
            request,
            "jobs/checkout.html",
            {
                "invoice": invoice,
                "error": "This invoice cannot be paid."
            },
            status=400,
        )

    return render(
        request,
        "jobs/checkout.html",
        {
            "invoice": invoice,
        },
    )

@csrf_exempt
@require_POST
def razorpay_webhook(request):
    webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET


    if not webhook_secret:
        return JsonResponse(
            {"detail": "Webhook secret is not configured."},
            status=500,
        )

    # Verify the exact raw request body.
    signature = request.headers.get(
        "X-Razorpay-Signature",
        "",
    )

    expected_signature = hmac.new(
        webhook_secret.encode("utf-8"),
        request.body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(
        expected_signature,
        signature,
    ):
        return JsonResponse(
            {"detail": "Invalid webhook signature."},
            status=400,
        )

    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse(
            {"detail": "Invalid JSON payload."},
            status=400,
        )

    event = payload.get("event")

    # This handler processes captured payments only.
    if event != "payment.captured":
        return JsonResponse({"status": "ignored"})

    entity = (
        payload.get("payload", {})
        .get("payment", {})
        .get("entity", {})
    )

    order_id = entity.get("order_id")
    gateway_payment_id = entity.get("id")
    amount = entity.get("amount")

    if not order_id or not gateway_payment_id or amount is None:
        return JsonResponse(
            {"detail": "Incomplete payment event."},
            status=400,
        )

    with transaction.atomic():
        payment = (
            Payment.objects
            .select_for_update()
            .select_related("invoice")
            .filter(
                gateway=Payment.Gateway.RAZORPAY,
                gateway_order_id=order_id,
            )
            .first()
        )

        if payment is None:
            return JsonResponse(
                {"detail": "Payment order not found."},
                status=404,
            )

        if not isinstance(amount, int) or isinstance(amount, bool):
            return JsonResponse(
                {"detail": "Invalid payment amount."},
                status=400,
            )

        expected_amount = int(
            payment.amount * Decimal(100)
        )

        if amount != expected_amount:
            return JsonResponse(
                {"detail": "Payment amount mismatch."},
                status=400,
            )

        # Duplicate webhook deliveries must be safe.
        if payment.status == Payment.Status.SUCCESS:
            if payment.gateway_payment_id == gateway_payment_id:
                return JsonResponse({
                    "status": "already_processed"
                })

            return JsonResponse(
                {
                    "detail": (
                        "Payment order is already associated "
                        "with a different successful payment."
                    )
                },
                status=409,
            )

        payment.status = Payment.Status.SUCCESS
        payment.gateway_payment_id = gateway_payment_id
        payment.paid_at = timezone.now()
        payment.save(
            update_fields=[
                "status",
                "gateway_payment_id",
                "paid_at",
                "updated_at",
            ]
        )

        payment.invoice.update_payment_status()

    return JsonResponse({"status": "processed"})
