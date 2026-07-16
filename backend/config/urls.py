import os
import re
import mimetypes

# HLS dosya türleri için MIME tipi kaydı
mimetypes.add_type("application/vnd.apple.mpegurl", ".m3u8")
mimetypes.add_type("video/mp2t", ".ts")

from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from rest_framework_simplejwt.views import TokenRefreshView, TokenObtainPairView

from apps.core.sitemap import sitemap_xml, sitemap_pages_xml, sitemap_videos_xml, robots_txt
from apps.core.seo_views import video_seo_page, global_seo_page
from django.http import JsonResponse, HttpResponse


def jwks_directory(request):
    """
    Web Bot Auth — JWKS directory endpoint.
    Draft: https://datatracker.ietf.org/wg/webbotauth/about/
    Cloudflare: https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/

    Sitenin bot/agent isteklerini imzalarken kullandığı Ed25519 public key'i JWKS formatında yayınlar.
    Alıcı siteler bu endpoint'i fetch ederek imzayı doğrulayabilir.
    """
    import base64, os, time

    pub_b64 = os.environ.get("BOT_SIGNING_PUBLIC_KEY", "")
    kid     = os.environ.get("BOT_SIGNING_KID", "hotpulse-bot-2026-01")

    if not pub_b64:
        return JsonResponse({"error": "signing key not configured"}, status=503)

    # Ed25519 public key → JWK (RFC 8037)
    jwk = {
        "kty": "OKP",
        "crv": "Ed25519",
        "kid": kid,
        "use": "sig",
        "alg": "EdDSA",
        "x": pub_b64,   # raw public key, base64url-encoded (no padding)
    }

    base = request.build_absolute_uri("/").rstrip("/")
    payload = {
        "keys": [jwk],
        # Web Bot Auth metadata
        "iss": base,
        "iat": int(time.time()),
        "context": {
            "site": base,
            "contact": f"{base}/about",
            "purpose": "Hotpulse platform agent requests signed with this key for identity verification.",
        },
    }

    response = JsonResponse(payload)
    response["Access-Control-Allow-Origin"] = "*"
    response["Cache-Control"] = "public, max-age=3600"
    return response


def api_catalog(request):
    """
    RFC 9727 — API Catalog (application/linkset+json).
    RFC 9264 — Linkset format.
    """
    import json
    base = request.build_absolute_uri('/').rstrip('/')

    # RFC 9264 linkset+json: her API için anchor + ilişkili linkler
    linkset = [
        {
            "anchor": f"{base}/api/",
            "service-desc": [
                {"href": f"{base}/api/healthz", "type": "application/json"}
            ],
            "service-doc": [
                {"href": f"{base}/docs/", "type": "text/html"}
            ],
            "status": [
                {"href": f"{base}/api/healthz"}
            ],
        },
        {
            "anchor": f"{base}/api/videos/",
            "service-desc": [{"href": f"{base}/api/videos/", "type": "application/json"}],
            "type": [{"href": "https://schema.org/VideoObject"}],
        },
        {
            "anchor": f"{base}/api/token/",
            "service-desc": [{"href": f"{base}/api/token/", "type": "application/json"}],
            "type": [{"href": "https://www.iana.org/assignments/media-types/application/json"}],
        },
        {
            "anchor": f"{base}/.well-known/api-catalog",
            "self": [{"href": f"{base}/.well-known/api-catalog"}],
            "type": [{"href": "https://www.rfc-editor.org/rfc/rfc9727"}],
        },
    ]

    body = json.dumps({"linkset": linkset}, ensure_ascii=False, indent=2)
    response = HttpResponse(body, content_type="application/linkset+json")
    response["Access-Control-Allow-Origin"] = "*"
    response["Link"] = f'<{base}/.well-known/api-catalog>; rel="self"; type="application/linkset+json"'
    response["Cache-Control"] = "public, max-age=3600"
    return response


