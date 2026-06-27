from django.urls import path
from . import views
from . import extra_views
from . import extras2_views as ex2
from . import subtitles_views as subs
from . import downloads_views as dl
from . import chunk_upload_views as cu

urlpatterns = [
    path('videos', views.list_videos),
    path('videos/feed', views.get_feed),
    path('videos/trending', views.get_trending),
    path('videos/shorts', views.get_shorts),
    path('videos/search', views.search_videos),
    path('videos/<int:video_id>', views.get_video),
    path('videos/<int:video_id>/update', views.update_video),
    path('videos/<int:video_id>/delete', views.delete_video),
    path('videos/<int:video_id>/distribute', views.distribute_video),
    path('videos/<int:video_id>/like', views.like_video),
    path('videos/<int:video_id>/unlike', views.unlike_video),
    path('videos/<int:video_id>/bookmark', views.bookmark_video),
    path('videos/<int:video_id>/unbookmark', views.unbookmark_video),
    path('videos/<int:video_id>/view', views.record_view),
    path('videos/<int:video_id>/related', views.get_related_videos),
    path('videos/<int:video_id>/comments', views.list_comments),
    path('videos/<int:video_id>/comments/create', views.create_comment),
    path('videos/<int:video_id>/subtitles', views.get_video_subtitles),
    path('videos/<int:video_id>/subtitles/upload', views.upload_subtitle),
    path('videos/<int:video_id>/subtitles/upload-transcript', subs.upload_transcript),
    path('videos/<int:video_id>/subtitles/generate', subs.generate_subtitle),
    path('videos/<int:video_id>/subtitles/translate', subs.translate_subtitle),
    path('videos/<int:video_id>/subtitles/auto', subs.auto_subtitle),
    path('videos/<int:video_id>/subtitles/ai-write', subs.ai_write_transcript),
    path('videos/<int:video_id>/subtitles/pending', subs.list_pending_subtitles),
    path('videos/<int:video_id>/subtitles/community-submit', subs.community_submit),
    path('videos/<int:video_id>/subtitles/<str:lang>/approve', subs.approve_subtitle),
    path('videos/<int:video_id>/subtitles/<str:lang>/delete', subs.delete_subtitle),
    path('videos/<int:video_id>/subtitles/<str:lang>', subs.get_subtitle_lang),
    path('videos/create', views.create_video),
    path('comments/<int:comment_id>/delete', views.delete_comment),
    path('comments/<int:comment_id>/like', views.like_comment),
    path('categories', views.list_categories),
    path('categories/create', ex2.create_category),
    path('categories/<int:cat_id>/update', ex2.update_category),
    path('categories/<int:cat_id>/delete', ex2.delete_category),
    path('categories/<slug:slug>', views.get_category),
    path('playlists', views.list_playlists),
    path('playlists/create', views.create_playlist),
    path('playlists/<int:playlist_id>', views.get_playlist),
    path('playlists/<int:playlist_id>/add', views.add_to_playlist),
    path('playlists/<int:playlist_id>/remove/<int:video_id>', views.remove_from_playlist),
    path('watch-history', views.get_watch_history),
    path('bookmarks', views.get_bookmarks),
    path('search', views.search_videos),
    path('upload/video', views.upload_video),
    path('reports', views.report_content),
    path('ads', views.get_ads),
    path('watermark', views.get_watermark),
    path('pages/<slug:slug>', views.get_custom_page),
    # Auto-categorize
    path('auto-categorize', extra_views.auto_categorize),
    path('auto-category/rules', extra_views.auto_category_rules_list),
    path('auto-category/rules/save', extra_views.auto_category_rules_save),
    # Video players (multi-source embeds)
    path('videos/<int:video_id>/players', extra_views.video_players),
    path('videos/<int:video_id>/players/<int:player_id>', extra_views.video_player_detail),
    # Premium downloads
    path('downloads', dl.list_downloads),
    path('downloads/<int:video_id>', dl.add_download),
    path('downloads/<int:video_id>/remove', dl.remove_download),
    path('downloads/check/<int:video_id>', dl.check_download),
    # Reports sub-resource
    path('videos/scheduled', views.list_scheduled_videos),
    path('videos/<int:video_id>/cancel-schedule', views.cancel_schedule),
    path('videos/<int:video_id>/reschedule', views.reschedule_video),
    path('videos/<int:video_id>/publish-now', views.publish_now),
    path('videos/<int:video_id>/report', ex2.report_video),
    # Watch history mgmt
    path('watch-history/clear', ex2.clear_history),
    # Ads tracking
    path('ads/<int:ad_id>/click', ex2.ad_click),
    path('ads/<int:ad_id>/impression', ex2.ad_impression),
    # Watermark
    path('watermark/config', ex2.watermark_config),
    path('watermark/video/<int:video_id>', ex2.video_watermark),
    # Upload metadata
    path('upload/supported-formats', ex2.supported_formats),
    # Chunked upload
    path('upload/chunk-init', cu.chunk_init),
    path('upload/chunk-part', cu.chunk_part),
    path('upload/chunk-complete', cu.chunk_complete),
    path('upload/chunk-status/<str:upload_id>', cu.chunk_status),
    path('upload/chunk-cancel/<str:upload_id>', cu.chunk_cancel),
    path('upload/thumbnail', cu.upload_thumbnail),
    path('upload/thumbnail-image', cu.upload_thumbnail_image),
    # Search trending
    path('search/trending', ex2.search_trending),
    # Recommendations
    path('recommendations/for-you', ex2.recommendations_for_you),
    path('recommendations/profile', ex2.recommendations_profile),
]

