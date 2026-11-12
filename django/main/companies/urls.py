from django.urls import path

from .views import (
    CompanyDetailView,
    CompanyListCreateView,
    CompanyCustomerAddressDetailView,
    CompanyCustomerAddressListCreateView,
    CompanyCustomerDetailView,
    CompanyCustomerListCreateView,
)


urlpatterns = [
    path(
        "companies/",
        CompanyListCreateView.as_view(),
        name="company-create",
    ),
    path(
        "companies/<uuid:company_id>/",
        CompanyDetailView.as_view(),
        name="company-detail",
    ),
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

