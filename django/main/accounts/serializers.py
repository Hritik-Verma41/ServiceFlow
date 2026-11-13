from rest_framework import serializers

from .models import CompanyMembership, Invitation, User


class InvitationAcceptSerializer(serializers.Serializer):
    token = serializers.CharField(
        write_only=True,
        trim_whitespace=True,
    )
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=False,
        style={"input_type": "password"},
    )
    first_name = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=150,
    )
    last_name = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=150,
    )


class InvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(
        choices=Invitation.Role.choices,
    )

class CompanyMemberUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "phone",
            "profile_photo",
        ]
        read_only_fields = fields

class CompanyMembershipSerializer(serializers.ModelSerializer):
    user = CompanyMemberUserSerializer(read_only=True)

    class Meta:
        model = CompanyMembership

        fields = [
            "id",
            "user",
            "role",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
