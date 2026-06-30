import hashlib
import os
import secrets
import hmac
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, username, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email required')
        email = self.normalize_email(email)
        user = self.model(username=username, email=email, **extra_fields)
        if password:
            user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None, **extra_fields):
        extra_fields.setdefault('role', 'admin')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(username, email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('user', 'User'),
        ('creator', 'Creator'),
        ('moderator', 'Moderator'),
        ('admin', 'Admin'),
    ]

    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    password_hash = models.TextField(default='')
    display_name = models.CharField(max_length=200)
    avatar_url = models.TextField(null=True, blank=True)
    banner_url = models.TextField(null=True, blank=True)
    bio = models.TextField(null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user', db_index=True)
    is_verified = models.BooleanField(default=False, db_index=True)
    is_banned = models.BooleanField(default=False, db_index=True)
    ban_reason = models.TextField(null=True, blank=True)
    follower_count = models.IntegerField(default=0)
    following_count = models.IntegerField(default=0)
    video_count = models.IntegerField(default=0)
    total_views = models.IntegerField(default=0)
    subscription_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    social_links = models.JSONField(null=True, blank=True)
    session_token = models.CharField(max_length=255, null=True, blank=True, unique=True)
    google_id = models.CharField(max_length=255, null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    phone_verified = models.BooleanField(default=False)
    sms_otp = models.CharField(max_length=10, null=True, blank=True)
    sms_otp_expires_at = models.DateTimeField(null=True, blank=True)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']

    class Meta:
        db_table = 'users'

    def __str__(self):
        return f'{self.username} ({self.role})'

    def set_password(self, raw_password):
        salt = secrets.token_hex(16)
        dk = hashlib.scrypt(raw_password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64)
        self.password_hash = f'{salt}:{dk.hex()}'
        self.password = ''

    def check_password(self, raw_password):
        if not self.password_hash or ':' not in self.password_hash:
            return False
        salt, stored_hash = self.password_hash.split(':', 1)
        try:
            dk = hashlib.scrypt(raw_password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64)
            return hmac.compare_digest(dk.hex(), stored_hash)
        except Exception:
            return False

    def generate_session_token(self):
        self.session_token = secrets.token_hex(32)
        return self.session_token

    def format_user(self, is_following=False, is_subscribed=False):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'displayName': self.display_name,
            'avatarUrl': self.avatar_url,
            'bannerUrl': self.banner_url,
            'bio': self.bio,
            'role': self.role,
            'isVerified': self.is_verified,
            'isBanned': self.is_banned,
            'followerCount': self.follower_count,
            'followingCount': self.following_count,
            'videoCount': self.video_count,
            'totalViews': self.total_views,
            'subscriptionPrice': float(self.subscription_price) if self.subscription_price else None,
            'socialLinks': self.social_links,
            'isFollowing': is_following,
            'isSubscribed': is_subscribed,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
        }
