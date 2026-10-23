from django.contrib import admin

from .models import Company, Customer, CustomerAddress

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'phone',
        'email',
        'city',
        'state',
        'country',
        'is_active',
        'created_at',
    )

    list_filter = (
        'is_active',
        'state',
        'country',
    )

    search_fields = (
        'name',
        'email',
        'phone',
        'gst_number',
    )

    readonly_fields = (
        'id',
        'created_at',
        'updated_at',
    )

@admin.register(CustomerAddress)
class CustomerAddressAdmin(admin.ModelAdmin):
    list_display = (
        'customer',
        'label',
        'city',
        'state',
        'postal_code',
        'is_primary',
    )

    list_filter = (
        'is_primary',
        'state',
        'city',
    )

    search_fields = (
        'customer__name',
        'label',
        'address_line1',
        'address_line2',
        'city',
        'postal_code',
    )

    ordering = (
        'customer',
        'label',
    )

    readonly_fields = (
        'id',
        'created_at',
        'updated_at',
    )

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'company',
        'email',
        'phone',
        'is_active',
        'created_at',
    )

    list_filter = (
        'company',
        'is_active',
    )

    search_fields = (
        'name',
        'email',
        'phone',
    )

    ordering = (
        'name',
    )

    readonly_fields = (
        'id',
        'created_at',
        'updated_at',
    )
