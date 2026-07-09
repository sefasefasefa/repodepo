"""
Performance migration: add the composite indexes that are still missing.

Already present (from earlier migrations):
  video_pub_date_idx   – (is_published, created_at DESC)
  video_pub_views_idx  – (is_published, view_count DESC)
  video_pub_likes_idx  – (is_published, like_count DESC)
  video_pub_type_idx   – (is_published, type, created_at DESC)
  video_pub_prem_idx   – (is_published, is_premium, view_count DESC)
  video_creator_pub_idx – (creator_id, is_published)
  videos_category_id   – (category_id)   ← single-column only
  watch_history_user_id – (user_id)      ← single-column only

Still missing / worth adding:
  video_cat_pub_date_idx  – (category_id, is_published, created_at DESC)
      Used by the category-detail page: WHERE category_id=X AND is_published=1
      ORDER BY created_at DESC. Without this SQLite must scan the full
      category_id index then filter + sort.

  watch_user_time_idx – (user_id, created_at DESC) on watch_history
      Used by the for-you recommendation window query:
      WHERE user_id=X AND created_at >= since30.

Use RunSQL with IF NOT EXISTS so re-running is always safe.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("videos", "0014_watchhistory_rich_signals"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE INDEX IF NOT EXISTS video_cat_pub_date_idx
                ON videos (category_id, is_published, created_at DESC);

            CREATE INDEX IF NOT EXISTS watch_user_time_idx
                ON watch_history (user_id, created_at DESC);
            """,
            reverse_sql="""
            DROP INDEX IF EXISTS video_cat_pub_date_idx;
            DROP INDEX IF EXISTS watch_user_time_idx;
            """,
        ),
    ]
