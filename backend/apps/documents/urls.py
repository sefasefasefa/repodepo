from django.urls import path
from . import views

urlpatterns = [
    path('documents/analyze-pdf', views.analyze_pdf),
]
