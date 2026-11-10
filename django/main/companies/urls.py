from django.urls import path

from .views import (
    CompanyCustomerAddressDetailView,
    CompanyCustomerAddressListCreateView,
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
    path(
        "companies/<uuid:company_id>/customers/<uuid:customer_id>/addresses/",
        CompanyCustomerAddressListCreateView.as_view(),
        name="company-customer-address-list-create",
    ),
    path(
        "companies/<uuid:company_id>/customers/<uuid:customer_id>/addresses/<uuid:address_id>/",
        CompanyCustomerAddressDetailView.as_view(),
        name="company-customer-address-detail",
    ),
]

