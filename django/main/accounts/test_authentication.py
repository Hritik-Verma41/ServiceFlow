from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from main.accounts.models import User


class JWTAuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.password = "TestPassword!2026"

        self.user = User.objects.create_user(
            email="jwt-test@example.com",
            password=self.password,
            first_name="JWT",
            last_name="Test",
        )

    def test_login_returns_access_and_refresh_tokens(self):
        response = self.client.post(
            "/api/auth/token/",
            {
                "email": self.user.email,
                "password": self.password,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_rejects_invalid_password(self):
        response = self.client.post(
            "/api/auth/token/",
            {
                "email": self.user.email,
                "password": "WrongPassword!2026",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 401)

    def test_refresh_returns_new_access_token(self):
        refresh = RefreshToken.for_user(self.user)

        response = self.client.post(
            "/api/auth/token/refresh/",
            {"refresh": str(refresh)},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
