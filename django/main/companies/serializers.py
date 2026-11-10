from rest_framework import serializers

from .models import Customer, CustomerAddress


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = [
            "id",
            "company",
            "name",
            "email",
            "phone",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "company",
            "is_active",
            "created_at",
            "updated_at",
        ]

class CustomerAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerAddress
        fields = [
            "id",
            "customer",
            "label",
            "address_line_1",
            "address_line_2",
            "city",
            "state",
            "postal_code",
            "country",
            "is_primary",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "customer",
            "created_at",
            "updated_at",
        ]
