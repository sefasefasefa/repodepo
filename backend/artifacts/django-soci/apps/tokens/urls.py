from django.urls import path
from . import views
from . import extra_views as ex

urlpatterns = [
    path('tokens/packages', views.list_packages),
    path('tokens/balance', views.get_balance_view),
    path('tokens/purchase', views.purchase_tokens),
    path('tokens/tip', views.tip_creator),
    path('tokens/history', views.transaction_history),
    path('tokens/withdraw', views.request_withdrawal),
    path('tokens/creator-earnings', ex.creator_earnings),
    # Admin token package management
    path('admin/tokens/packages', ex.admin_packages),
    path('admin/tokens/packages/<int:pkg_id>', ex.admin_package_detail),
]
