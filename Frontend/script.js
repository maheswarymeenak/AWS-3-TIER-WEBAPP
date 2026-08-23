// ====================================================================
// IMPORTANT: change this to YOUR EC2 public IP (the backend/Flask server)
// Example: const API_BASE = "http://13.234.56.78:5000";
// ====================================================================


const API_BASE = "http://load-balancer-backend-1688424677.ap-southeast-1.elb.amazonaws.com";
let currentUser = null;

// ---------------- helpers ----------------
function getToken(){ return localStorage.getItem("pc_token"); }
function setToken(t){ localStorage.setItem("pc_token", t); }
function clearToken(){ localStorage.removeItem("pc_token"); }

async function api(path, method="GET", body=null){
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if(token) headers["Authorization"] = token;

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok){ throw new Error(data.error || "Something went wrong"); }
  return data;
}

// same as api(), but sends FormData (used when a photo/video is attached)
async function apiForm(path, method, formData){
  const headers = {};
  const token = getToken();
  if(token) headers["Authorization"] = token;

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: formData
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok){ throw new Error(data.error || "Something went wrong"); }
  return data;
}

function showToast(msg){
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(()=> toast.classList.add("hidden"), 2200);
}

function initialsOf(name){
  return name ? name.charAt(0).toUpperCase() : "?";
}

function timeAgoOrRaw(t){ return t; }

// ---------------- tab switching (login/register) ----------------
document.querySelectorAll(".tab-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("loginForm").classList.toggle("hidden", tab!=="login");
    document.getElementById("registerForm").classList.toggle("hidden", tab!=="register");
  });
});

// ---------------- register ----------------
document.getElementById("registerForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value;
  const msgEl = document.getElementById("regMsg");
  try{
    await api("/api/register", "POST", { username, password });
    msgEl.textContent = "Account created! You can login now 🎉";
    msgEl.classList.add("success");
    document.getElementById("registerForm").reset();
  }catch(err){
    msgEl.classList.remove("success");
    msgEl.textContent = err.message;
  }
});

// ---------------- login ----------------
document.getElementById("loginForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  const msgEl = document.getElementById("loginMsg");
  try{
    const data = await api("/api/login", "POST", { username, password });
    setToken(data.token);
    currentUser = data.username;
    enterApp();
  }catch(err){
    msgEl.textContent = err.message;
  }
});

// ---------------- logout ----------------
document.getElementById("logoutBtn").addEventListener("click", ()=>{
  clearToken();
  currentUser = null;
  document.getElementById("appScreen").classList.add("hidden");
  document.getElementById("authScreen").classList.remove("hidden");
});

// ---------------- enter app ----------------
async function enterApp(){
  document.getElementById("authScreen").classList.add("hidden");
  document.getElementById("appScreen").classList.remove("hidden");
  document.getElementById("welcomeUser").textContent = "Hi, " + currentUser + " 👋";
  document.getElementById("myAvatar").textContent = initialsOf(currentUser);
  await loadPosts();
}

// ---------------- check existing session on page load ----------------
window.addEventListener("DOMContentLoaded", async ()=>{
  const token = getToken();
  if(!token) return;
  try{
    const data = await api("/api/me");
    if(data.logged_in){
      currentUser = data.username;
      enterApp();
    }
  }catch(err){ clearToken(); }
});

// ---------------- media attach (photo/video) ----------------
let selectedMedia = null;

const mediaInput = document.getElementById("mediaInput");
const mediaPreviewWrap = document.getElementById("mediaPreviewWrap");
const mediaPreviewImg = document.getElementById("mediaPreviewImg");
const mediaPreviewVideo = document.getElementById("mediaPreviewVideo");
const removeMediaBtn = document.getElementById("removeMediaBtn");

mediaInput.addEventListener("change", ()=>{
  const file = mediaInput.files[0];
  if(!file) return;
  selectedMedia = file;

  const url = URL.createObjectURL(file);
  if(file.type.startsWith("video/")){
    mediaPreviewVideo.src = url;
    mediaPreviewVideo.classList.remove("hidden");
    mediaPreviewImg.classList.add("hidden");
  }else{
    mediaPreviewImg.src = url;
    mediaPreviewImg.classList.remove("hidden");
    mediaPreviewVideo.classList.add("hidden");
  }
  mediaPreviewWrap.classList.remove("hidden");
});

removeMediaBtn.addEventListener("click", ()=>{
  selectedMedia = null;
  mediaInput.value = "";
  mediaPreviewWrap.classList.add("hidden");
  mediaPreviewImg.src = "";
  mediaPreviewVideo.src = "";
});

// ---------------- create post ----------------
document.getElementById("postBtn").addEventListener("click", async ()=>{
  const textarea = document.getElementById("postContent");
  const content = textarea.value.trim();
  if(!content && !selectedMedia) return;

  const formData = new FormData();
  formData.append("content", content);
  if(selectedMedia) formData.append("media", selectedMedia);

  try{
    await apiForm("/api/posts", "POST", formData);
    textarea.value = "";
    removeMediaBtn.click();
    showToast("Posted! ✨");
    await loadPosts();
  }catch(err){ showToast(err.message); }
});

// ---------------- load & render posts ----------------
async function loadPosts(){
  const feed = document.getElementById("feed");
  try{
    const posts = await api("/api/posts");
    if(posts.length === 0){
      feed.innerHTML = '<p class="empty-state">No posts yet. Be the first to share something 💜</p>';
      return;
    }
    feed.innerHTML = posts.map(renderPost).join("");
    attachPostEvents();
  }catch(err){
    feed.innerHTML = '<p class="empty-state">' + err.message + '</p>';
  }
}

