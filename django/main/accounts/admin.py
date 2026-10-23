from django.contrib import admin

from .forms import UserChangeForm, UserCreationForm
from .models import User, TechnicianProfile


@admin.register(User)
class CustomUserAdmin(admin.ModelAdmin):
    add_form = UserCreationForm
    form = UserChangeForm

    list_display = (
        "email",
        "first_name",
        "last_name",
        "company",
        "role",
        "is_active",
        "is_staff",
    )

    list_filter = (
        "role",
        "is_active",
        "is_staff",
        "company",
    )

    search_fields = (
        "email",
        "first_name",
        "last_name",
        "phone",
    )

    ordering = ("email",)

    readonly_fields = (
        "id",
        "last_login",
        "date_joined",
    )

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "email",
                    "password",
                )
            },
        ),
        (
            "Personal Information",
            {
                "fields": (
                    "first_name",
                    "last_name",
                    "phone",
                    "profile_photo",
                )
            },
        ),
        (
            "ServiceFlow",
            {
                "fields": (
                    "company",
                    "role",
                )
            },
        ),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        (
            "Important Dates",
            {
                "fields": (
                    "last_login",
                    "date_joined",
                )
            },
        ),
    )

    def get_fieldsets(self, request, obj=None):
        if obj is None:
            return (
                (
                    None,
                    {
                        "classes": ("wide",),
                        "fields": (
                            "email",
                            "password1",
                            "password2",
                        ),
                    },
                ),
                (
                    "Personal Information",
                    {
                        "fields": (
                            "first_name",
                            "last_name",
                            "phone",
                            "profile_photo",
                        )
                    },
                ),
                (
                    "ServiceFlow",
                    {
                        "fields": (
                            "company",
                            "role",
                        )
                    },
                ),
                (
                    "Permissions",
                    {
                        "fields": (
                            "is_active",
                            "is_staff",
                            "is_superuser",
                        )
                    },
                ),
            )

        return super().get_fieldsets(request, obj)

    def get_form(self, request, obj=None, **kwargs):
        if obj is None:
            kwargs["form"] = self.add_form
        else:
            kwargs["form"] = self.form

        return super().get_form(request, obj, **kwargs)

@admin.register(TechnicianProfile)
class TechnicianProfileAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'employee_id',
        'hire_date',
        'is_available',
    )

    list_filter = (
        'is_available',
        'hire_date',
    )

    search_fields = (
        'user__email',
        'user__first_name',
        'user__last_name',
        'employee_id',
        'skills',
    )

    ordering = (
        'employee_id',
    )

    readonly_fields = (
        'created_at',
        'updated_at',
    )