def agent_skills_index(request):
    """
    Agent Skills Discovery Index (RFC v0.2.0).
    https://github.com/cloudflare/agent-skills-discovery-rfc
    https://agentskills.io/

    Served at /.well-known/agent-skills/index.json — a machine-readable
    catalogue of all skills/capabilities this platform exposes to agents.
    Each skill entry includes a sha256 digest of its description document
    for integrity verification.
    """
    import json, hashlib
    base = request.build_absolute_uri('/').rstrip('/')

    def _digest(content: str) -> str:
        return "sha256:" + hashlib.sha256(content.encode()).hexdigest()

    skills = [
        {
            "name": "browse-videos",
            "type": "api",
            "description": "List, search, and filter public videos. Supports category, keyword, sort, and pagination query parameters.",
            "url": f"{base}/api/videos/",
            "endpoints": [
                {"method": "GET", "path": "/api/videos/"},
                {"method": "GET", "path": "/api/videos/{id}/"},
                {"method": "GET", "path": "/api/videos/categories/"},
            ],
            "auth_required": False,
        },
        {
            "name": "stream-video",
            "type": "api",
            "description": "Stream video content with HTTP Range (RFC 7233) support. Returns HLS manifests and byte-range MP4 segments.",
            "url": f"{base}/api/videos/{{id}}/stream",
            "endpoints": [
                {"method": "GET", "path": "/api/videos/{id}/stream"},
            ],
            "auth_required": False,
        },
        {
            "name": "user-profiles",
            "type": "api",
            "description": "Fetch public user and creator profiles including follower counts and uploaded video lists.",
            "url": f"{base}/api/users/",
            "endpoints": [
                {"method": "GET", "path": "/api/users/{username}/"},
            ],
            "auth_required": False,
        },
        {
            "name": "account-registration",
            "type": "api",
            "description": "Register a new user account. Required before obtaining a Bearer token.",
            "url": f"{base}/api/accounts/register/",
            "endpoints": [
                {"method": "POST", "path": "/api/accounts/register/"},
            ],
            "auth_required": False,
        },
        {
            "name": "bearer-auth",
            "type": "auth",
            "description": "Obtain and refresh JWT Bearer tokens. POST username+password to /api/token/ to receive access (7d) and refresh (30d) tokens.",
            "url": f"{base}/api/token/",
            "endpoints": [
                {"method": "POST", "path": "/api/token/"},
                {"method": "POST", "path": "/api/token/refresh/"},
            ],
            "auth_required": False,
        },
        {
            "name": "current-user",
            "type": "api",
            "description": "Retrieve the authenticated user's profile, preferences, and subscription status. Requires Bearer token.",
            "url": f"{base}/api/accounts/me/",
            "endpoints": [
                {"method": "GET", "path": "/api/accounts/me/"},
            ],
            "auth_required": True,
        },
        {
            "name": "subscriptions",
            "type": "api",
            "description": "List available subscription plans and manage the authenticated user's active subscription.",
            "url": f"{base}/api/subscriptions/",
            "endpoints": [
                {"method": "GET", "path": "/api/subscriptions/plans/"},
                {"method": "GET", "path": "/api/subscriptions/my/"},
            ],
            "auth_required": True,
        },
        {
            "name": "notifications",
            "type": "api",
            "description": "Read and acknowledge notifications for the authenticated user.",
            "url": f"{base}/api/notifications/",
            "endpoints": [
                {"method": "GET", "path": "/api/notifications/"},
                {"method": "POST", "path": "/api/notifications/read/"},
            ],
            "auth_required": True,
        },
        {
            "name": "platform-health",
            "type": "monitoring",
            "description": "Check API availability and basic platform health status.",
            "url": f"{base}/api/healthz",
            "endpoints": [
                {"method": "GET", "path": "/api/healthz"},
            ],
            "auth_required": False,
        },
        {
            "name": "mcp-server",
            "type": "mcp",
            "description": "Model Context Protocol endpoint — exposes platform tools and resources to MCP-compatible agents.",
            "url": f"{base}/api/mcp",
            "spec": f"{base}/.well-known/mcp/server-card.json",
            "auth_required": False,
        },
        {
            "name": "a2a-agent",
            "type": "a2a",
            "description": "Agent-to-Agent protocol card — describes all platform skills, supported interfaces, and capabilities for A2A orchestration.",
            "url": f"{base}/.well-known/agent-card.json",
            "auth_required": False,
        },
        {
            "name": "auth-discovery",
            "type": "auth",
            "description": "Authentication metadata for agents: auth.md human-readable guide plus OAuth 2.0 server and resource metadata endpoints.",
            "url": f"{base}/auth.md",
            "endpoints": [
                {"method": "GET", "path": "/auth.md"},
                {"method": "GET", "path": "/.well-known/oauth-authorization-server"},
                {"method": "GET", "path": "/.well-known/oauth-protected-resource"},
            ],
            "auth_required": False,
        },
    ]

    # Compute sha256 digest per skill (over its serialised description+url)
    for skill in skills:
        blob = json.dumps({"name": skill["name"], "description": skill["description"], "url": skill["url"]}, sort_keys=True)
        skill["sha256"] = _digest(blob)

    index = {
        "$schema": "https://agentskills.io/schema/v0.2.0/index.json",
        "version": "0.2.0",
        "agent": {
            "name": "Hotpulse",
            "url": base,
            "description": "18+ social video platform with public video browsing, user accounts, subscriptions, and live streaming.",
        },
        "skills": skills,
    }

    body = json.dumps(index, ensure_ascii=False, indent=2)
    response = HttpResponse(body, content_type="application/json")
    response["Access-Control-Allow-Origin"] = "*"
    response["Cache-Control"] = "public, max-age=3600"
    return response


