from django.urls import path

from .views import CompanyInvitationCreateView, InvitationAcceptView


urlpatterns = [
    path(
        "accounts/companies/<uuid:company_id>/invitations/",
        CompanyInvitationCreateView.as_view(),
        name="company-invitation-create",
    ),
    path(
        "accounts/invitations/accept/",
        InvitationAcceptView.as_view(),
        name="invitation-accept",
    ),
]
