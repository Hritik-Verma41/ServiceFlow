import uuid

from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from main.accounts.models import CompanyMembership
from main.accounts.permissions import (
    IsActiveCompanyMember,
    IsCompanyAdminOrManager,
)
from main.companies.models import Company

from .models import (
    ActivityLog,
    Invoice,
    InvoiceItem,
    JobNote,
    JobPart,
    Part,
    Payment,
    ServiceJob,
    StockMovement,
)
from .serializers import (
    ActivityLogSerializer,
    InvoiceCreateSerializer,
    InvoiceSerializer,
    InvoiceUpdateSerializer,
    JobNoteSerializer,
    JobPartSerializer,
    PartSerializer,
    ServiceJobSerializer,
    StockAdjustmentSerializer,
)

def filter_queryset_by_date_range(queryset, request, date_field):
    start_date_value = request.query_params.get("start_date")
    end_date_value = request.query_params.get("end_date")

    # No date range supplied: preserve existing API behaviour.
    if not start_date_value and not end_date_value:
        return queryset

    # Both dates are required together.
    if not start_date_value or not end_date_value:
        raise ValidationError({
            "date_range": "Both start_date and end_date are required."
        })

    try:
        start_date = datetime.strptime(
            start_date_value,
            "%Y-%m-%d",
        ).date()

        end_date = datetime.strptime(
            end_date_value,
            "%Y-%m-%d",
        ).date()

    except ValueError:
        raise ValidationError({
            "date_range": "Dates must use YYYY-MM-DD format."
        })

    if start_date > end_date:
        raise ValidationError({
            "date_range": "start_date must be on or before end_date."
        })

    current_timezone = timezone.get_current_timezone()

    start_datetime = timezone.make_aware(
        datetime.combine(start_date, time.min),
        current_timezone,
    )

    end_datetime = timezone.make_aware(
        datetime.combine(
            end_date + timedelta(days=1),
            time.min,
        ),
        current_timezone,
    )

    return queryset.filter(
        **{
            f"{date_field}__gte": start_datetime,
            f"{date_field}__lt": end_datetime,
        }
    )

class CompanyServiceJobListCreateView(generics.ListCreateAPIView):
    serializer_class = ServiceJobSerializer
    permission_classes = [IsAuthenticated, IsActiveCompanyMember]

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

    def get_permissions(self):
        if self.request.method == "POST":
            permission_classes = [
                IsAuthenticated,
                IsCompanyAdminOrManager,
            ]
        else:
            permission_classes = self.permission_classes

        return [permission() for permission in permission_classes]

    def get_queryset(self):
        company = self.get_company()

        queryset = ServiceJob.objects.filter(
            company=company,
        ).select_related(
            "customer",
            "service_address",
            "assigned_technician",
        )

        queryset = filter_queryset_by_date_range(
            queryset,
            self.request,
            "created_at",
        )

        if self.request.user.is_superuser:
            return queryset.order_by("-created_at")

        membership = CompanyMembership.objects.filter(
            user=self.request.user,
            company=company,
            status=CompanyMembership.Status.ACTIVE,
        ).first()

        if membership.role == CompanyMembership.Role.TECHNICIAN:
            queryset = queryset.filter(
                assigned_technician=self.request.user,
            )

        return queryset.order_by("-created_at")

    def perform_create(self, serializer):
        company = self.get_company()

        job = serializer.save(company=company)

        ActivityLog.objects.create(
            company=company,
            job=job,
            actor=self.request.user,
            event_type=ActivityLog.EventType.JOB_CREATED,
            description=f"Service job created: {job.title}",
            metadata={
                "job_title": job.title,
                "status": job.status,
                "priority": job.priority,
            },
        )


class CompanyServiceJobDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = ServiceJobSerializer
    permission_classes = [IsAuthenticated, IsActiveCompanyMember]
    lookup_url_kwarg = "job_id"

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

    def get_permissions(self):
        if self.request.method in ["PUT", "PATCH"]:
            permission_classes = [
                IsAuthenticated,
                IsCompanyAdminOrManager,
            ]
        else:
            permission_classes = self.permission_classes

        return [permission() for permission in permission_classes]

    def get_queryset(self):
        company = self.get_company()

        queryset = ServiceJob.objects.filter(
            company=company,
        ).select_related(
            "customer",
            "service_address",
            "assigned_technician",
        )

        if self.request.user.is_superuser:
            return queryset

        membership = CompanyMembership.objects.filter(
            user=self.request.user,
            company=company,
            status=CompanyMembership.Status.ACTIVE,
        ).first()

        if membership.role == CompanyMembership.Role.TECHNICIAN:
            queryset = queryset.filter(
                assigned_technician=self.request.user,
            )

        return queryset

    def perform_update(self, serializer):
        old_technician_id = serializer.instance.assigned_technician_id

        job = serializer.save()

        new_technician_id = job.assigned_technician_id

        if old_technician_id != new_technician_id and new_technician_id:
            ActivityLog.objects.create(
                company=job.company,
                job=job,
                actor=self.request.user,
                event_type=ActivityLog.EventType.TECHNICIAN_ASSIGNED,
                description=(
                    f"Technician assigned to service job: {job.title}"
                ),
                metadata={
                    "previous_technician_id": (
                        str(old_technician_id) if old_technician_id else None
                    ),
                    "assigned_technician_id": str(new_technician_id),
                },
            )

