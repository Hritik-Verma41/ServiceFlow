from django.contrib import admin

from .models import (
    Invoice,
    InvoiceItem,
    JobNote,
    JobPart,
    Part,
    Payment,
    ServiceJob,
)

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = (
        'invoice_number',
        'company',
        'customer',
        'job',
        'status',
        'issue_date',
        'due_date',
        'total_amount',
    )

    list_filter = (
        'company',
        'status',
        'issue_date',
    )

    search_fields = (
        'invoice_number',
        'customer__name',
        'customer__email',
        'job__title',
    )

    ordering = (
        '-created_at',
    )

    readonly_fields = (
        'id',
        'created_at',
        'updated_at',
    )

    autocomplete_fields = (
        'customer',
        'job',
    )

@admin.register(InvoiceItem)
class InvoiceItemAdmin(admin.ModelAdmin):
    list_display = (
        'invoice',
        'item_type',
        'description',
        'quantity',
        'unit_price',
        'amount',
    )

    list_filter = (
        'item_type',
    )

    search_fields = (
        'invoice__invoice_number',
        'description'
    )

    ordering = (
        '-created_at',
    )

    readonly_fields = (
        'id',
        'created_at',
    )

    autocomplete_fields = (
        'invoice',
    )

@admin.register(JobNote)
class JobNoteAdmin(admin.ModelAdmin):
    list_display = (
        'job',
        'created_by',
        'created_at',
    )

    list_filter = (
        'created_at',
    )

    search_fields = (
        'job__title',
        'job__customer__name',
        'created_by__email',
        'note',
    )

    ordering = (
        '-created_at',
    )

    readonly_fields = (
        'id',
        'created_at',
        'updated_at'
    )

    autocomplete_fields = (
        'job',
        'created_by',
    )

@admin.register(JobPart)
class JobPartAdmin(admin.ModelAdmin):
    list_display = (
        "job",
        "part",
        "quantity",
        "unit_price",
        "created_at",
    )

    list_filter = (
        "part",
        "created_at",
    )

    search_fields = (
        "job__title",
        "job__customer__name",
        "part__name",
        "part__part_number",
    )

    ordering = (
        "-created_at",
    )

    readonly_fields = (
        "id",
        "created_at",
    )

    autocomplete_fields = (
        "job",
        "part",
    )

@admin.register(Part)
class PartAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "part_number",
        "company",
        "unit_price",
        "is_active",
    )

    list_filter = (
        "company",
        "is_active",
    )

    search_fields = (
        "name",
        "part_number",
        "description",
    )

    ordering = (
        "name",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        'invoice',
        'amount',
        'method',
        'status',
        'gateway',
        'paid_at',
        'created_at',
    )

    list_filter = (
        'method',
        'status',
        'gateway',
        'paid_at',
    )

    search_fields = (
        'invoice__invoice_number',
        'gateway_order_id',
        'gateway_payment_id',
        'transaction_reference',
    )
    ordering = (
        '-created_at',
    )

    readonly_fields = (
        'id',
        'created_at',
        'updated_at',
    )

    autocomplete_fields = (
        'invoice',
    )

@admin.register(ServiceJob)
class ServiceJobAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'company',
        'customer',
        'assigned_technician',
        'status',
        'priority',
        'scheduled_start',
        'created_at',
    )

    list_filter = (
        'company',
        'status',
        'priority'
    )

    search_fields = (
        'title',
        'description',
        'customer__name',
        'customer__email',
        'assigned_techician__email',
    )

    ordering = (
        'id',
        'created_at',
        'updated_at',
        'completed_at',
    )

    readonly_fields = (
        'id',
        'created_at',
        'updated_at',
        'started_at',
        'completed_at',
    )

    autocomplete_fields = (
        'customer',
        'service_address',
        'assigned_technician'
    )
