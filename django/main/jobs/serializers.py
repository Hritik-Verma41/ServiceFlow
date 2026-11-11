from rest_framework import serializers

from main.accounts.models import CompanyMembership, User
from main.companies.models import Customer, CustomerAddress

from .models import JobNote, Part, ServiceJob

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