class CompanyServiceJobStatusView(APIView):
    permission_classes = [IsAuthenticated, IsActiveCompanyMember]

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

    def post(self, request, *args, **kwargs):
        company = self.get_company()

        membership = None

        if not request.user.is_superuser:
            membership = get_object_or_404(
                CompanyMembership,
                user=request.user,
                company=company,
                status=CompanyMembership.Status.ACTIVE,
            )

        target_status = request.data.get("status")

        if target_status not in ServiceJob.Status.values:
            return Response(
                {"status": "A valid status is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        job_queryset = ServiceJob.objects.filter(company=company)
        if (
            not request.user.is_superuser
            and membership.role == CompanyMembership.Role.TECHNICIAN
        ):
            job_queryset = job_queryset.filter(
                assigned_technician=request.user,
            )

        job = get_object_or_404(
            job_queryset,
            id=self.kwargs["job_id"],
        )

        allowed_transitions = {
            ServiceJob.Status.NEW: {
                ServiceJob.Status.SCHEDULED,
                ServiceJob.Status.CANCELLED,
            },
            ServiceJob.Status.SCHEDULED: {
                ServiceJob.Status.IN_PROGRESS,
                ServiceJob.Status.CANCELLED,
            },
            ServiceJob.Status.IN_PROGRESS: {
                ServiceJob.Status.COMPLETED,
            },
        }

        if target_status not in allowed_transitions.get(job.status, set()):
            return Response(
                {
                    "detail": (
                        f"Cannot change job status from "
                        f"{job.status} to {target_status}."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if request.user.is_superuser:
            is_admin_or_manager = True
            is_technician = False
        else:
            is_admin_or_manager = membership.role in [
                CompanyMembership.Role.COMPANY_ADMIN,
                CompanyMembership.Role.MANAGER,
            ]
            is_technician = (
                membership.role == CompanyMembership.Role.TECHNICIAN
            )

        if target_status in [
            ServiceJob.Status.SCHEDULED,
            ServiceJob.Status.CANCELLED,
        ]:
            if not is_admin_or_manager:
                return Response(
                    {
                        "detail": (
                            "Only company admins and managers can "
                            "perform this transition."
                        )
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        elif target_status in [
            ServiceJob.Status.IN_PROGRESS,
            ServiceJob.Status.COMPLETED,
        ]:
            if not is_technician:
                return Response(
                    {
                        "detail": (
                            "Only technicians can perform this transition."
                        )
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        old_status = job.status

        job.status = target_status

        if target_status == ServiceJob.Status.IN_PROGRESS:
            job.started_at = timezone.now()

        if target_status == ServiceJob.Status.COMPLETED:
            job.completed_at = timezone.now()

        job.save()

        ActivityLog.objects.create(
            company=company,
            job=job,
            actor=request.user,
            event_type=ActivityLog.EventType.JOB_STATUS_CHANGED,
            description=(
                f"Job status changed from {old_status} "
                f"to {target_status}: {job.title}"
            ),
            metadata={
                "old_status": old_status,
                "new_status": target_status,
            },
        )

        return Response(
            {
                "id": str(job.id),
                "status": job.status,
                "started_at": job.started_at,
                "completed_at": job.completed_at,
            },
            status=status.HTTP_200_OK,
        )
class CompanyServiceJobNoteListCreateView(generics.ListCreateAPIView):
    serializer_class = JobNoteSerializer
    permission_classes = [IsAuthenticated, IsActiveCompanyMember]

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

    def get_job(self):
        company = self.get_company()

        queryset = ServiceJob.objects.filter(company=company)

        if not self.request.user.is_superuser:
            membership = get_object_or_404(
                CompanyMembership,
                user=self.request.user,
                company=company,
                status=CompanyMembership.Status.ACTIVE,
            )

            if membership.role == CompanyMembership.Role.TECHNICIAN:
                queryset = queryset.filter(
                    assigned_technician=self.request.user,
                )
        
        return get_object_or_404(
            queryset,
            id=self.kwargs["job_id"],
        )

    def get_queryset(self):
        return JobNote.objects.filter(
            job=self.get_job(),
        ).select_related(
            "created_by",
        ).order_by(
            "created_at",
            "id",
        )

    def perform_create(self, serializer):
        job = self.get_job()

        note = serializer.save(
            job=job,
            created_by=self.request.user,
        )

        ActivityLog.objects.create(
            company=job.company,
            job=job,
            actor=self.request.user,
            event_type=ActivityLog.EventType.NOTE_ADDED,
            description=f"Note added to service job: {job.title}",
            metadata={
                "note_id": str(note.id),
            },
        )

class CompanyPartListCreateView(generics.ListCreateAPIView):
    serializer_class = PartSerializer
    permission_classes = [IsAuthenticated, IsActiveCompanyMember]

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

    def get_permissions(self):
        if self.request.method == "POST":
            permission_classes = [
                IsAuthenticated,
                IsCompanyAdminOrManager,
            ]
        else:
            permission_classes = self.permission_classes

        return [permission() for permission in permission_classes]

    def get_queryset(self):
        return Part.objects.filter(
            company=self.get_company(),
            is_active=True,
        ).order_by("name")

    def perform_create(self, serializer):
        serializer.save(company=self.get_company())

class CompanyPartDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PartSerializer
    permission_classes = [IsAuthenticated, IsActiveCompanyMember]
    lookup_url_kwarg = "part_id"

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

    def get_permissions(self):
        if self.request.method in ["PUT", "PATCH", "DELETE"]:
            permission_classes = [
                IsAuthenticated,
                IsCompanyAdminOrManager,
            ]
        else:
            permission_classes = self.permission_classes

        return [permission() for permission in permission_classes]

    def get_queryset(self):
        return Part.objects.filter(
            company=self.get_company(),
            is_active=True,
        )

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])

class CompanyPartStockAdjustmentView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsCompanyAdminOrManager,
    ]

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

    def post(self, request, *args, **kwargs):
        serializer = StockAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        movement_type = serializer.validated_data["movement_type"]
        quantity = serializer.validated_data["quantity"]
        reason = serializer.validated_data["reason"]

        with transaction.atomic():
            part = get_object_or_404(
                Part.objects.select_for_update(),
                id=self.kwargs["part_id"],
                company=self.get_company(),
                is_active=True,
            )

            previous_stock = part.stock_quantity

            if movement_type == StockMovement.MovementType.INCREASE:
                resulting_stock = previous_stock + quantity
            else:
                resulting_stock = previous_stock - quantity

                if resulting_stock < 0:
                    return Response(
                        {
                            "detail": (
                                "Insufficient stock for this adjustment."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            part.stock_quantity = resulting_stock
            part.save(update_fields=["stock_quantity", "updated_at"])

            movement = StockMovement.objects.create(
                part=part,
                movement_type=movement_type,
                quantity=quantity,
                previous_stock=previous_stock,
                resulting_stock=resulting_stock,
                reason=reason,
                created_by=request.user,
            )

        return Response(
            {
                "id": str(movement.id),
                "part": str(part.id),
                "movement_type": movement.movement_type,
                "quantity": movement.quantity,
                "previous_stock": movement.previous_stock,
                "resulting_stock": movement.resulting_stock,
                "reason": movement.reason,
                "created_by": str(movement.created_by_id),
                "created_at": movement.created_at,
            },
            status=status.HTTP_200_OK,
        )

class CompanyServiceJobPartListCreateView(generics.ListCreateAPIView):
    serializer_class = JobPartSerializer
    permission_classes = [IsAuthenticated, IsActiveCompanyMember]

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

    def get_job(self):
        company = self.get_company()

        queryset = ServiceJob.objects.filter(company=company)

        if not self.request.user.is_superuser:
            membership = get_object_or_404(
                CompanyMembership,
                user=self.request.user,
                company=company,
                status=CompanyMembership.Status.ACTIVE,
            )

            if membership.role == CompanyMembership.Role.TECHNICIAN:
                queryset = queryset.filter(
                    assigned_technician=self.request.user,
                )

        return get_object_or_404(
            queryset,
            id=self.kwargs["job_id"],
        )

    def get_queryset(self):
        return JobPart.objects.filter(
            job=self.get_job(),
        ).select_related(
            "part",
        ).order_by(
            "created_at",
        )

    def create(self, request, *args, **kwargs):
        job = self.get_job()

        if job.status not in [
            ServiceJob.Status.SCHEDULED,
            ServiceJob.Status.IN_PROGRESS,
        ]:
            return Response(
                {
                    "detail": (
                        "Parts can only be consumed by scheduled "
                        "or in-progress jobs."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        quantity = serializer.validated_data["quantity"]
        part = serializer.validated_data["part"]
        notes = serializer.validated_data.get("notes", "")

        with transaction.atomic():
            part = get_object_or_404(
                Part.objects.select_for_update(),
                id=part.id,
                company=job.company,
                is_active=True,
            )

            previous_stock = part.stock_quantity

            if previous_stock < quantity:
                return Response(
                    {"detail": "Insufficient stock for this part."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            resulting_stock = previous_stock - quantity

            job_part = JobPart.objects.create(
                job=job,
                part=part,
                quantity=quantity,
                unit_price=part.unit_price,
                notes=notes,
            )

            part.stock_quantity = resulting_stock
            part.save(update_fields=["stock_quantity", "updated_at"])

            StockMovement.objects.create(
                part=part,
                movement_type=StockMovement.MovementType.DECREASE,
                quantity=quantity,
                previous_stock=previous_stock,
                resulting_stock=resulting_stock,
                reason=f"Used on service job {job.id}",
                created_by=request.user,
            )

        output_serializer = self.get_serializer(job_part)

        return Response(
            output_serializer.data,
            status=status.HTTP_201_CREATED,
        )

class CompanyInvoiceListCreateView(generics.ListCreateAPIView):
    permission_classes = [
        IsAuthenticated,
        IsCompanyAdminOrManager,
    ]

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return InvoiceCreateSerializer

        return InvoiceSerializer

    def get_queryset(self):
        return Invoice.objects.filter(
            company=self.get_company(),
        ).select_related(
            "customer",
            "job",
        ).prefetch_related(
            "items",
        ).order_by(
            "-created_at"
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        job = serializer.validated_data["job"]

        with transaction.atomic():
            # Lock the job to prevent concurrent invoice creation.
            job = get_object_or_404(
                ServiceJob.objects.select_for_update(),
                id=job.id,
                company=self.get_company(),
                status=ServiceJob.Status.COMPLETED,
            )

            if Invoice.objects.filter(job=job).exists():
                return Response(
                    {
                        "detail": (
                            "An invoice already exists for this job."
                        )
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            invoice_number = (
                f"INV-{timezone.localdate():%Y%m%d}-"
                f"{uuid.uuid4().hex[:8].upper()}"
            )

            invoice = serializer.save(
                company=job.company,
                customer=job.customer,
                job=job,
                invoice_number=invoice_number,
                status=Invoice.Status.DRAFT,
            )

            # Generate labor invoice item
            if job.labor_hours > 0:
                InvoiceItem.objects.create(
                    invoice=invoice,
                    item_type=InvoiceItem.ItemType.LABOR,
                    description=f"Labor ({job.labor_hours} hours)",
                    quantity=job.labor_hours,
                    unit_price=job.labor_rate,
                )

            # Generate invoice items for consumed parts.
            job_parts = job.parts_used.select_related("part").all()

            for job_part in job_parts:
                InvoiceItem.objects.create(
                    invoice=invoice,
                    item_type=InvoiceItem.ItemType.PART,
                    description=job_part.part.name,
                    quantity=job_part.quantity,
                    unit_price=job_part.unit_price,
                )

            ActivityLog.objects.create(
                company=job.company,
                job=job,
                actor=request.user,
                event_type=ActivityLog.EventType.INVOICE_CREATED,
                description=f"Invoice {invoice.invoice_number} created",
                metadata={
                    "invoice_id": str(invoice.id),
                    "invoice_number": invoice.invoice_number,
                    "total_amount": str(invoice.total_amount),
                },
            )

        response_serializer = InvoiceSerializer(
            invoice,
            context=self.get_serializer_context()
        )

        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
        )

class CompanyCollectedRevenueView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsCompanyAdminOrManager,
    ]

    def get(self, request, *args, **kwargs):
        company = get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

        payments = Payment.objects.filter(
            invoice__company=company,
            status__in=[
                Payment.Status.SUCCESS,
                Payment.Status.PARTIALLY_REFUNDED,
                Payment.Status.REFUNDED,
            ],
        )

        payments = filter_queryset_by_date_range(
            payments,
            request,
            "paid_at",
        )

        from django.db.models import Sum, F, DecimalField, Value
        from django.db.models.functions import Greatest, Coalesce

        total_collected = payments.aggregate(
            total=Sum(
                Greatest(
                    F("amount") - F("refunded_amount"),
                    Value(Decimal("0.00")),
                    output_field=DecimalField(
                        max_digits=12,
                        decimal_places=2,
                    ),
                ),
            )
        )["total"] or Decimal("0.00")

        return Response({
            "company_id": str(company.id),
            "collected_revenue": str(total_collected),
            "currency": "INR",
        })

class CompanyRevenueTrendView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsCompanyAdminOrManager,
    ]

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

    def get(self, request, *args, **kwargs):
        from django.db.models import (
            Sum,
            F,
            DecimalField,
            Value,
        )
        from django.db.models.functions import (
            Greatest,
            TruncDate,
        )

        company = self.get_company()

        payments = Payment.objects.filter(
            invoice__company=company,
            status__in=[
                Payment.Status.SUCCESS,
                Payment.Status.PARTIALLY_REFUNDED,
                Payment.Status.REFUNDED,
            ],
            paid_at__isnull=False,
        )

        payments = filter_queryset_by_date_range(
            payments,
            request,
            "paid_at",
        )

        daily_revenue = (
            payments
            .annotate(
                day=TruncDate(
                    "paid_at",
                    tzinfo=timezone.get_current_timezone(),
                )
            )
            .values("day")
            .annotate(
                total=Sum(
                    Greatest(
                        F("amount") - F("refunded_amount"),
                        Value(Decimal("0.00")),
                        output_field=DecimalField(
                            max_digits=12,
                            decimal_places=2,
                        ),
                    )
                )
            )
            .order_by("day")
        )

        return Response({
            "company_id": str(company.id),
            "currency": "INR",
            "results": [
                {
                    "date": item["day"].isoformat(),
                    "revenue": str(
                        item["total"] or Decimal("0.00")
                    ),
                }
                for item in daily_revenue
            ],
        })

class CompanyInvoiceDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [
        IsAuthenticated,
        IsCompanyAdminOrManager,
    ]
    lookup_url_kwarg = "invoice_id"

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

    def get_queryset(self):
        queryset = Invoice.objects.filter(
            company = self.get_company(),
        ).select_related(
            "customer",
            "job",
        ).prefetch_related(
            "items",
        )

        if self.request.method in ["PUT", "PATCH"]:
            queryset = queryset.select_for_update()

        return queryset

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return InvoiceUpdateSerializer

        return InvoiceSerializer

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        invoice = self.get_object()

        if invoice.status != Invoice.Status.DRAFT:
            return Response(
                {"detail": "Only draft invoices can be updated."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(
            invoice,
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(raise_exception=True)
        invoice = serializer.save()

        # Recalculate totals if the discount was changed.
        invoice.calculate_totals()
        invoice.save(
            update_fields=[
                "subtotal",
                "tax_amount",
                "total_amount",
                "updated_at",
            ]
        )

        response_serializer = InvoiceSerializer(
            invoice,
            context=self.get_serializer_context(),
        )

        return Response(response_serializer.data)

class CompanyActivityListView(generics.ListAPIView):
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuthenticated, IsActiveCompanyMember]

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

    def get_queryset(self):
        company = self.get_company()

        queryset = ActivityLog.objects.filter(
            company=company,
        ).select_related(
            "actor",
            "job",
        )

        queryset = filter_queryset_by_date_range(
            queryset,
            self.request,
            "created_at",
        )

        if self.request.user.is_superuser:
            return queryset.order_by("-created_at")[:10]

        membership = get_object_or_404(
            CompanyMembership,
            user=self.request.user,
            company=company,
            status=CompanyMembership.Status.ACTIVE,
        )

        if membership.role == CompanyMembership.Role.TECHNICIAN:
            queryset = queryset.filter(
                job__assigned_technician=self.request.user,
            )

        return queryset.order_by("-created_at")[:10]

class CompanyServiceJobActivityListView(generics.ListAPIView):
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuthenticated, IsActiveCompanyMember]

    def get_company(self):
        return get_object_or_404(
            Company,
            id=self.kwargs["company_id"],
            is_active=True,
        )

    def get_job(self):
        company = self.get_company()

        queryset = ServiceJob.objects.filter(
            company=company,
        )

        if not self.request.user.is_superuser:
            membership = get_object_or_404(
                CompanyMembership,
                user=self.request.user,
                company=company,
                status=CompanyMembership.Status.ACTIVE,
            )

            if membership.role == CompanyMembership.Role.TECHNICIAN:
                queryset = queryset.filter(
                    assigned_technician=self.request.user,
                )

        return get_object_or_404(
            queryset,
            id=self.kwargs["job_id"],
        )

    def get_queryset(self):
        job = self.get_job()

        return ActivityLog.objects.filter(
            company=job.company,
            job=job,
        ).select_related(
            "actor",
            "job",
        ).order_by(
            "created_at",
            "id",
        )
