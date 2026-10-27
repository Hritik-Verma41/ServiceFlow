from django.urls import path

from .views import CompanyInvitationCreateView


urlpatterns = [
    path(
        "accounts/companies/<uuid:company_id>/invitations/",
        CompanyInvitationCreateView.as_view(),
        name="company-invitation-create",
    ),
]