def a2a_agent_card(request):
    """
    A2A Agent Card — Agent-to-Agent protocol discovery.
    https://a2a-protocol.org/latest/specification/
    https://a2a-protocol.org/latest/topics/agent-discovery/

    Served at /.well-known/agent-card.json so other AI agents can discover
    this platform's capabilities and interact via the A2A protocol.
    """
    import json
    base = request.build_absolute_uri('/').rstrip('/')
    card = {
        "schemaVersion": "1.0",
        "name": "Hotpulse",
        "version": "1.0.0",
        "description": (
            "Hotpulse is an 18+ social video platform. "
            "Agents can browse public video content, manage user accounts, "
            "handle subscriptions, and interact with live streaming features."
        ),
        "url": base,
        "provider": {
            "name": "Hotpulse",
            "url": base,
        },
        "supportedInterfaces": [
            {
                "type": "rest-api",
                "url": f"{base}/api/",
                "transport": "http",
                "protocol": "https",
                "authentication": {
                    "type": "bearer",
                    "tokenEndpoint": f"{base}/api/token/",
                },
            },
            {
                "type": "mcp",
                "url": f"{base}/api/mcp",
                "transport": "http",
                "protocol": "mcp/1.0",
            },
        ],
        "capabilities": {
            "streaming": False,
            "pushNotifications": False,
            "stateTransitionHistory": False,
            "authentication": True,
            "multimodal": True,
        },
        "defaultInputModes": ["text/plain", "application/json"],
        "defaultOutputModes": ["application/json"],
        "skills": [
            {
                "id": "video-browse",
                "name": "Browse Videos",
                "description": "List, search, and filter public videos by category, keyword, or sort order.",
                "tags": ["video", "content", "search"],
                "examples": [
                    "List the latest uploaded videos",
                    "Find videos in the 'Music' category",
                    "Search for videos matching 'dance'",
                ],
                "inputModes": ["text/plain", "application/json"],
                "outputModes": ["application/json"],
            },
            {
                "id": "video-detail",
                "name": "Get Video Details",
                "description": "Retrieve full metadata, thumbnail URLs, and stream information for a specific video.",
                "tags": ["video", "metadata", "stream"],
                "examples": [
                    "Get details for video ID 42",
                    "What is the duration of this video?",
                ],
                "inputModes": ["text/plain", "application/json"],
                "outputModes": ["application/json"],
            },
            {
                "id": "user-profile",
                "name": "User Profiles",
                "description": "Fetch public user profiles, creator pages, and follower statistics.",
                "tags": ["user", "profile", "creator"],
                "examples": [
                    "Get the profile of user 'alice'",
                    "How many followers does creator 'bob' have?",
                ],
                "inputModes": ["text/plain", "application/json"],
                "outputModes": ["application/json"],
            },
            {
                "id": "account-management",
                "name": "Account Management",
                "description": "Register new accounts, authenticate, and manage the authenticated user's profile. Requires a valid Bearer token for write operations.",
                "tags": ["auth", "account", "registration"],
                "examples": [
                    "Register a new user account",
                    "Get the currently logged-in user's details",
                ],
                "inputModes": ["application/json"],
                "outputModes": ["application/json"],
                "authRequired": True,
            },
            {
                "id": "categories",
                "name": "Content Categories",
                "description": "List all available video categories on the platform.",
                "tags": ["category", "taxonomy"],
                "examples": [
                    "What categories are available?",
                    "List all content categories",
                ],
                "inputModes": ["text/plain"],
                "outputModes": ["application/json"],
            },
            {
                "id": "health",
                "name": "Platform Health",
                "description": "Check whether the Hotpulse API is operational.",
                "tags": ["health", "status"],
                "examples": ["Is the API online?"],
                "inputModes": ["text/plain"],
                "outputModes": ["application/json"],
            },
        ],
        "authentication": {
            "schemes": ["bearer"],
            "tokenEndpoint": f"{base}/api/token/",
            "registrationEndpoint": f"{base}/api/accounts/register/",
            "authMd": f"{base}/auth.md",
        },
        "discovery": {
            "apiCatalog": f"{base}/.well-known/api-catalog",
            "oauthServer": f"{base}/.well-known/oauth-authorization-server",
            "oauthResource": f"{base}/.well-known/oauth-protected-resource",
            "mcpServerCard": f"{base}/.well-known/mcp/server-card.json",
            "authMd": f"{base}/auth.md",
        },
    }
    body = json.dumps(card, ensure_ascii=False, indent=2)
    response = HttpResponse(body, content_type="application/json")
    response["Access-Control-Allow-Origin"] = "*"
    response["Cache-Control"] = "public, max-age=3600"
    response["Link"] = (
        f'<{base}/.well-known/oauth-authorization-server>; rel="oauth-authorization-server", '
        f'<{base}/auth.md>; rel="auth-md", '
        f'<{base}/.well-known/mcp/server-card.json>; rel="mcp-server-card"'
    )
    return response