function renderPost(p){
  return `
  <div class="post-card" data-id="${p.id}">
    <div class="post-header">
      <div class="avatar">${initialsOf(p.username)}</div>
      <div>
        <strong>${escapeHtml(p.username)}</strong>
        <span class="post-time">${p.created_at}</span>
      </div>
    </div>
    ${p.content ? `<p class="post-content">${escapeHtml(p.content)}</p>` : ""}
    ${renderMedia(p)}
    <div class="post-actions">
      <button class="action-btn like-btn ${p.liked_by_me ? "liked" : ""}">
        <span class="heart-icon">${p.liked_by_me ? "💜" : "🤍"}</span> Like (<span class="like-count">${p.like_count}</span>)
      </button>
      <button class="action-btn comment-toggle-btn">💬 Comment (<span class="comment-count">${p.comment_count}</span>)</button>
    </div>
    <div class="meta-links">
      <button class="meta-link view-likers-btn">See who liked</button>
    </div>
    <div class="comments-section hidden">
      <div class="comments-list">Loading...</div>
      <div class="comment-input-row">
        <input type="text" class="comment-input" placeholder="Write a comment...">
        <button class="send-comment-btn">Send</button>
      </div>
    </div>
  </div>`;
}

function renderMedia(p){
  if(!p.media_url) return "";
  const src = API_BASE + p.media_url;
  if(p.media_type === "video"){
    return `<video class="post-media" controls src="${src}"></video>`;
  }
  return `<img class="post-media" src="${src}" alt="post media">`;
}

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function attachPostEvents(){
  document.querySelectorAll(".post-card").forEach(card=>{
    const postId = card.dataset.id;

    // like button
    card.querySelector(".like-btn").addEventListener("click", async ()=>{
      try{
        const data = await api(`/api/posts/${postId}/like`, "POST");
        const btn = card.querySelector(".like-btn");
        const countEl = card.querySelector(".like-count");
        let count = parseInt(countEl.textContent);
        if(data.liked){
          btn.classList.add("liked");
          btn.querySelector(".heart-icon").textContent = "💜";
          count++;
        }else{
          btn.classList.remove("liked");
          btn.querySelector(".heart-icon").textContent = "🤍";
          count--;
        }
        countEl.textContent = count;
      }catch(err){ showToast(err.message); }
    });

    // toggle comments
    card.querySelector(".comment-toggle-btn").addEventListener("click", async ()=>{
      const section = card.querySelector(".comments-section");
      section.classList.toggle("hidden");
      if(!section.classList.contains("hidden")){
        await loadComments(postId, card);
      }
    });

    // send comment
    card.querySelector(".send-comment-btn").addEventListener("click", ()=> sendComment(postId, card));
    card.querySelector(".comment-input").addEventListener("keypress", (e)=>{
      if(e.key === "Enter") sendComment(postId, card);
    });

    // view likers modal
    card.querySelector(".view-likers-btn").addEventListener("click", ()=> showLikersModal(postId));
  });
}

async function loadComments(postId, card){
  const list = card.querySelector(".comments-list");
  try{
    const comments = await api(`/api/posts/${postId}/comments`);
    if(comments.length === 0){
      list.innerHTML = '<p style="font-size:12px;color:#a78bfa;">No comments yet. Say something nice 🌸</p>';
      return;
    }
    list.innerHTML = comments.map(c => `
      <div class="comment-item">
        <b>${escapeHtml(c.username)}</b>: ${escapeHtml(c.content)}
        <span class="comment-time">${c.created_at}</span>
      </div>`).join("");
  }catch(err){
    list.innerHTML = '<p style="font-size:12px;color:#dc2626;">' + err.message + '</p>';
  }
}

async function sendComment(postId, card){
  const input = card.querySelector(".comment-input");
  const content = input.value.trim();
  if(!content) return;
  try{
    await api(`/api/posts/${postId}/comments`, "POST", { content });
    input.value = "";
    await loadComments(postId, card);
    const countEl = card.querySelector(".comment-count");
    countEl.textContent = parseInt(countEl.textContent) + 1;
  }catch(err){ showToast(err.message); }
}

// ---------------- likers modal ----------------
async function showLikersModal(postId){
  const modal = document.getElementById("modal");
  const title = document.getElementById("modalTitle");
  const body = document.getElementById("modalBody");
  title.textContent = "People who liked this 💜";
  body.innerHTML = "Loading...";
  modal.classList.remove("hidden");
  try{
    const likers = await api(`/api/posts/${postId}/likes`);
    if(likers.length === 0){
      body.innerHTML = '<p class="empty-state">No likes yet. Be the first! 🤍</p>';
      return;
    }
    body.innerHTML = likers.map(name => `
      <div class="liker-item">
        <div class="avatar" style="width:32px;height:32px;font-size:13px;">${initialsOf(name)}</div>
        ${escapeHtml(name)}
      </div>`).join("");
  }catch(err){
    body.innerHTML = '<p class="empty-state">' + err.message + '</p>';
  }
}

document.getElementById("modalClose").addEventListener("click", ()=>{
  document.getElementById("modal").classList.add("hidden");
});
document.getElementById("modal").addEventListener("click", (e)=>{
  if(e.target.id === "modal") document.getElementById("modal").classList.add("hidden");
});
