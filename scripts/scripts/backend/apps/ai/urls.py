from django.urls import path
from . import views

urlpatterns = [
    # Public-ish signal stream from the running site
    path('ai/events', views.ingest_event),

    # Admin
    path('ai/admin/models', views.admin_models),
    path('ai/admin/models/<str:kind>/train', views.admin_train),
    path('ai/admin/models/<str:kind>/reset', views.admin_reset),
    path('ai/admin/events', views.admin_events),
    path('ai/admin/events/bulk', views.admin_events_bulk),
    path('ai/admin/events/<int:event_id>/<str:action>', views.admin_event_review),
    path('ai/admin/predictions', views.admin_predictions),
    path('ai/admin/predictions/<int:prediction_id>/apply', views.admin_prediction_apply),
    path('ai/admin/predictions/<int:prediction_id>/dismiss', views.admin_prediction_dismiss),
]