def mcp_server_card(request):
    """
    MCP Server Card (SEP-1649) — Model Context Protocol agent discovery.
    https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127

    Advertises this server's MCP transport endpoint and capabilities so
    agents can auto-discover and connect without manual configuration.
    """
    import json
    base = request.build_absolute_uri('/').rstrip('/')
    card = {
        "schema_version": "1.0",
        "serverInfo": {
            "name": "Hotpulse",
            "version": "1.0.0",
            "description": "Hotpulse social video platform — public video metadata, user accounts, subscriptions, and live streaming.",
            "homepage": base,
            "contact": f"{base}/about",
        },
        "transport": [
            {
                "type": "http",
                "endpoint": f"{base}/api/mcp",
                "protocol": "mcp/1.0",
            }
        ],
        "authentication": {
            "type": "bearer",
            "token_endpoint": f"{base}/api/token/",
            "register_uri": f"{base}/api/accounts/register/",
            "auth_md": f"{base}/auth.md",
        },
        "capabilities": {
            "tools": True,
            "resources": True,
            "prompts": False,
            "sampling": False,
            "logging": False,
        },
        "tools": [
            {
                "name": "list_videos",
                "description": "List public videos with optional filtering by category, search query, or sort order.",
                "endpoint": f"{base}/api/videos/",
                "method": "GET",
            },
            {
                "name": "get_video",
                "description": "Get full metadata for a single video by ID or slug.",
                "endpoint": f"{base}/api/videos/{{id}}/",
                "method": "GET",
            },
            {
                "name": "list_categories",
                "description": "List all video categories available on the platform.",
                "endpoint": f"{base}/api/videos/categories/",
                "method": "GET",
            },
            {
                "name": "get_user_profile",
                "description": "Get a user's public profile by username.",
                "endpoint": f"{base}/api/users/{{username}}/",
                "method": "GET",
            },
            {
                "name": "get_current_user",
                "description": "Get the authenticated user's profile (requires Bearer token).",
                "endpoint": f"{base}/api/accounts/me/",
                "method": "GET",
                "auth_required": True,
            },
            {
                "name": "health_check",
                "description": "Check platform health status.",
                "endpoint": f"{base}/api/healthz",
                "method": "GET",
            },
        ],
        "resources": [
            {
                "uri_template": f"{base}/api/videos/{{id}}/",
                "name": "video",
                "description": "A video resource with metadata, thumbnails, and stream URLs.",
                "media_type": "application/json",
            },
            {
                "uri_template": f"{base}/api/users/{{username}}/",
                "name": "user_profile",
                "description": "A user's public profile page.",
                "media_type": "application/json",
            },
        ],
        "rateLimit": {
            "requests_per_minute": 120,
            "note": "Cloudflare DDoS protection applies. Add 500ms delay between bulk requests.",
        },
        "discovery": {
            "api_catalog": f"{base}/.well-known/api-catalog",
            "oauth_server": f"{base}/.well-known/oauth-authorization-server",
            "oauth_resource": f"{base}/.well-known/oauth-protected-resource",
            "auth_md": f"{base}/auth.md",
        },
    }
    body = json.dumps(card, ensure_ascii=False, indent=2)
    response = HttpResponse(body, content_type="application/json")
    response["Access-Control-Allow-Origin"] = "*"
    response["Cache-Control"] = "public, max-age=3600"
    response["Link"] = (
        f'<{base}/.well-known/oauth-authorization-server>; rel="oauth-authorization-server", '
        f'<{base}/auth.md>; rel="auth-md"'
    )
    return response


