from django.urls import path

from . import views

urlpatterns = [
    path('cross-post/catalog', views.provider_catalog),
    path('cross-post/sites', views.sites_list_create),
    path('cross-post/sites/<int:site_id>', views.site_detail),
    path('cross-post/sites/<int:site_id>/test-login', views.site_test_login),
    path('cross-post/dispatch', views.dispatch),
    path('cross-post/jobs', views.jobs_list),
]
