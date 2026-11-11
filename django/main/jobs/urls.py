from django.urls import path

from main.jobs.payment_views import (
    CreatePaymentOrderView,
    VerifyRazorpayPaymentView,
    razorpay_checkout_page,
    razorpay_webhook,
)
from main.jobs.views import (
    CompanyServiceJobDetailView,
    CompanyServiceJobListCreateView,
    CompanyServiceJobStatusView,
    CompanyServiceJobNoteListCreateView,
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
    ),
    path(
        "companies/<uuid:company_id>/jobs/",
        CompanyServiceJobListCreateView.as_view(),
        name="company-service-job-list-create",
    ),
    path(
        "companies/<uuid:company_id>/jobs/<uuid:job_id>/",
        CompanyServiceJobDetailView.as_view(),
        name="company-service-job-detail",
    ),
    path(
        "companies/<uuid:company_id>/jobs/<uuid:job_id>/status/",
        CompanyServiceJobStatusView.as_view(),
        name="company-service-job-status",
    ),
    path(
        "companies/<uuid:company_id>/jobs/<uuid:job_id>/notes/",
        CompanyServiceJobNoteListCreateView.as_view(),
        name="company-service-job-note-list-create",
    ),
]