def serve_auth_md(request):
    """
    auth.md — Agent Authentication Metadata (workos.com/auth-md spec).
    Serves a human- and machine-readable Markdown file at /auth.md that
    describes how AI agents can discover, register, and authenticate with
    this platform.
    """
    base = request.build_absolute_uri('/').rstrip('/')
    content = (
        "# Authentication for AI Agents — Hotpulse\n\n"
        "> This file follows the [auth.md](https://workos.com/auth-md) specification.\n"
        "> It describes how AI agents can authenticate with the Hotpulse API.\n\n"
        "## Overview\n\n"
        "Hotpulse is an 18+ social video platform. Agents may read public video\n"
        "metadata and, with a valid credential, act on behalf of registered users\n"
        "(upload videos, manage subscriptions, send messages, etc.).\n\n"
        "## Quick Start\n\n"
        f"1. **Discover** — `GET {base}/.well-known/oauth-authorization-server`\n"
        f"2. **Register** — `POST {base}/api/accounts/register/` (see [Registration](#registration))\n"
        f"3. **Authenticate** — `POST {base}/api/token/` (see [Token Endpoint](#token-endpoint))\n"
        "4. **Call APIs** — `Authorization: Bearer <access_token>` on every request\n\n"
        "---\n\n"
        "## Registration\n\n"
        f"`POST {base}/api/accounts/register/`\n\n"
        "```json\n"
        "{\n"
        '  "username": "agent_name",\n'
        '  "email":    "agent@example.com",\n'
        '  "password": "strong-password"\n'
        "}\n"
        "```\n\n"
        "**Response** — `201 Created`\n\n"
        "```json\n"
        "{\n"
        '  "id":       1,\n'
        '  "username": "agent_name",\n'
        '  "email":    "agent@example.com",\n'
        '  "role":     "user"\n'
        "}\n"
        "```\n\n"
        "---\n\n"
        "## Token Endpoint\n\n"
        f"`POST {base}/api/token/`  ·  `Content-Type: application/json`\n\n"
        "```json\n"
        "{\n"
        '  "username": "agent_name",\n'
        '  "password": "strong-password"\n'
        "}\n"
        "```\n\n"
        "**Response** — `200 OK`\n\n"
        "```json\n"
        "{\n"
        '  "access":  "<JWT — valid 7 days>",\n'
        '  "refresh": "<JWT — valid 30 days>"\n'
        "}\n"
        "```\n\n"
        f"Refresh: `POST {base}/api/token/refresh/` with `{{\"refresh\": \"<token>\"}}`\n\n"
        "---\n\n"
        "## Identity Types Supported\n\n"
        "| Type       | Description                             |\n"
        "|------------|-----------------------------------------|\n"
        "| `username` | Platform-local identifier (primary)     |\n"
        "| `email`    | Email address tied to the account       |\n"
        f"| `url`      | Profile URL `{base}/u/<username>`       |\n\n"
        "---\n\n"
        "## Credential Types Supported\n\n"
        "| Type            | Header                           | Lifetime |\n"
        "|-----------------|----------------------------------|----------|\n"
        "| `bearer_token`  | `Authorization: Bearer <token>`  | 7 days   |\n"
        "| `refresh_token` | Used at `/api/token/refresh/`    | 30 days  |\n\n"
        "---\n\n"
        "## Claims\n\n"
        "JWT access tokens carry the following claims:\n\n"
        "| Claim      | Description                    |\n"
        "|------------|--------------------------------|\n"
        "| `sub`      | User ID (integer, as string)   |\n"
        "| `username` | Platform username              |\n"
        "| `email`    | User email address             |\n"
        "| `role`     | `user`, `creator`, or `admin`  |\n"
        "| `exp`      | Token expiry (Unix timestamp)  |\n\n"
        "---\n\n"
        "## Key Endpoints\n\n"
        "| Purpose              | Method | Path                                      |\n"
        "|----------------------|--------|-------------------------------------------|\n"
        "| Registration         | POST   | `/api/accounts/register/`                 |\n"
        "| Token (login)        | POST   | `/api/token/`                             |\n"
        "| Token refresh        | POST   | `/api/token/refresh/`                     |\n"
        "| Current user profile | GET    | `/api/accounts/me/`                       |\n"
        "| Video list           | GET    | `/api/videos/`                            |\n"
        "| Health check         | GET    | `/api/healthz`                            |\n"
        "| API catalog          | GET    | `/.well-known/api-catalog`                |\n"
        "| Auth server metadata | GET    | `/.well-known/oauth-authorization-server` |\n"
        "| Protected resource   | GET    | `/.well-known/oauth-protected-resource`   |\n\n"
        "---\n\n"
        "## Contact\n\n"
        f"- Platform: {base}\n"
        f"- API catalog: {base}/.well-known/api-catalog\n"
    )
    response = HttpResponse(content, content_type="text/markdown; charset=utf-8")
    response["Access-Control-Allow-Origin"] = "*"
    response["Cache-Control"] = "public, max-age=3600"
    response["Link"] = (
        f'<{base}/.well-known/oauth-authorization-server>; rel="oauth-authorization-server", '
        f'<{base}/.well-known/oauth-protected-resource>; rel="oauth-protected-resource"'
    )
    return response


