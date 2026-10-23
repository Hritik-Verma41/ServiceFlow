import uuid
from decimal import Decimal, ROUND_HALF_UP

from django.db import models

class ServiceJob(models.Model):
    class Status(models.TextChoices):
        NEW = 'NEW', 'New'
        SCHEDULED = 'SCHEDULED', 'Scheduled'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'
        URGENT = 'URGENT', 'Urgent'

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='service_jobs',
    )

    customer = models.ForeignKey(
        'companies.Customer',
        on_delete=models.PROTECT,
        related_name='service_jobs',
    )

    service_address = models.ForeignKey(
        'companies.CustomerAddress',
        on_delete=models.PROTECT,
        related_name='service_jobs',
    )

    assigned_technician = models.ForeignKey(
        'accounts.User',
        on_delete=models.PROTECT,
        related_name='assigned_service_jobs',
        null=True,
        blank=True,
    )

    title = models.CharField(
        max_length=200,
    )

    description = models.TextField(
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NEW,
    )

    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )

    scheduled_start = models.DateTimeField(
        null=True,
        blank=True,
    )

    scheduled_end = models.DateTimeField(
        null=True,
        blank=True,
    )

    started_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    completed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return f"{self.title} - {self.customer.name}"


class JobNote(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    job = models.ForeignKey(
        ServiceJob,
        on_delete=models.CASCADE,
        related_name='notes',
    )

    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.PROTECT,
        related_name='job_notes'
    )

    note = models.TextField()

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    def __str__(self):
        return f"Note for {self.job.title}"


class Part(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='parts',
    )

    name = models.CharField(
        max_length=200,
    )

    part_number = models.CharField(
        max_length=100,
        blank=True,
    )

    description = models.TextField(
        blank=True,
    )

    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )

    is_active = models.BooleanField(
        default=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    def __str__(self):
        return self.name

class JobPart(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    job = models.ForeignKey(
        ServiceJob,
        on_delete=models.CASCADE,
        related_name='parts_used',
    )

    part = models.ForeignKey(
        Part,
        on_delete=models.PROTECT,
        related_name='job_usages'
    )

    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=1,
    )

    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )

    notes = models.TextField(
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    def __str__(self):
        return f"{self.part.name} - {self.quantity}"

class Invoice(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        ISSUED = 'ISSUED', 'Issued'
        PARTIALLY_PAID = 'PARTIALLY_PAID', 'Partially Paid'
        PAID = 'PAID', 'Paid'
        CANCELLED = 'CANCELLED', 'Cancelled'

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='invoices'
    )

    customer = models.ForeignKey(
        'companies.Customer',
        on_delete=models.PROTECT,
        related_name='invoices',
    )

    job = models.OneToOneField(
        ServiceJob,
        on_delete=models.PROTECT,
        related_name='invoice'
    )

    invoice_number = models.CharField(
        max_length=50,
        unique=True,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )

    issue_date = models.DateField(
        null=True,
        blank=True,
    )

    due_date = models.DateField(
        null=True,
        blank=True,
    )

    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    tax_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    notes = models.TextField(
        blank=True,
    )

    created_at=models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def calculate_totals(self):
        self.subtotal = sum(
            (item.amount for item in self.items.all()),
            Decimal('0.00'),
        )

        self.subtotal = self.subtotal.quantize(
            Decimal('0.01'),
            rounding=ROUND_HALF_UP,
        )

        taxable_amount = self.subtotal - self.discount_amount

        if taxable_amount < Decimal('0.00'):
            taxable_amount = Decimal('0.00')

        self.tax_amount = (
            taxable_amount * Decimal('0.18')
        ).quantize(
            Decimal('0.01'),
            rounding=ROUND_HALF_UP,
        )

        self.total_amount = (
            taxable_amount + self.tax_amount
        ).quantize(
            Decimal('0.01'),
            rounding=ROUND_HALF_UP,
        )

        return self.total_amount

    @property
    def paid_amount(self):
        from decimal import Decimal

        return sum(
            (
                payment.amount
                for payment in self.payments.filter(
                    status=Payment.Status.SUCCESS
                )
            ),
            Decimal('0.00')
        )

    @property
    def balance_due(self):
        from decimal import Decimal

        balance = self.total_amount - self.paid_amount

        if balance < Decimal('0.00'):
            return Decimal('0.00')

        return balance

    def update_payment_status(self):
        if self.status == self.Status.CANCELLED:
            return

        paid = self.paid_amount

        if paid <= Decimal('0.00'):
            self.status = self.Status.ISSUED
        elif paid < self.total_amount:
            self.status = self.Status.PARTIALLY_PAID
        else:
            self.status = self.Status.PAID

        self.save(update_fields=['status', 'updated_at'])

    def __str__(self):
        return self.invoice_number

class InvoiceItem(models.Model):
    class ItemType(models.TextChoices):
        LABOR = 'LABOR', 'Labor'
        PART = 'PART', 'Part'
        SERVICE = 'SERVICE', 'Service'
        OTHER = 'OTHER', 'Other'


    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name='items',
    )

    item_type = models.CharField(
        max_length=20,
        choices=ItemType.choices,
    )

    description = models.CharField(
        max_length=225,
    )

    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=1,
    )

    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return self.description

    def save(self, *args, **kwargs):
        self.amount = (
            self.quantity * self.unit_price
        ).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )

        super().save(*args, **kwargs)


        self.invoice.calculate_totals()

        self.invoice.save(
            update_fields=[
                'subtotal',
                'tax_amount',
                'total_amount',
                'updated_at',
            ]
        )

    def delete(self, *args, **kwargs):
        invoice = self.invoice

        result = super().delete(*args, **kwargs)

        invoice.calculate_totals()
        invoice.save(
            update_fields=[
                'subtotal',
                'tax_amount',
                'updated_at',
            ]
        )

        return result

class Payment(models.Model):

    class Method(models.TextChoices):
        CASH = 'CASH', 'Cash'
        UPI = 'UPI', 'UPI'
        CARD = 'CARD', 'Card'
        BANK_TRANSFER = 'BANK_TRANSFER', 'Bank Transfer'
        ONLINE = 'ONLINE', 'Online Gateway'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        SUCCESS = 'SUCCESS', 'Success'
        FAILED = 'FAILED', 'Failed'
        REFUNDED = 'REFUNDED', 'Refunded'
        PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED', 'Partially Refunded'


    class Gateway(models.TextChoices):
        NONE = 'NONE', 'None'
        RAZORPAY = 'RAZORPAY', 'Razorpay'
        JUSPAY = 'JUSPAY', 'Juspay'

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.PROTECT,
        related_name='payments',
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    method = models.CharField(
        max_length=30,
        choices=Method.choices,
    )

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.PENDING,
    )

    gateway = models.CharField(
        max_length=30,
        choices=Gateway.choices,
        default=Gateway.NONE,
    )

    gateway_order_id = models.CharField(
        max_length=150,
        blank=True,
    )

    gateway_payment_id = models.CharField(
        max_length=150,
        blank=True,
    )

    gateway_signature = models.CharField(
        max_length=255,
        blank=True,
    )

    transaction_reference = models.CharField(
        max_length=150,
        blank=True,
    )

    paid_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    notes = models.TextField(
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return f"{self.invoice.invoice_number} - {self.amount}"
