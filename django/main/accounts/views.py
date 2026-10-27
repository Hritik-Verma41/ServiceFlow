from django.db import IntegrityError, transaction
from django.db.models.functions import Lower
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from main.companies.models import Company
from .models import CompanyMembership, Invitation, User
from .permissions import IsCompanyAdminOrManager
from .serializers import InvitationAcceptSerializer, InvitationCreateSerializer
from .services import (
    InvitationAcceptanceError,
    InvalidInvitationError,
    accept_invitation,
    create_invitation,
    get_valid_invitation,
)


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

        try:
            with transaction.atomic():
                invitation, raw_token = create_invitation(
                    company=company,
                    email=email,
                    role=role,
                    invited_by=request.user,
                )
        except IntegrityError:
            # A concurrent request may have created the same pending invitation.
            duplicate_exists = Invitation.objects.filter(
                company=company,
                status=Invitation.Status.PENDING,
            ).annotate(
                normalized_email=Lower("email"),
            ).filter(
                normalized_email=email.lower(),
            ).exists()

            if duplicate_exists:
                return Response(
                    {"detail": "A pending invitation already exists for this email."},
                    status=status.HTTP_409_CONFLICT,
                )

            raise

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


class InvitationAcceptView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = InvitationAcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = serializer.validated_data["token"]

        try:
            invitation = get_valid_invitation(token)

            # Existing accounts must authenticate and match the invite email.
            existing_user = User.objects.filter(
                email__iexact=invitation.email
            ).first()

            if existing_user is not None:
                if not request.user.is_authenticated:
                    return Response(
                        {
                            "detail": (
                                "Authenticate with the invited account "
                                "before accepting the invitation."
                            )
                        },
                        status=status.HTTP_401_UNAUTHORIZED,
                    )
                if request.user.pk != existing_user.pk:
                    return Response(
                        {"detail": "This invitation belongs to a different account."},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                if not existing_user.is_active:
                    return Response(
                        {
                            "detail": (
                                "This account is inactive. Contact an administrator."
                            )
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )

            user, membership = accept_invitation(
                token=token,
                password=serializer.validated_data.get("password"),
                first_name=serializer.validated_data.get("first_name", ""),
                last_name=serializer.validated_data.get("last_name", ""),
            )
        except InvalidInvitationError:
            return Response(
                {"detail": "Invalid or unavailable invitation."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except InvitationAcceptanceError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {
                "detail": "Invitation accepted successfully.",
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                },
                "membership": {
                    "company_id": str(membership.company_id),
                    "role": membership.role,
                    "status": membership.status,
                },
            },
            status=status.HTTP_200_OK,
        )