def oauth_protected_resource(request):
    """RFC 9728 — OAuth 2.0 Protected Resource Metadata."""
    base = request.build_absolute_uri('/').rstrip('/')
    meta = {
        "resource": base,
        "authorization_servers": [base],
        "jwks_uri": f"{base}/.well-known/http-message-signatures-directory",
        "scopes_supported": ["openid", "profile", "email"],
        "bearer_methods_supported": ["header"],
        "resource_signing_alg_values_supported": ["HS256", "EdDSA"],
        "resource_documentation": f"{base}/.well-known/api-catalog",
        # auth.md — agent registration pointer (workos.com/auth-md)
        "agent_auth": {
            "auth_md": f"{base}/auth.md",
            "register_uri": f"{base}/api/accounts/register/",
            "identity_types_supported": ["url", "username", "email"],
            "credential_types_supported": ["bearer_token", "refresh_token"],
            "claims_supported": ["sub", "username", "email", "role"],
        },
    }
    response = JsonResponse(meta)
    response["Access-Control-Allow-Origin"] = "*"
    response["Cache-Control"] = "public, max-age=3600"
    return response


def oauth_discovery(request):
    """
    RFC 8414 — OAuth 2.0 Authorization Server Metadata.
    OpenID Connect Discovery 1.0 — /.well-known/openid-configuration.
    Agents use this to discover token endpoints and supported grant types.
    Includes agent_auth block per auth.md spec (workos.com/auth-md).
    """
    base = request.build_absolute_uri('/').rstrip('/')
    meta = {
        # Core (RFC 8414)
        "issuer": base,
        "token_endpoint": f"{base}/api/token/",
        "token_endpoint_auth_methods_supported": ["none", "client_secret_post"],
        "grant_types_supported": ["password", "refresh_token"],
        "jwks_uri": f"{base}/.well-known/http-message-signatures-directory",
        "response_types_supported": ["token"],
        "scopes_supported": ["openid", "profile", "email"],
        # OIDC extras (makes it valid openid-configuration too)
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": ["HS256"],
        "userinfo_endpoint": f"{base}/api/accounts/me/",
        "registration_endpoint": f"{base}/api/accounts/register/",
        # Capabilities
        "claims_supported": ["sub", "email", "username", "role"],
        "token_endpoint_auth_signing_alg_values_supported": ["HS256", "EdDSA"],
        "service_documentation": f"{base}/.well-known/api-catalog",
        # auth.md — agent registration block (workos.com/auth-md)
        "agent_auth": {
            "auth_md": f"{base}/auth.md",
            "register_uri": f"{base}/api/accounts/register/",
            "identity_types_supported": ["url", "username", "email"],
            "credential_types_supported": ["bearer_token", "refresh_token"],
            "claims_supported": ["sub", "username", "email", "role"],
            "revocation_endpoint": f"{base}/api/auth/revoke",
        },
    }
    response = JsonResponse(meta)
    response["Access-Control-Allow-Origin"] = "*"
    response["Cache-Control"] = "public, max-age=3600"
    return response


urlpatterns = [
    path('django-admin/', admin.site.urls),

    # auth.md — Agent Authentication Metadata (workos.com/auth-md)
    re_path(r'^auth\.md$', serve_auth_md, name='auth_md'),

    # Agent Skills Discovery Index (RFC v0.2.0)
    path('.well-known/agent-skills/index.json', agent_skills_index, name='agent_skills_index'),

    # A2A Agent Card — Agent-to-Agent protocol discovery
    path('.well-known/agent-card.json', a2a_agent_card, name='a2a_agent_card'),

    # MCP Server Card (SEP-1649) — Model Context Protocol agent discovery
    path('.well-known/mcp/server-card.json', mcp_server_card, name='mcp_server_card'),

    # OAuth 2.0 / OIDC discovery (RFC 8414 + OpenID Connect Discovery 1.0)
    path('.well-known/openid-configuration', oauth_discovery, name='openid_configuration'),
    path('.well-known/oauth-authorization-server', oauth_discovery, name='oauth_authorization_server'),

    # OAuth Protected Resource Metadata (RFC 9728)
    path('.well-known/oauth-protected-resource', oauth_protected_resource, name='oauth_protected_resource'),

    # Agent discovery (RFC 8288 / RFC 9727)
    path('.well-known/api-catalog', api_catalog, name='api_catalog'),

    # Web Bot Auth — JWKS directory (Ed25519 public key)
    path('.well-known/http-message-signatures-directory', jwks_directory, name='jwks_directory'),

    # SEO
    path('sitemap.xml',        sitemap_xml,        name='sitemap'),
    path('sitemap-pages.xml',  sitemap_pages_xml,  name='sitemap_pages'),
    path('sitemap-videos.xml', sitemap_videos_xml, name='sitemap_videos'),
    path('robots.txt',         robots_txt,         name='robots_txt'),

    # JWT token endpoints
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # App API routes
    path('api/', include('apps.accounts.urls')),
    path('api/', include('apps.videos.urls')),
    path('api/', include('apps.social.urls')),
    path('api/', include('apps.subscriptions.urls')),
    path('api/', include('apps.notifications.urls')),
    path('api/', include('apps.live.urls')),
    path('api/', include('apps.messaging.urls')),
    path('api/', include('apps.tokens.urls')),
    path('api/', include('apps.affiliate.urls')),
    path('api/', include('apps.admin_panel.urls')),
    path('api/', include('apps.crosspost.urls')),
    path('api/', include('apps.ai.urls')),
    path('api/', include('apps.devices.urls')),
    path('api/', include('apps.core.urls')),
    path('api/healthz', include('apps.core.health_urls')),
]

