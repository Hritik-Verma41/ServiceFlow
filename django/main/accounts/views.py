from django.db.models.functions import Lower
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from main.companies.models import Company
from .models import CompanyMembership, Invitation
from .permissions import IsCompanyAdminOrManager
from .services import create_invitation
from .serializers import InvitationCreateSerializer


class CompanyInvitationCreateView(APIView):
    permission_classes = [IsAuthenticated, IsCompanyAdminOrManager]

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

    def post(self, request, company_id):
        # Resolve the company from the URL, then verify membership.
        company = self.get_company()

        # Permission classes call get_company() without arguments.
        self.kwargs["company_id"] = company_id

        membership = CompanyMembership.objects.filter(
            user=request.user,
            company=company,
            status=CompanyMembership.Status.ACTIVE,
        ).first()

        if not request.user.is_superuser and membership is None:
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if (
            not request.user.is_superuser
            and membership.role == CompanyMembership.Role.MANAGER
        ):
            # Managers cannot invite company admins.
            requested_role = request.data.get("role")
            if requested_role == Invitation.Role.COMPANY_ADMIN:
                return Response(
                    {"detail": "Managers cannot invite company admins."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        serializer = InvitationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        role = serializer.validated_data["role"]

        if not isinstance(email, str) or not email.strip():
            return Response(
                {"email": "A valid email address is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if role not in Invitation.Role.values:
            return Response(
                {"role": "A valid invitation role is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pending_exists = Invitation.objects.filter(
            company=company,
            status=Invitation.Status.PENDING,
        ).annotate(
            normalized_email=Lower("email"),
        ).filter(
            normalized_email=email.lower(),
        ).exists()

        if pending_exists:
            return Response(
                {"detail": "A pending invitation already exists for this email."},
                status=status.HTTP_409_CONFLICT,
            )

        invitation, raw_token = create_invitation(
            company=company,
            email=email,
            role=role,
            invited_by=request.user,
        )

        return Response(
            {
                "id": str(invitation.id),
                "company_id": str(company.id),
                "email": invitation.email,
                "role": invitation.role,
                "status": invitation.status,
                "expires_at": invitation.expires_at,
                "token": raw_token,
            },
            status=status.HTTP_201_CREATED,
        )
