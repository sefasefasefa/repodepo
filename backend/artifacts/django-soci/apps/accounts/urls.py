from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views
from . import phone_views
from . import extra_views as acc_ex

urlpatterns = [
    path('auth/register', views.register),
    path('auth/login', views.login_view),
    path('auth/logout', views.logout_view),
    path('auth/refresh', TokenRefreshView.as_view()),
    path('auth/me', views.me),
    path('auth/update-profile', views.update_profile),
    path('auth/change-password', views.change_password),
    # SMS / phone verification
    path('auth/sms/send', phone_views.sms_send),
    path('auth/sms/verify', phone_views.sms_verify),
    path('auth/phone/link', phone_views.phone_link),
    path('auth/phone/confirm', phone_views.phone_confirm),
    # Google OAuth
    path('auth/google', phone_views.google_login),
    path('auth/google/callback', phone_views.google_callback),
    path('auth/google/exchange', phone_views.google_exchange),
    # Users
    path('users', views.list_users),
    path('users/search', views.search_users),
    path('users/<str:username>', views.get_user_profile),
    path('users/<int:user_id>/videos', acc_ex.user_videos),
    path('users/<int:user_id>/stats', acc_ex.user_stats),
]
