from django.urls import path

from main.jobs.payment_views import (
    CreatePaymentOrderView,
    VerifyRazorpayPaymentView,
    razorpay_checkout_page,
    razorpay_webhook,
)


urlpatterns = [
    path(
        "payments/create-order/",
        CreatePaymentOrderView.as_view(),
        name="create-payment-order",
    ),
    path(
        "payments/verify/",
        VerifyRazorpayPaymentView.as_view(),
        name="verify-razorpay-payment",
    ),
    path(
        "payments/checkout/<uuid:invoice_id>/",
        razorpay_checkout_page,
        name="razorpay-checkout",
    ),
    path(
        "payments/webhook/",
        razorpay_webhook,
        name="razorpay-webhook",
    )
]
