from django.urls import path

from .views import CompanyInvitationCreateView, CompanyMemberListView, InvitationAcceptView


urlpatterns = [
    path(
        "accounts/companies/<uuid:company_id>/invitations/",
        CompanyInvitationCreateView.as_view(),
        name="company-invitation-create",
    ),
    path(
        "companies/<uuid:company_id>/members/",
        CompanyMemberListView.as_view(),
        name="company-member-list",
    ),
    path(
        "accounts/invitations/accept/",
        InvitationAcceptView.as_view(),
        name="invitation-accept",
    ),
]
