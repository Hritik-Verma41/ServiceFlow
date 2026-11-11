from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from main.accounts.models import CompanyMembership
from main.accounts.permissions import (
    IsActiveCompanyMember,
    IsCompanyAdminOrManager,
)
from main.companies.models import Company

from .models import ServiceJob
from .serializers import ServiceJobSerializer


class CompanyServiceJobListCreateView(generics.ListCreateAPIView):
    serializer_class = ServiceJobSerializer
    permission_classes = [IsAuthenticated, IsActiveCompanyMember]

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

    def get_permissions(self):
        if self.request.method == "POST":
            permission_classes = [
                IsAuthenticated,
                IsCompanyAdminOrManager,
            ]
        else:
            permission_classes = self.permission_classes

        return [permission() for permission in permission_classes]

    def get_queryset(self):
        company = self.get_company()

        queryset = ServiceJob.objects.filter(
            company=company,
        ).select_related(
            "customer",
            "service_address",
            "assigned_technician",
        )

        if self.request.user.is_superuser:
            return queryset.order_by("-created_at")

        membership = CompanyMembership.objects.filter(
            user=self.request.user,
            company=company,
            status=CompanyMembership.Status.ACTIVE,
        ).first()

        if membership.role == CompanyMembership.Role.TECHNICIAN:
            queryset = queryset.filter(
                assigned_technician=self.request.user,
            )

        return queryset.order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(company=self.get_company())


class CompanyServiceJobDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = ServiceJobSerializer
    permission_classes = [IsAuthenticated, IsActiveCompanyMember]
    lookup_url_kwarg = "job_id"

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

    def get_permissions(self):
        if self.request.method in ["PUT", "PATCH"]:
            permission_classes = [
                IsAuthenticated,
                IsCompanyAdminOrManager,
            ]
        else:
            permission_classes = self.permission_classes

        return [permission() for permission in permission_classes]

    def get_queryset(self):
        company = self.get_company()

        queryset = ServiceJob.objects.filter(
            company=company,
        ).select_related(
            "customer",
            "service_address",
            "assigned_technician",
        )

        if self.request.user.is_superuser:
            return queryset

        membership = CompanyMembership.objects.filter(
            user=self.request.user,
            company=company,
            status=CompanyMembership.Status.ACTIVE,
        ).first()

        if membership.role == CompanyMembership.Role.TECHNICIAN:
            queryset = queryset.filter(
                assigned_technician=self.request.user,
            )

        return queryset

class CompanyServiceJobStatusView(APIView):
    permission_classes = [IsAuthenticated, IsActiveCompanyMember]

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

    def post(self, request, *args, **kwargs):
        company = self.get_company()

        membership = None

        if not request.user.is_superuser:
            membership = get_object_or_404(
                CompanyMembership,
                user=request.user,
                company=company,
                status=CompanyMembership.Status.ACTIVE,
            )

        target_status = request.data.get("status")

        if target_status not in ServiceJob.Status.values:
            return Response(
                {"status": "A valid status is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        job_queryset = ServiceJob.objects.filter(company=company)
        if (
            not request.user.is_superuser
            and membership.role == CompanyMembership.Role.TECHNICIAN
        ):
            job_queryset = job_queryset.filter(
                assigned_technician=request.user,
            )

        job = get_object_or_404(
            job_queryset,
            id=self.kwargs["job_id"],
        )

        allowed_transitions = {
            ServiceJob.Status.NEW: {
                ServiceJob.Status.SCHEDULED,
                ServiceJob.Status.CANCELLED,
            },
            ServiceJob.Status.SCHEDULED: {
                ServiceJob.Status.IN_PROGRESS,
                ServiceJob.Status.CANCELLED,
            },
            ServiceJob.Status.IN_PROGRESS: {
                ServiceJob.Status.COMPLETED,
            },
        }

        if target_status not in allowed_transitions.get(job.status, set()):
            return Response(
                {
                    "detail": (
                        f"Cannot change job status from "
                        f"{job.status} to {target_status}."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if request.user.is_superuser:
            is_admin_or_manager = True
            is_technician = False
        else:
            is_admin_or_manager = membership.role in [
                CompanyMembership.Role.COMPANY_ADMIN,
                CompanyMembership.Role.MANAGER,
            ]
            is_technician = (
                membership.role == CompanyMembership.Role.TECHNICIAN
            )

        if target_status in [
            ServiceJob.Status.SCHEDULED,
            ServiceJob.Status.CANCELLED,
        ]:
            if not is_admin_or_manager:
                return Response(
                    {
                        "detail": (
                            "Only company admins and managers can "
                            "perform this transition."
                        )
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        elif target_status in [
            ServiceJob.Status.IN_PROGRESS,
            ServiceJob.Status.COMPLETED,
        ]:
            if not is_technician:
                return Response(
                    {
                        "detail": (
                            "Only technicians can perform this transition."
                        )
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        job.status = target_status

        if target_status == ServiceJob.Status.IN_PROGRESS:
            job.started_at = timezone.now()

        elif target_status == ServiceJob.Status.COMPLETED:
            job.completed_at = timezone.now()

        job.save()

        return Response(
            {
                "id": str(job.id),
                "status": job.status,
                "started_at": job.started_at,
                "completed_at": job.completed_at,
            },
            status=status.HTTP_200_OK,
        )
    