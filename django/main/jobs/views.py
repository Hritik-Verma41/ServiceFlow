from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

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
