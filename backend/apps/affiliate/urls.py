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
    # Admin — eski prefix (geriye dönük uyumluluk)
    path('admin/affiliate/settings', ex.admin_settings),
    path('admin/affiliate/links', ex.admin_links),
    path('admin/affiliate/links/<int:link_id>', ex.admin_link_detail),
    path('admin/affiliate/commissions', ex.admin_commissions),
    path('admin/affiliate/payouts', ex.admin_payouts),
    path('admin/affiliate/payouts/<int:payout_id>', ex.admin_payout_detail),
    # Admin — yeni prefix (frontend beklentisi: /api/affiliate/admin/...)
    path('affiliate/admin/settings', ex.admin_settings),
    path('affiliate/admin/links', ex.admin_links),
    path('affiliate/admin/links/<int:link_id>', ex.admin_link_detail),
    path('affiliate/admin/commissions', ex.admin_commissions),
    path('affiliate/admin/payouts', ex.admin_payouts),
    path('affiliate/admin/payouts/<int:payout_id>', ex.admin_payout_detail),
]
