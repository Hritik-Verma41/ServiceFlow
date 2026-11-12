from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from main.accounts.models import CompanyMembership
from main.accounts.permissions import (
    IsActiveCompanyMember,
    IsCompanyAdmin,
    IsCompanyAdminOrManager,
)
from .models import Company, Customer, CustomerAddress
from .serializers import (
    CompanyCreateSerializer,
    CompanyUpdateSerializer,
    CustomerAddressSerializer,
    CustomerSerializer,
)

class CompanyListCreateView(generics.ListCreateAPIView):
    serializer_class = CompanyCreateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Company.objects.filter(
            memberships__user=self.request.user,
            memberships__status=CompanyMembership.Status.ACTIVE,
            is_active=True,
        ).distinct().order_by("name")

    @transaction.atomic
    def perform_create(self, serializer):
        company = serializer.save()

        CompanyMembership.objects.create(
            user=self.request.user,
            company=company,
            role=CompanyMembership.Role.COMPANY_ADMIN,
            status=CompanyMembership.Status.ACTIVE,
        )

class CompanyDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsActiveCompanyMember]
    lookup_url_kwarg = "company_id"

    def get_permissions(self):
        if self.request.method in ["PUT", "PATCH"]:
            permission_classes = [
                IsAuthenticated,
                IsCompanyAdminOrManager,
            ]
        elif self.request.method == "DELETE":
            permission_classes = [
                IsAuthenticated,
                IsCompanyAdmin,
            ]
        else:
            permission_classes = self.permission_classes

        return [permission() for permission in permission_classes]

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

    def get_queryset(self):
        return Company.objects.filter(is_active=True)

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return CompanyUpdateSerializer

        return CompanyCreateSerializer

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])

class CompanyCustomerListCreateView(generics.ListCreateAPIView):
    serializer_class = CustomerSerializer
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

        return Customer.objects.filter(
            company=company,
            is_active=True,
        ).order_by("-created_at")

    def perform_create(self, serializer):
        company = self.get_company()
        serializer.save(company=company)

class CompanyCustomerDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated, IsActiveCompanyMember]
    lookup_url_kwarg = "customer_id"

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

    def get_queryset(self):
        return Customer.objects.filter(
            company=self.get_company(),
            is_active=True,
        )

    def get_permissions(self):
        if self.request.method in ["PUT", "PATCH", "DELETE"]:
            permission_classes = [
                IsAuthenticated,
                IsCompanyAdminOrManager,
            ]
        else:
            permission_classes = self.permission_classes

        return [permission() for permission in permission_classes]

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])

class CompanyCustomerAddressListCreateView(generics.ListCreateAPIView):
    serializer_class = CustomerAddressSerializer
    permission_classes = [IsAuthenticated, IsActiveCompanyMember]

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

    def get_customer(self):
        return get_object_or_404(
            Customer,
            id=self.kwargs["customer_id"],
            company=self.get_company(),
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
        return CustomerAddress.objects.filter(
            customer=self.get_customer(),
        ).order_by("-is_primary", "-created_at")

    def perform_create(self, serializer):
        serializer.save(customer=self.get_customer())

class CompanyCustomerAddressDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CustomerAddressSerializer
    permission_classes = [IsAuthenticated, IsActiveCompanyMember]
    lookup_url_kwarg = "address_id"

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

    def get_customer(self):
        return get_object_or_404(
            Customer,
            id=self.kwargs["customer_id"],
            company=self.get_company(),
            is_active=True,
        )

    def get_permissions(self):
        if self.request.method in ["PUT", "PATCH", "DELETE"]:
            permission_classes = [
                IsAuthenticated,
                IsCompanyAdminOrManager,
            ]
        else:
            permission_classes = self.permission_classes

        return [permission() for permission in permission_classes]

    def get_queryset(self):
        return CustomerAddress.objects.filter(
            customer=self.get_customer(),
        )
