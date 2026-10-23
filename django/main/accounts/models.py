import uuid

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager): 
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email address is required')

        email = self.normalize_email(email)

        user = self.model(
            email=email,
            **extra_fields
        )

        user.set_password(password)
        user.save(using=self._db)

        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('company', None)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True')

        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True')

        return self.create_user(
            email,
            password,
            **extra_fields
        )

class User(AbstractUser):
    class Role(models.TextChoices):
        COMPANY_ADMIN = 'COMPANY_ADMIN', 'Company Admin'
        MANAGER = 'MANAGER', 'Manager'
        TECHNICIAN = 'TECHNICIAN', 'Technician'

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    username = None

    email = models.EmailField(
        unique=True,
    )

    phone = models.CharField(
        max_length=20,
        blank=True,
    )

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.TECHNICIAN,
    )

    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='users',
        null=True,
        blank=True,
    )

    profile_photo = models.URLField(
        blank=True,
        null=True,
    )

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email

class TechnicianProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='technician_profile',
    )

    employee_id = models.CharField(
        max_length=50,
        unique=True,
    )

    skills = models.TextField(
        blank=True
    )

    hire_date = models.DateField(
        null=True,
        blank=True,
    )

    notes = models.TextField(
        blank=True
    )

    is_available = models.BooleanField(
        default=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return f"{self.user.get_full_name()} ({self.employee_id})"

class CompanyMembership(models.Model):
    class Role(models.TextChoices):
        COMPANY_ADMIN = 'COMPANY_ADMIN', 'Company Admin'
        MANAGER = 'MANAGER', 'Manager'
        TECHNICIAN = 'TECHNICIAN', 'Technician'

    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        INVITED = 'INVITED', 'Invitied'
        SUSPENDED = 'SUSPENDED', 'Suspended'

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='company_memberships',
    )

    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='memberships',
    )

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'company'],
                name='unique_user_company_membership'
            ),
        ]
        indexes = [
            models.Index(
                fields=['company', 'status'],
                name='membership_company_status_idx',
            ),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.company.name} ({self.role})"
