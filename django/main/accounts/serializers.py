from rest_framework import serializers

from .models import Invitation


class InvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(
        choices=Invitation.Role.choices,
    )
