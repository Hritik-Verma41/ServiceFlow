from django.urls import path

from .views import (
    CurrentUserProfileView,
    CompanyInvitationCreateView,
    CompanyInvitationListView,
    CompanyInvitationResendView,
    CompanyInvitationRevokeView,
    CompanyMemberListView,
    CompanyMemberRoleUpdateView,
    CompanyMemberStatusUpdateView,
    InvitationAcceptView
)


urlpatterns = [
    path(
        "accounts/me/",
        CurrentUserProfileView.as_view(),
        name="current-user-profile",
    ),
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
        "companies/<uuid:company_id>/invitations/",
        CompanyInvitationListView.as_view(),
        name="company-invitation-list",
    ),
    path(
        "companies/<uuid:company_id>/invitations/<uuid:invitation_id>/",
        CompanyInvitationRevokeView.as_view(),
        name="company-invitation-revoke",
    ),
    path(
        "companies/<uuid:company_id>/invitations/<uuid:invitation_id>/resend/",
        CompanyInvitationResendView.as_view(),
        name="company-invitation-resend",
    ),
    path(
        "companies/<uuid:company_id>/members/<uuid:membership_id>/role/",
        CompanyMemberRoleUpdateView.as_view(),
        name="company-member-role-update",
    ),
    path(
        "companies/<uuid:company_id>/members/<uuid:membership_id>/status/",
        CompanyMemberStatusUpdateView.as_view(),
        name="company-member-status-update",
    ),
    path(
        "accounts/invitations/accept/",
        InvitationAcceptView.as_view(),
        name="invitation-accept",
    ),
]
