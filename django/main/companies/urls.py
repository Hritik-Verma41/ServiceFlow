from django.urls import path

from .views import CompanyCustomerListCreateView


urlpatterns = [
    path(
        "companies/<uuid:company_id>/customers/",
        CompanyCustomerListCreateView.as_view(),
        name="company-customer-list-create"
    ),
]

