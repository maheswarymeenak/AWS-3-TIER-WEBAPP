import os
import uuid
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pymysql
import pymysql.cursors
from werkzeug.security import generate_password_hash, check_password_hash
import secrets

app = Flask(__name__)
CORS(app, supports_credentials=True)

# ======================================================================
# DATABASE CONFIG -- EDIT THESE 4 LINES WITH YOUR RDS DETAILS
# ======================================================================
DB_HOST = "database-1.chs2ekm0ef29.ap-southeast-1.rds.amazonaws.com"
DB_USER = "admin"
DB_PASSWORD = "Welcomeaws123"
DB_NAME = "social_app"
# ======================================================================

# ---------------- media upload config ----------------
UPLOAD_FOLDER = "uploads"
ALLOWED_IMAGE_EXT = {"png", "jpg", "jpeg", "gif", "webp"}
ALLOWED_VIDEO_EXT = {"mp4", "webm", "mov", "avi"}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB max upload


def media_kind(filename):
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ALLOWED_IMAGE_EXT:
        return "image"
    if ext in ALLOWED_VIDEO_EXT:
        return "video"
    return None


def get_db():
    return pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True
    )

# in-memory token store: { token: user_id }  (simple, resets when app restarts)
tokens = {}

def current_user_id():
    token = request.headers.get("Authorization")
    if not token:
        return None
    return tokens.get(token)


# ---------------- REGISTER ----------------
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(force=True)
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    hashed = generate_password_hash(password)
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE username=%s", (username,))
            if cur.fetchone():
                return jsonify({"error": "Username already exists"}), 400
            cur.execute(
                "INSERT INTO users (username, password) VALUES (%s, %s)",
                (username, hashed)
            )
        return jsonify({"message": "Registered successfully"})
    finally:
        conn.close()


# ---------------- LOGIN ----------------
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE username=%s", (username,))
            user = cur.fetchone()
        if not user or not check_password_hash(user["password"], password):
            return jsonify({"error": "Invalid username or password"}), 401

        token = secrets.token_hex(16)
        tokens[token] = user["id"]
        return jsonify({"message": "Login successful", "username": user["username"], "token": token})
    finally:
        conn.close()


# ---------------- LOGOUT ----------------
@app.route("/api/logout", methods=["POST"])
def logout():
    token = request.headers.get("Authorization")
    tokens.pop(token, None)
    return jsonify({"message": "Logged out"})


# ---------------- ME (check session) ----------------
@app.route("/api/me", methods=["GET"])
def me():
    uid = current_user_id()
    if not uid:
        return jsonify({"logged_in": False})
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT username FROM users WHERE id=%s", (uid,))
            user = cur.fetchone()
        return jsonify({"logged_in": True, "username": user["username"]})
    finally:
        conn.close()


# ---------------- SERVE UPLOADED MEDIA ----------------
@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


# ---------------- GET ALL POSTS ----------------
@app.route("/api/posts", methods=["GET"])
def get_posts():
    uid = current_user_id()
    if not uid:
        return jsonify({"error": "Please login"}), 401

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT p.id, p.content, p.media_url, p.media_type, p.created_at, u.username,
                    (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
                    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
                    (SELECT COUNT(*) FROM likes l2 WHERE l2.post_id = p.id AND l2.user_id = %s) AS liked_by_me
                FROM posts p
                JOIN users u ON p.user_id = u.id
                ORDER BY p.created_at DESC
            """, (uid,))
            posts = cur.fetchall()

        for p in posts:
            p["liked_by_me"] = bool(p["liked_by_me"])
            p["created_at"] = p["created_at"].strftime("%d %b %Y, %I:%M %p")
        return jsonify(posts)
    finally:
        conn.close()


# ---------------- CREATE POST (text + optional photo/video) ----------------
@app.route("/api/posts", methods=["POST"])
def create_post():
    uid = current_user_id()
    if not uid:
        return jsonify({"error": "Please login"}), 401

    # now sent as multipart/form-data so a file can travel alongside the text
    content = (request.form.get("content") or "").strip()
    file = request.files.get("media")

    media_url = None
    media_type = None

    if file and file.filename:
        kind = media_kind(file.filename)
        if not kind:
            return jsonify({"error": "Unsupported file type. Use jpg, png, gif, webp, mp4, webm or mov."}), 400
        ext = file.filename.rsplit(".", 1)[-1].lower()
        filename = f"{uuid.uuid4().hex}.{ext}"
        file.save(os.path.join(UPLOAD_FOLDER, filename))
        media_url = f"/uploads/{filename}"
        media_type = kind

    if not content and not media_url:
        return jsonify({"error": "Post cannot be empty"}), 400

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO posts (user_id, content, media_url, media_type) VALUES (%s, %s, %s, %s)",
                (uid, content, media_url, media_type)
            )
        return jsonify({"message": "Posted successfully"})
    finally:
        conn.close()


# ---------------- LIKE / UNLIKE POST ----------------
@app.route("/api/posts/<int:post_id>/like", methods=["POST"])
def like_post(post_id):
    uid = current_user_id()
    if not uid:
        return jsonify({"error": "Please login"}), 401

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM likes WHERE post_id=%s AND user_id=%s",
                (post_id, uid)
            )
            existing = cur.fetchone()
            if existing:
                cur.execute("DELETE FROM likes WHERE id=%s", (existing["id"],))
                liked = False
            else:
                cur.execute(
                    "INSERT INTO likes (post_id, user_id) VALUES (%s, %s)",
                    (post_id, uid)
                )
                liked = True
        return jsonify({"liked": liked})
    finally:
        conn.close()


# ---------------- WHO LIKED A POST ----------------
@app.route("/api/posts/<int:post_id>/likes", methods=["GET"])
def get_likes(post_id):
    uid = current_user_id()
    if not uid:
        return jsonify({"error": "Please login"}), 401

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.username FROM likes l
                JOIN users u ON l.user_id = u.id
                WHERE l.post_id = %s
                ORDER BY l.created_at DESC
            """, (post_id,))
            rows = cur.fetchall()
        return jsonify([r["username"] for r in rows])
    finally:
        conn.close()


# ---------------- GET COMMENTS ----------------
@app.route("/api/posts/<int:post_id>/comments", methods=["GET"])
def get_comments(post_id):
    uid = current_user_id()
    if not uid:
        return jsonify({"error": "Please login"}), 401

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT c.content, c.created_at, u.username
                FROM comments c
                JOIN users u ON c.user_id = u.id
                WHERE c.post_id = %s
                ORDER BY c.created_at ASC
            """, (post_id,))
            rows = cur.fetchall()
        for r in rows:
            r["created_at"] = r["created_at"].strftime("%d %b %Y, %I:%M %p")
        return jsonify(rows)
    finally:
        conn.close()


# ---------------- ADD COMMENT ----------------
@app.route("/api/posts/<int:post_id>/comments", methods=["POST"])
def add_comment(post_id):
    uid = current_user_id()
    if not uid:
        return jsonify({"error": "Please login"}), 401

    data = request.get_json(force=True)
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify({"error": "Comment cannot be empty"}), 400

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO comments (post_id, user_id, content) VALUES (%s, %s, %s)",
                (post_id, uid, content)
            )
        return jsonify({"message": "Comment added"})
    finally:
        conn.close()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
