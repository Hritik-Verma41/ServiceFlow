from rest_framework.permissions import BasePermission

from .models import CompanyMembership


class IsActiveCompanyMember(BasePermission):
    """
    Require an active membership in the company identified by
    the view's `get_company()` method.
    """

    message = "You do not have an active membership in this company."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        get_company = getattr(view, "get_company", None)
        if get_company is None:
            return False

        company = get_company()
        if company is None:
            return False

        return CompanyMembership.objects.filter(
            user=user,
            company=company,
            status=CompanyMembership.Status.ACTIVE,
        ).exists()

class IsCompanyAdminOrManager(IsActiveCompanyMember):
    """
    Require an active company membership with an administrative role.
    """

    message = "Only company admins and managers can perform this action."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        if not super().has_permission(request, view):
            return False

        company = view.get_company()

        return CompanyMembership.objects.filter(
            user=user,
            company=company,
            status=CompanyMembership.Status.ACTIVE,
            role__in=[
                CompanyMembership.Role.COMPANY_ADMIN,
                CompanyMembership.Role.MANAGER,
            ],
        ).exists()