def _serve_media(request, path):
    """
    Serve media files with full HTTP Range request support.
    Range desteği olmadan büyük video dosyaları seek yapılamaz ve
    bir süre sonra oynatma durur. Bu fonksiyon 206 Partial Content
    döndürerek seek ve progressive buffering'i destekler.
    """
    import mimetypes
    from django.http import StreamingHttpResponse, JsonResponse, HttpResponse

    media_root = str(settings.MEDIA_ROOT)
    full = os.path.normpath(os.path.join(media_root, path))

    if not full.startswith(media_root):
        return JsonResponse({'error': 'Forbidden'}, status=403)
    if not os.path.exists(full) or not os.path.isfile(full):
        return JsonResponse({'error': 'Medya dosyası bulunamadı', 'path': path}, status=404)

    content_type, _ = mimetypes.guess_type(full)
    content_type = content_type or 'application/octet-stream'
    file_size = os.path.getsize(full)

    range_header = request.META.get('HTTP_RANGE', '').strip()

    if range_header:
        # Parse Range: bytes=start-end
        try:
            range_match = re.match(r'bytes=(\d*)-(\d*)', range_header)
            if not range_match:
                resp = HttpResponse(status=416)
                resp['Content-Range'] = f'bytes */{file_size}'
                return resp

            range_start_str, range_end_str = range_match.group(1), range_match.group(2)
            range_start = int(range_start_str) if range_start_str else 0
            range_end = int(range_end_str) if range_end_str else file_size - 1

            if range_end >= file_size:
                range_end = file_size - 1
            if range_start > range_end:
                resp = HttpResponse(status=416)
                resp['Content-Range'] = f'bytes */{file_size}'
                return resp

            chunk_size = 524288  # 512 KB

            def file_iterator(filepath, start, end):
                with open(filepath, 'rb') as f:
                    f.seek(start)
                    remaining = end - start + 1
                    while remaining > 0:
                        data = f.read(min(chunk_size, remaining))
                        if not data:
                            break
                        remaining -= len(data)
                        yield data

            content_length = range_end - range_start + 1
            resp = StreamingHttpResponse(
                file_iterator(full, range_start, range_end),
                status=206,
                content_type=content_type,
            )
            resp['Content-Length'] = content_length
            resp['Content-Range'] = f'bytes {range_start}-{range_end}/{file_size}'
            resp['Accept-Ranges'] = 'bytes'
            resp['Cache-Control'] = 'public, max-age=3600'
            resp['Access-Control-Allow-Origin'] = '*'
            resp['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
            resp['Access-Control-Allow-Headers'] = 'Range, Content-Type'
            resp['Access-Control-Expose-Headers'] = 'Content-Range, Accept-Ranges, Content-Length'
            return resp

        except Exception:
            pass

    # Range header yoksa dosyanın tamamını dön (ama Accept-Ranges bildir)
    def full_file_iterator(filepath):
        with open(filepath, 'rb') as f:
            while True:
                data = f.read(65536)
                if not data:
                    break
                yield data

    resp = StreamingHttpResponse(
        full_file_iterator(full),
        content_type=content_type,
    )
    resp['Content-Length'] = file_size
    resp['Accept-Ranges'] = 'bytes'
    resp['Cache-Control'] = 'public, max-age=3600'
    resp['Access-Control-Allow-Origin'] = '*'
    resp['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
    resp['Access-Control-Allow-Headers'] = 'Range, Content-Type'
    resp['Access-Control-Expose-Headers'] = 'Content-Range, Accept-Ranges, Content-Length'
    return resp

urlpatterns += [re_path(r'^media/(?P<path>.*)$', _serve_media)]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# SPA catch-all: serve React index.html for all non-API, non-admin, non-static paths.
# This must come LAST so it doesn't shadow API or admin routes.
from django.http import FileResponse, HttpResponse, Http404


def _serve_from_static(request, path):
    """Serve files referenced at root (e.g. /assets/*, /favicon.svg, /mining-worker.js).
    WhiteNoise (WHITENOISE_ROOT) normally handles these before URL routing runs —
    this view is a fallback only. Adds long-lived cache headers for hashed assets."""
    import gzip as _gzip

    accept_enc = request.META.get('HTTP_ACCEPT_ENCODING', '')
    want_gzip = 'gzip' in accept_enc

    candidates = list(settings.STATICFILES_DIRS) + [settings.STATIC_ROOT]
    for root in candidates:
        root = str(root)
        full = os.path.normpath(os.path.join(root, path))
        if not full.startswith(root):
            continue
        if not os.path.exists(full) or not os.path.isfile(full):
            continue

        content_type, _ = mimetypes.guess_type(full)
        content_type = content_type or 'application/octet-stream'

        # Content-hash'li dosyalar (e.g. index-CJg2NGgO.js) → 1 yıl cache
        import re as _re
        is_hashed = bool(_re.search(r'-[A-Za-z0-9_]{8,}\.(js|css|woff2?|png|svg|jpg)$', path))
        cache_ctrl = 'public, max-age=31536000, immutable' if is_hashed else 'public, max-age=3600'

        # Gzip varsa sun
        gz_path = full + '.gz'
        if want_gzip and os.path.exists(gz_path):
            resp = FileResponse(open(gz_path, 'rb'), content_type=content_type)
            resp['Content-Encoding'] = 'gzip'
            resp['Vary'] = 'Accept-Encoding'
            resp['Cache-Control'] = cache_ctrl
            return resp

        resp = FileResponse(open(full, 'rb'), content_type=content_type)
        resp['Cache-Control'] = cache_ctrl
        return resp
    raise Http404


_LINK_HEADER = (
    '</.well-known/api-catalog>; rel="api-catalog", '
    '</api/healthz>; rel="service-desc", '
    '</sitemap.xml>; rel="sitemap"'
)

def spa_index(request, *args, **kwargs):
    index_path = os.path.join(settings.STATICFILES_DIRS[0] if settings.STATICFILES_DIRS else settings.STATIC_ROOT, 'index.html')
    if os.path.exists(index_path):
        resp = FileResponse(open(index_path, 'rb'), content_type='text/html')
        resp["Link"] = _LINK_HEADER
        resp["Cache-Control"] = "no-cache, no-store, must-revalidate"
        resp["Pragma"] = "no-cache"
        resp["Expires"] = "0"
        return resp
    resp = HttpResponse(
        '<!DOCTYPE html><html><body>'
        '<h2>Soci API is running ✓</h2>'
        '<p>React frontend not built yet. Run <code>npm run build</code> in the '
        'frontend directory and copy <code>dist/</code> contents to '
        '<code>staticfiles/</code>.</p>'
        '<p>API base: <a href="/api/healthz">/api/healthz</a></p>'
        '</body></html>',
        content_type='text/html',
        status=200,
    )
    resp["Link"] = _LINK_HEADER
    return resp


def _serve_sw(request):
    """sw.js her zaman no-cache — tarayıcı SW güncellemesini anında algılar."""
    candidates = list(settings.STATICFILES_DIRS) + [settings.STATIC_ROOT]
    for root in candidates:
        full = os.path.join(str(root), 'sw.js')
        if os.path.exists(full):
            resp = FileResponse(open(full, 'rb'), content_type='application/javascript')
            resp['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            resp['Pragma'] = 'no-cache'
            resp['Expires'] = '0'
            return resp
    raise Http404

urlpatterns += [
    re_path(r'^sw\.js$', _serve_sw),
    re_path(r'^(?P<path>assets/.+)$', _serve_from_static),
    re_path(r'^(?P<path>favicon\.[a-zA-Z0-9]+)$', _serve_from_static),
    re_path(r'^(?P<path>mining-worker\.js)$', _serve_from_static),
    re_path(r'^(?P<path>opengraph\.[a-zA-Z]+)$', _serve_from_static),
    # Video sayfalari - server-side OG meta + JSON-LD enjeksiyonu
    re_path(r'^videos/(?P<slug>[\w.-]+)$', video_seo_page),
    # SPA catch-all - auth.md ve well-known disindaki her sey
    re_path(r'^(?!api/|django-admin/|static/|media/|assets/|auth\.md$|\.well-known/).*$', global_seo_page),
]
