from django.urls import path
from . import views
from . import extra_views as ex

urlpatterns = [
    path('subscriptions/plans', views.list_plans),
    path('subscriptions/current', views.current_subscription),
    path('subscriptions/has-access', views.check_access),
    path('subscriptions/subscribe', views.subscribe),
    path('subscriptions/cancel', ex.cancel_subscription),
    path('subscriptions/tip', views.send_tip),
    path('subscriptions/payment-history', views.payment_history),
    path('subscriptions/ppv/<int:video_id>', ex.ppv_purchase),
    path('subscriptions/creator-earnings', ex.creator_earnings),
    # Admin plan yönetimi
    path('admin/subscription-plans', views.admin_list_plans),
    path('admin/subscription-plans/create', views.admin_create_plan),
    path('admin/subscription-plans/<int:plan_id>', views.admin_plan_detail),
]
