from django.urls import path
from . import views
from . import badges_views as bv
from . import applications_views as apps_v
from . import custom_requests_views as cr

urlpatterns = [
    path('users/<int:user_id>/follow', views.follow_user),
    path('users/<int:user_id>/unfollow', views.unfollow_user),
    path('users/<int:user_id>/followers', views.get_followers),
    path('users/<int:user_id>/following', views.get_following),
    path('stories', views.list_stories),
    path('stories/create', views.create_story),
    path('stories/creator/<int:creator_id>', views.get_creator_stories),
    path('stories/<int:story_id>/view', views.view_story),
    path('stories/<int:story_id>', views.delete_story),
    path('badges', views.list_badges),
    path('badges/user/<int:user_id>', views.get_user_badges),
    path('badges/my', bv.my_badges),
    path('badges/my/<int:ub_id>', bv.update_my_badge),
    path('admin/badges/settings', bv.admin_settings),
    path('admin/badges/definitions', bv.admin_definitions),
    path('admin/badges/definitions/<int:def_id>', bv.admin_definition_detail),
    path('admin/badges/award-user', bv.admin_award),
    path('admin/badges/user/<int:ub_id>', bv.admin_revoke),
    path('admin/badges/user-badges', bv.admin_user_badges),
    path('badges/admin/users', bv.admin_user_badges),
    path('admin/badges/auto-award', bv.admin_auto_award),
    # Aliases — frontend uses badges/admin/* swapped order
    path('badges/admin/settings', bv.admin_settings),
    path('badges/admin/definitions', bv.admin_definitions),
    path('badges/admin/definitions/<int:def_id>', bv.admin_definition_detail),
    path('badges/admin/award', bv.admin_award),
    path('badges/admin/award/<int:ub_id>', bv.admin_revoke),
    path('badges/admin/auto-award', bv.admin_auto_award),
    path('creator-applications', views.submit_creator_application),
    path('creator-applications/my', views.get_my_creator_application),
    path('custom-requests', views.list_custom_requests),
    path('custom-requests/create', views.create_custom_request),
    path('custom-requests/<int:request_id>/respond', views.respond_custom_request),
    # Admin creator applications + limits
    path('admin/creator-applications', apps_v.admin_list_applications),
    path('admin/creator-applications/<int:app_id>', apps_v.admin_decide_application),
    path('admin/creator-limits/<int:user_id>', apps_v.admin_get_limits),
    path('admin/creator-limits/<int:user_id>/set', apps_v.admin_set_limits),
    path('creator-limits/my', apps_v.my_limits),
    # Full custom-requests workflow (sent/received/accept/reject/complete/cancel/admin/stats)
    path('custom-requests/new', cr.create_request),
    path('custom-requests/sent', cr.sent),
    path('custom-requests/received', cr.received),
    path('custom-requests/admin', cr.admin_list),
    path('custom-requests/stats', cr.stats),
    path('custom-requests/<int:req_id>/accept', cr.accept),
    path('custom-requests/<int:req_id>/reject', cr.reject),
    path('custom-requests/<int:req_id>/complete', cr.complete),
    path('custom-requests/<int:req_id>/cancel', cr.cancel),
]
