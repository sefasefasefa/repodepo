from django.urls import path
from . import views
from . import extra_views as ex

urlpatterns = [
    path('affiliate/settings', views.get_settings),
    path('affiliate/my-link', views.get_my_link),
    path('affiliate/click/<str:code>', views.track_click),
    path('affiliate/commissions', views.get_commissions),
    path('affiliate/payout', views.request_payout),
    path('affiliate/stats', ex.stats),
    # Admin
    path('admin/affiliate/settings', ex.admin_settings),
    path('admin/affiliate/links', ex.admin_links),
    path('admin/affiliate/links/<int:link_id>', ex.admin_link_detail),
    path('admin/affiliate/commissions', ex.admin_commissions),
    path('admin/affiliate/payouts', ex.admin_payouts),
    path('admin/affiliate/payouts/<int:payout_id>', ex.admin_payout_detail),
]
