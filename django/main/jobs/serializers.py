from decimal import Decimal

from django.db import models
from rest_framework import serializers

from main.accounts.models import CompanyMembership, User
from main.companies.models import Customer, CustomerAddress

from .models import (
    Invoice,
    InvoiceItem,
    JobNote,
    JobPart,
    Part,
    ServiceJob,
)

class ServiceJobSerializer(serializers.ModelSerializer):
    customer = serializers.PrimaryKeyRelatedField(
        queryset=Customer.objects.none(),
    )
    service_address = serializers.PrimaryKeyRelatedField(
        queryset=CustomerAddress.objects.none(),
    )
    assigned_technician = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.none(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = ServiceJob
        fields = [
            "id",
            "company",
            "customer",
            "service_address",
            "assigned_technician",
            "title",
            "description",
            "status",
            "priority",
            "scheduled_start",
            "scheduled_end",
            "started_at",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "company",
            "status",
            "started_at",
            "completed_at",
            "created_at",
            "updated_at",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        view = self.context.get("view")
        company = view.get_company() if view else None

        if company:
            self.fields["customer"].queryset = Customer.objects.filter(
                company=company,
                is_active=True,
            )

            self.fields["service_address"].queryset = (
                CustomerAddress.objects.filter(
                    customer__company=company,
                    customer__is_active=True,
                )
            )

            self.fields["assigned_technician"].queryset = (
                User.objects.filter(
                    is_active=True,
                    company_memberships__company=company,
                    company_memberships__status=CompanyMembership.Status.ACTIVE,
                    company_memberships__role=CompanyMembership.Role.TECHNICIAN,
                ).distinct()
            )

    def validate(self, attrs):
        customer = attrs.get(
            "customer",
            self.instance.customer if self.instance else None,
        )

        service_address = attrs.get(
            "service_address",
            self.instance.service_address if self.instance else None,
        )

        if (
            customer
            and service_address
            and service_address.customer_id != customer.id
        ):
            raise serializers.ValidationError({
                "service_address": (
                    "The service address must belong to the selected customer."
                )
            })

        return attrs

class JobNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobNote
        fields = [
            "id",
            "job",
            "created_by",
            "note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "job",
            "created_by",
            "created_at",
            "updated_at",
        ]

class PartSerializer(serializers.ModelSerializer):
    class Meta:
        model = Part
        fields = [
            "id",
            "company",
            "name",
            "part_number",
            "description",
            "unit_price",
            "stock_quantity",
            "reorder_level",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "company",
            "stock_quantity",
            "created_at",
            "updated_at",
        ]

    def validate_unit_price(self, value):
        if value < 0:
            raise serializers.ValidationError(
                "Unit price cannot be negative."
            )
        return value

    def validate_reorder_level(self, value):
        if value < 0:
            raise serializers.ValidationError(
                "Reorder level cannot be negative."
            )
        return value

class StockAdjustmentSerializer(serializers.Serializer):
    class AdjustmentType(models.TextChoices):
        INCREASE = 'INCREASE', 'Increase'
        DECREASE = 'DECREASE', 'Decrease'

    movement_type = serializers.ChoiceField(
        choices=AdjustmentType.choices,
    )

    quantity = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01'),
    )

    reason = serializers.CharField(
        max_length=255,
        trim_whitespace=True,
    )

class JobPartSerializer(serializers.ModelSerializer):
    part = serializers.PrimaryKeyRelatedField(
        queryset=Part.objects.none(),
    )

    part_name = serializers.CharField(
        source="part.name",
        read_only=True,
    )

    quantity = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0.01"),
    )

    class Meta:
        model = JobPart
        fields = [
            "id",
            "job",
            "part",
            "part_name",
            "quantity",
            "unit_price",
            "notes",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "job",
            "unit_price",
            "created_at",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        view = self.context.get("view")
        company = view.get_company() if view else None

        if company:
            self.fields["part"].queryset = Part.objects.filter(
                company=company,
                is_active=True,
            )

class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        models = InvoiceItem
        fields = [
            "id",
            "item_type",
            "description",
            "quantity",
            "unit_price",
            "amount",
            "created_by",
        ]
        read_only_fields = [
            "id",
            "amount",
            "created_at",
        ]

class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "company",
            "customer",
            "job",
            "invoice_number",
            "status",
            "issue_date",
            "due_date",
            "subtotal",
            "tax_amount",
            "discount_amount",
            "total_amount",
            "notes",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "company",
            "customer",
            "job",
            "invoice_number",
            "status",
            "issue_date",
            "subtotal",
            "tax_amount",
            "total_amount",
            "created_at",
            "updated_at",
        ]

class InvoiceCreateSerializer(serializers.ModelSerializer):
    job = serializers.PrimaryKeyRelatedField(
        queryset=ServiceJob.objects.none(),
    )

    discount_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.00"),
        required=False,
        default=Decimal("0.00"),
    )

    class Meta:
        model = Invoice
        fields = [
            "job",
            "due_date",
            "discount_amount",
            "notes",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        view = self.context.get("view")
        company = view.get_company() if view else None

        if company:
            self.fields["job"].queryset = ServiceJob.objects.filter(
                company=company,
                status=ServiceJob.Status.COMPLETED,
            )

    def validate_job(self, job):
        if Invoice.objects.filter(job=job).exists():
            raise serializers.ValidationError(
                "An invoice already exists for this job."
            )

        return job
