from django.urls import path

from .views import (
    CompanyCustomerDetailView,
    CompanyCustomerListCreateView,
)


urlpatterns = [
    path(
        "companies/<uuid:company_id>/customers/",
        CompanyCustomerListCreateView.as_view(),
        name="company-customer-list-create"
    ),
    path(
        "companies/<uuid:company_id>/customers/<uuid:customer_id>/",
        CompanyCustomerDetailView.as_view(),
        name="company-customer-detail"
    ),
]

