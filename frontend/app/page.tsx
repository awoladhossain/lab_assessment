"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "./context/AuthContext";
import { useRouter } from "next/navigation";
import { Post, Comment, apiRequest } from "./utils/api";
import Link from "next/link";

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? "minute" : "minutes"} ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
  return date.toLocaleDateString();
}

export default function FeedPage() {
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Feed and post creation states
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostText, setNewPostText] = useState("");
  const [newPostVisibility, setNewPostVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Comment and reply inputs state
  // Key format: post_{postId} for post comments, comment_{commentId} for comment replies
  const [commentTexts, setCommentTexts] = useState<{ [key: string]: string }>({});
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);

  // UI state
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [openPostDropdownId, setOpenPostDropdownId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editVisibility, setEditVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Hover states for tooltips (who liked)
  // Key format: post_{postId} or comment_{commentId} or reply_{replyId}
  const [hoveredLikesKey, setHoveredLikesKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    setIsDarkMode(savedMode === "true");
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem("darkMode", String(newMode));
  };

  const toggleNotificationDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowNotificationDropdown(!showNotificationDropdown);
    setShowProfileDropdown(false);
  };

  const toggleProfileDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowProfileDropdown(!showProfileDropdown);
    setShowNotificationDropdown(false);
  };


  const fetchFeed = async () => {
    try {
      const data = await apiRequest<{ posts: Post[] }>("posts");
      setPosts(data.posts || []);
    } catch (err) {
      console.error("Failed to fetch feed:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchFeed();
    }
  }, [user]);

  // Global click handler to close dropdowns when clicking outside
  useEffect(() => {
    const handleGlobalClick = () => {
      setShowProfileDropdown(false);
      setShowNotificationDropdown(false);
      setOpenPostDropdownId(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
    };
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim() && !selectedImage) return;

    try {
      const formData = new FormData();
      formData.append("text", newPostText.trim());
      formData.append("visibility", newPostVisibility);
      if (selectedImage) {
        formData.append("image", selectedImage);
      }

      await apiRequest("posts", {
        method: "POST",
        body: formData,
      }, true);

      setNewPostText("");
      setSelectedImage(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchFeed();
    } catch (err) {
      console.error("Error creating post:", err);
    }
  };

  const handleToggleLikePost = async (postId: string) => {
    try {
      await apiRequest(`posts/${postId}/like`, {
        method: "POST",
      });
      fetchFeed();
    } catch (err) {
      console.error("Error toggling post like:", err);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;
    try {
      await apiRequest(`posts/${postId}`, {
        method: "DELETE",
      });
      fetchFeed();
    } catch (err) {
      console.error("Error deleting post:", err);
    }
  };

  const handleUpdatePost = async (postId: string) => {
    if (!editText.trim()) return;
    try {
      await apiRequest(`posts/${postId}`, {
        method: "PUT",
        body: JSON.stringify({
          text: editText.trim(),
          visibility: editVisibility,
        }),
      });
      setEditingPostId(null);
      fetchFeed();
    } catch (err) {
      console.error("Error updating post:", err);
    }
  };

  const handleAddComment = async (postId: string, parentId: string | null = null) => {
    const inputKey = parentId ? `comment_${parentId}` : `post_${postId}`;
    const text = commentTexts[inputKey];
    if (!text || !text.trim()) return;

    try {
      await apiRequest("comments", {
        method: "POST",
        body: JSON.stringify({
          postId,
          text: text.trim(),
          parentId,
        }),
      });

      setCommentTexts((prev) => ({ ...prev, [inputKey]: "" }));
      setReplyingToCommentId(null);
      fetchFeed();
    } catch (err) {
      console.error("Error adding comment:", err);
    }
  };

  const handleToggleLikeComment = async (commentId: string) => {
    try {
      await apiRequest(`comments/${commentId}/like`, { method: "POST" });
      fetchFeed();
    } catch (err) {
      console.error("Error toggling comment like:", err);
    }
  };

  const getFullImageUrl = (path: string | null) => {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }
    const baseUrl = process.env.NEXT_PUBLIC_API_URL 
      ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, "")
      : "http://localhost:5050";
    return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  };

  const handleLogoutClick = (e: React.MouseEvent) => {
    e.preventDefault();
    logout();
  };

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Filter posts based on search input query
  const filteredPosts = posts.filter((post) =>
    post.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`_layout _layout_main_wrapper ${isDarkMode ? "_dark_wrapper" : ""}`}>
      {/* Desktop Menu Start */}
      <nav className="navbar navbar-expand-lg navbar-light _header_nav _padd_t10">
        <div className="container _custom_container">
          <div className="_logo_wrap">
            <Link className="navbar-brand" href="/">
              <img src="/assets/images/logo.svg" alt="Image" className="_nav_logo" />
            </Link>
          </div>
          <button
            className="navbar-toggler bg-light"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarSupportedContent"
            aria-controls="navbarSupportedContent"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarSupportedContent">
            <div className="_header_form ms-auto">
              <form className="_header_form_grp" onSubmit={(e) => e.preventDefault()}>
                <svg
                  className="_header_form_svg"
                  xmlns="http://www.w3.org/2000/svg"
                  width="17"
                  height="17"
                  fill="none"
                  viewBox="0 0 17 17"
                >
                  <circle cx="7" cy="7" r="6" stroke="#666" />
                  <path stroke="#666" strokeLinecap="round" d="M16 16l-3-3" />
                </svg>
                <input
                  className="form-control me-2 _inpt1"
                  type="search"
                  placeholder="input search text"
                  aria-label="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </form>
            </div>
            <ul className="navbar-nav mb-2 mb-lg-0 _header_nav_list ms-auto _mar_r8">
              <li className="nav-item _header_nav_item">
                <Link className="nav-link _header_nav_link_active _header_nav_link" href="/">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="21" fill="none" viewBox="0 0 18 21">
                    <path
                      className="_home_active"
                      stroke="#000"
                      strokeWidth="1.5"
                      strokeOpacity=".6"
                      d="M1 9.924c0-1.552 0-2.328.314-3.01.313-.682.902-1.187 2.08-2.196l1.143-.98C6.667 1.913 7.732 1 9 1c1.268 0 2.333.913 4.463 2.738l1.142.98c1.179 1.01 1.768 1.514 2.081 2.196.314.682.314 1.458.314 3.01v4.846c0 2.155 0 3.233-.67 3.902-.669.67-1.746.67-3.901.67H5.57c-2.155 0-3.232 0-3.902-.67C1 18.002 1 16.925 1 14.77V9.924z"
                    />
                    <path
                      className="_home_active"
                      stroke="#000"
                      strokeOpacity=".6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M11.857 19.341v-5.857a1 1 0 00-1-1H7.143a1 1 0 00-1 1v5.857"
                    />
                  </svg>
                </Link>
              </li>
              <li className="nav-item _header_nav_item">
                <Link className="nav-link _header_nav_link" href="/friend-request.html">
                  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="20" fill="none" viewBox="0 0 26 20">
                    <path
                      fill="#000"
                      fillOpacity=".6"
                      fillRule="evenodd"
                      d="M12.79 12.15h.429c2.268.015 7.45.243 7.45 3.732 0 3.466-5.002 3.692-7.415 3.707h-.894c-2.268-.015-7.452-.243-7.452-3.727 0-3.47 5.184-3.697 7.452-3.711l.297-.001h.132zm0 1.75c-2.792 0-6.12.34-6.12 1.962 0 1.585 3.13 1.955 5.864 1.976l.255.002c2.792 0 6.118-.34 6.118-1.958 0-1.638-3.326-1.982-6.118-1.982zm9.343-2.224c2.846.424 3.444 1.751 3.444 2.79 0 .636-.251 1.794-1.931 2.43a.882.882 0 01-1.137-.506.873.873 0 01.51-1.13c.796-.3.796-.633.796-.793 0-.511-.654-.868-1.944-1.06a.878.878 0 01-.741-.996.886.886 0 011.003-.735zm-17.685.735a.878.878 0 01-.742.997c-1.29.19-1.944.548-1.944 1.059 0 .16 0 .491.798.793a.873.873 0 01-.314 1.693.897.897 0 01-.313-.057C.25 16.259 0 15.1 0 14.466c0-1.037.598-2.366 3.446-2.79.485-.06.929.257 1.002.735zM12.789 0c2.96 0 5.368 2.392 5.368 5.33 0 2.94-2.407 5.331-5.368 5.331h-.031a5.329 5.329 0 01-3.782-1.57 5.253 5.253 0 01-1.553-3.764C7.423 2.392 9.83 0 12.789 0zm0 1.75c-1.987 0-3.604 1.607-3.604 3.58a3.526 3.526 0 001.04 2.527 3.58 3.58 0 002.535 1.054l.03.875v-.875c1.987 0 3.605-1.605 3.605-3.58S14.777 1.75 12.789 1.75zm7.27-.607a4.222 4.222 0 013.566 4.172c-.004 2.094-1.58 3.89-3.665 4.181a.88 8.88 0 01-.994-.745.875.875 0 01.75-.989 2.494 2.494 0 002.147-2.45 2.473 2.473 0 00-2.09-2.443.876.876 0 01-.726-1.005.881.881 0 011.013-.721zm-13.528.72a.876.876 0 01-.726 1.006 2.474 2.474 0 00-2.09 2.446A2.493 2.493 0 005.86 7.762a.875.875 0 11-.243 1.734c-2.085-.29-3.66-2.087-3.664-4.179 0-2.082 1.5-3.837 3.566-4.174a.876.876 0 011.012.72z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Link>
              </li>
              <li className="nav-item _header_nav_item">
                <span
                  id="_notify_btn"
                  className="nav-link _header_nav_link _header_notify_btn"
                  onClick={toggleNotificationDropdown}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="22" fill="none" viewBox="0 0 20 22">
                    <path
                      fill="#000"
                      fillOpacity=".6"
                      fillRule="evenodd"
                      d="M7.547 19.55c.533.59 1.218.915 1.93.915.714 0 1.403-.324 1.938-.916a.777.777 0 011.09-.056c.318.284.344.77.058 1.084-.832.917-1.927 1.423-3.086 1.423h-.002c-1.155-.001-2.248-.506-3.077-1.424a.762.762 0 01.057-1.083.774.774 0 011.092.057zM9.527 0c4.58 0 7.657 3.543 7.657 6.85 0 1.702.436 2.424.899 3.19.457.754.976 1.612.976 3.233-.36 4.14-4.713 4.478-9.531 4.478-4.818 0-9.172-.337-9.528-4.413-.003-1.686.515-2.544.973-3.299l.161-.27c.398-.679.737-1.417.737-2.918C1.871 3.543 4.948 0 9.528 0zm0 1.535c-3.6 0-6.11 2.802-6.11 5.316 0 2.127-.595 3.11-1.12 3.978-.422.697-.755 1.247-.755 2.444.173 1.93 1.455 2.944 7.986 2.944 6.494 0 7.817-1.06 7.988-3.01-.003-1.13-.336-1.681-.757-2.378-.526-.868-1.12-1.851-1.12-3.978 0-2.514-2.51-5.316-6.111-5.316z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="_counting">6</span>
                  <div
                    id="_notify_drop"
                    className={`_notification_dropdown ${showNotificationDropdown ? "show" : ""}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="_notifications_content">
                      <h4 className="_notifications_content_title">Notifications</h4>
                      <div className="_notification_box_right">
                        <button type="button" className="_notification_box_right_link">
                          <svg xmlns="http://www.w3.org/2000/svg" width="4" height="17" fill="none" viewBox="0 0 4 17">
                            <circle cx="2" cy="2" r="2" fill="#C4C4C4"></circle>
                            <circle cx="2" cy="8" r="2" fill="#C4C4C4"></circle>
                            <circle cx="2" cy="15" r="2" fill="#C4C4C4"></circle>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="_notifications_drop_box">
                      <div className="_notifications_drop_btn_grp">
                        <button className="_notifications_btn_link">All</button>
                        <button className="_notifications_btn_link1">Unread</button>
                      </div>
                      <div className="_notifications_all" style={{ maxHeight: "300px", overflowY: "auto" }}>
                        <div className="_notification_box">
                          <div className="_notification_image">
                            <img src="/assets/images/friend-req.png" alt="Image" className="_notify_img" />
                          </div>
                          <div className="_notification_txt">
                            <p className="_notification_para">
                              <span className="_notify_txt_link">Steve Jobs</span> posted a link in your timeline.
                            </p>
                            <div className="_nitification_time">
                              <span>42 minutes ago</span>
                            </div>
                          </div>
                        </div>
                        <div className="_notification_box">
                          <div className="_notification_image">
                            <img src="/assets/images/profile-1.png" alt="Image" className="_notify_img" />
                          </div>
                          <div className="_notification_txt">
                            <p className="_notification_para">
                              An admin changed the name of the group <span className="_notify_txt_link">Freelancer usa</span> to{" "}
                              <span className="_notify_txt_link">Freelancer usa </span>
                            </p>
                            <div className="_nitification_time">
                              <span>42 minutes ago</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </span>
              </li>
              <li className="nav-item _header_nav_item">
                <Link className="nav-link _header_nav_link" href="/chat">
                  <svg xmlns="http://www.w3.org/2000/svg" width="23" height="22" fill="none" viewBox="0 0 23 22">
                    <path
                      fill="#000"
                      fillOpacity=".6"
                      fillRule="evenodd"
                      d="M11.43 0c2.96 0 5.743 1.143 7.833 3.22 4.32 4.29 4.32 11.271 0 15.562C17.145 20.886 14.293 22 11.405 22c-1.575 0-3.16-.33-4.643-1.012-.437-.174-.847-.338-1.14-.338-.338.002-.793.158-1.232.308-.9.307-2.022.69-2.852-.131-.826-.822-.445-1.932-.138-2.826.152-.44.307-.895.307-1.239 0-.282-.137-.642-.347-1.161C-.57 11.46.322 6.47 3.596 3.22A11.04 11.04 0 0111.43 0zm0 1.535A9.5 9.5 0 004.69 4.307a9.463 9.463 0 00-1.91 10.686c.241.592.474 1.17.474 1.77 0 .598-.207 1.201-.39 1.733-.15.439-.378 1.1-.231 1.245.143.147.813-.085 1.255-.235.53-.18 1.133-.387 1.73-.391.597 0 1.161.225 1.758.463 3.655 1.679 7.98.915 10.796-1.881 3.655 3.655-1.881 3.693 3.716-3.693 3.716-9.7 0-13.391a9.5 9.5 0 00-6.74-2.77zm4.068 8.867c.57 0 1.03.458 1.03 1.024 0 .566-.46 1.023-1.03 1.023a1.023 1.023 0 11-.01-2.047h.01zm-4.131 0c.568 0 1.03.458 1.03 1.024 0 .566-.462 1.023-1.03 1.023a1.03 1.03 0 01-1.035-1.024c0-.566.455-1.023 1.025-1.023h.01zm-4.132 0c.568 0 1.03.458 1.03 1.024 0 .566-.462 1.023-1.03 1.023a1.022 1.022 0 11-.01-2.047h.01z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="_counting">2</span>
                </Link>
              </li>
            </ul>
            <div className="_header_nav_profile" onClick={(e) => e.stopPropagation()}>
              <div className="_header_nav_profile_image" onClick={toggleProfileDropdown}>
                <img src="/assets/images/txt_img.png" alt="Image" className="_nav_profile_img" style={{ cursor: "pointer" }} />
              </div>
              <div className="_header_nav_dropdown" onClick={toggleProfileDropdown}>
                <p className="_header_nav_para" style={{ cursor: "pointer" }}>
                  {user.firstName} {user.lastName}
                </p>
                <button id="_profile_drop_show_btn" className="_header_nav_dropdown_btn _dropdown_toggle" type="button">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="6" fill="none" viewBox="0 0 10 6">
                    <path
                      fill="#112032"
                      d="M5 5l.354.354L5 5.707l-.354-.353L5 5zm4.354-3.646l-4 4-.708-.708 4-4 .708.708zm-4.708 4l-4-4 .708-.708 4 4-.708.708z"
                    />
                  </svg>
                </button>
              </div>
              {/* Dropdown */}
              <div id="_prfoile_drop" className={`_nav_profile_dropdown _profile_dropdown ${showProfileDropdown ? "show" : ""}`}>
                <div className="_nav_profile_dropdown_info">
                  <div className="_nav_profile_dropdown_image">
                    <img src="/assets/images/txt_img.png" alt="Image" className="_nav_drop_img" />
                  </div>
                  <div className="_nav_profile_dropdown_info_txt">
                    <h4 className="_nav_dropdown_title">
                      {user.firstName} {user.lastName}
                    </h4>
                    <Link href="/profile" className="_nav_drop_profile">
                      View Profile
                    </Link>
                  </div>
                </div>
                <hr />
                <ul className="_nav_dropdown_list">
                  <li className="_nav_dropdown_list_item">
                    <Link href="#0" className="_nav_dropdown_link">
                      <div className="_nav_drop_info">
                        <span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="19" fill="none" viewBox="0 0 18 19">
                            <path
                              fill="#377DFF"
                              d="M9.584 0c.671 0 1.315.267 1.783.74.468.473.721 1.112.7 1.709l.009.14a.985.985 0 00.136.395c.145.242.382.418.659.488.276.071.57.03.849-.13l.155-.078c1.165-.538 2.563-.11 3.21.991l.58.99a.695.695 0 01.04.081l.055.107c.519 1.089.15 2.385-.838 3.043l-.244.15a1.046 1.046 0 00-.313.339 1.042 1.042 0 00-.11.805c.074.272.255.504.53.66l.158.1c.478.328.823.812.973 1.367.17.626.08 1.292-.257 1.86l-.625 1.022-.094.144c-.735 1.038-2.16 1.355-3.248.738l-.129-.066a1.123 1.123 0 00-.412-.095 1.087 1.087 0 00-.766.31c-.204.2-.317.471-.316.786l-.008.163C11.956 18.022 10.88 19 9.584 19h-1.17c-1.373 0-2.486-1.093-2.484-2.398l-.008-.14a.994.994 0 00-.14-.401 1.066 1.066 0 00-.652-.493 1.12 1.12 0 00-.852.127l-.169.083a2.526 2.526 0 01-1.698.122 2.47 2.47 0 01-1.488-1.154l-.604-1.024-.08-.152a2.404 2.404 0 01.975-3.132l.1-.061c.292-.199.467-.527.467-.877 0-.381-.207-.733-.569-.94l-.147-.092a2.419 2.419 0 01-.724-3.236l.615-.993a2.503 2.503 0 013.366-.912l.126.066c.13.058.269.089.403.09a1.08 1.08 0 001.086-1.068l.008-.185c.049-.57.301-1.106.713-1.513A2.5 2.5 0 018.414 0h1.17zm0 1.375h-1.17c-.287 0-.562.113-.764.312-.179.177-.288.41-.308.628l-.012.29c-.098 1.262-1.172 2.253-2.486 2.253a2.475 2.475 0 01-1.013-.231l-.182-.095a1.1 1.1 0 00-1.488.407l-.616.993a1.05 1.05 0 00.296 1.392l.247.153A2.43 2.43 0 013.181 9.5c0 .802-.401 1.552-1.095 2.023l-.147.091c-.486.276-.674.873-.448 1.342l.053.102.597 1.01c.14.248.374.431.652.509.246.069.51.05.714-.04l.103-.05a2.506 2.506 0 011.882-.248 2.456 2.456 0 011.823 2.1l.02.335c.059.535.52.95 1.079.95h1.17c.566 0 1.036-.427 1.08-.95l.005-.104a2.412 2.412 0 01.726-1.732 2.508 2.508 0 011.779-.713c.331.009.658.082.992.23l.3.15c.469.202 1.026.054 1.309-.344l.068-.105.61-1a1.045 1.045 0 00-.288-1.383l-.257-.16a2.435 2.435 0 01-1.006-1.389 2.393 2.393 0 01.25-1.847c.181-.31.429-.575.752-.795l.152-.095c.485-.278.672-.875.448-1.346l-.067-.127-.012-.027-.554-.945a1.095 1.095 0 00-1.27-.487l-.105.041-.098.049a2.515 2.515 0 01-1.88.259 2.47 2.47 0 01-1.511-1.122 2.367 2.367 0 01-.325-.97l-.012-.24a1.056 1.056 0 00-.307-.774 1.096 1.096 0 00-.779-.323zm-.58 5.02c1.744 0 3.16 1.39 3.16 3.105s-1.416 3.105-3.16 3.105c-1.746 0-3.161-1.39-3.161-3.105s1.415-3.105 3.16-3.105zm0 1.376c-.973 0-1.761.774-1.761 1.729 0 .955.788 1.73 1.76 1.73s1.76-.775 1.76-1.73-.788-1.73-1.76-1.73z"
                            />
                          </svg>
                        </span>
                        Settings
                      </div>
                      <button type="button" className="_nav_drop_btn_link border-0 bg-transparent">
                        <svg xmlns="http://www.w3.org/2000/svg" width="6" height="10" fill="none" viewBox="0 0 6 10">
                          <path
                            fill="#112032"
                            d="M5 5l.354.354L5.707 5l-.353-.354L5 5zM1.354 9.354l4-4-.708-.708-4 4 .708.708zm4-4.708l-4-4-.708.708 4 4 .708-.708z"
                            opacity=".5"
                          />
                        </svg>
                      </button>
                    </Link>
                  </li>
                  <li className="_nav_dropdown_list_item">
                    <Link href="#0" className="_nav_dropdown_link">
                      <div className="_nav_drop_info">
                        <span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 20 20">
                            <path stroke="#377DFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 19a9 9 0 100-18 9 9 0 000 18z" />
                            <path stroke="#377DFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7.38 7.3a2.7 2.7 0 015.248.9c0 1.8-2.7 2.7-2.7 2.7M10 14.5h.009" />
                          </svg>
                        </span>
                        Help & Support
                      </div>
                      <button type="button" className="_nav_drop_btn_link border-0 bg-transparent">
                        <svg xmlns="http://www.w3.org/2000/svg" width="6" height="10" fill="none" viewBox="0 0 6 10">
                          <path
                            fill="#112032"
                            d="M5 5l.354.354L5.707 5l-.353-.354L5 5zM1.354 9.354l4-4-.708-.708-4 4 .708.708zm4-4.708l-4-4-.708.708 4 4 .708-.708z"
                            opacity=".5"
                          />
                        </svg>
                      </button>
                    </Link>
                  </li>
                  <li className="_nav_dropdown_list_item">
                    <a href="#0" className="_nav_dropdown_link" onClick={handleLogoutClick}>
                      <div className="_nav_drop_info">
                        <span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" fill="none" viewBox="0 0 19 19">
                            <path
                              stroke="#377DFF"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.5"
                              d="M6.667 18H2.889A1.889 1.889 0 011 16.111V2.89A1.889 1.889 0 012.889 1h3.778M13.277 14.222L18 9.5l-4.723-4.722M18 9.5H6.667"
                            />
                          </svg>
                        </span>
                        Log Out
                      </div>
                      <button type="button" className="_nav_drop_btn_link border-0 bg-transparent">
                        <svg xmlns="http://www.w3.org/2000/svg" width="6" height="10" fill="none" viewBox="0 0 6 10">
                          <path
                            fill="#112032"
                            d="M5 5l.354.354L5.707 5l-.353-.354L5 5zM1.354 9.354l4-4-.708-.708-4 4 .708.708zm4-4.708l-4-4-.708.708 4 4 .708-.708z"
                            opacity=".5"
                          />
                        </svg>
                      </button>
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </nav>
      {/* Desktop Menu End */}

      {/* Mobile Menu Start */}
      <div className="_header_mobile_menu">
        <div className="_header_mobile_menu_wrap">
          <div className="container">
            <div className="_header_mobile_menu">
              <div className="row">
                <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                  <div className="_header_mobile_menu_top_inner">
                    <div className="_header_mobile_menu_logo">
                      <Link href="/" className="_mobile_logo_link">
                        <img src="/assets/images/logo.svg" alt="Image" className="_nav_logo" />
                      </Link>
                    </div>
                    <div className="_header_mobile_menu_right">
                      <form className="_header_form_grp" onSubmit={(e) => e.preventDefault()}>
                        <input
                          type="text"
                          className="form-control d-inline-block w-auto me-2 py-1 px-2 border-0 bg-light fs-8"
                          placeholder="Search..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <a href="#0" className="_header_mobile_search">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="17"
                            height="17"
                            fill="none"
                            viewBox="0 0 17 17"
                          >
                            <circle cx="7" cy="7" r="6" stroke="#666" />
                            <path stroke="#666" strokeLinecap="round" d="M16 16l-3-3" />
                          </svg>
                        </a>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Mobile Menu End */}

      {/* Main Body Section */}
      <div className="_layout_inner_wrap">
        <div className="container _custom_container">
          <div className="row">
            {/* Left Sidebar */}
            <div className="col-xl-3 col-lg-3 col-md-12 col-sm-12">
              <div className="_layout_left_sidebar_wrap">
                <div className="_layout_left_sidebar_inner">
                  <div className="_left_inner_area_explore _padd_t24 _padd_b6 _padd_r24 _padd_l24 _b_radious6 _feed_inner_area">
                    <h4 className="_left_inner_area_explore_title _title5 _mar_b24">Explore</h4>
                    <ul className="_left_inner_area_explore_list">
                      <li className="_left_inner_area_explore_item _explore_item">
                        <Link href="#0" className="_left_inner_area_explore_link">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 20 20">
                            <path
                              fill="#666"
                              d="M10 0c5.523 0 10 4.477 10 10s-4.477 10-10 10S0 15.523 0 10 4.477 0 10 0zm0 1.395a8.605 8.605 0 100 17.21 8.605 8.605 0 000-17.21zm-1.233 4.65l.104.01c.188.028.443.113.668.203 1.026.398 3.033 1.746 3.8 2.563l.223.239.08.092a1.16 1.16 0 01.025 1.405c-.04.053-.086.105-.19.215l-.269.28c-.812.794-2.57 1.971-3.569 2.391-.277.117-.675.25-.865.253a1.167 1.167 0 01-1.07-.629c-.053-.104-.12-.353-.171-.586l-.051-.262c-.093-.57-.143-1.437-.142-2.347l.001-.288c.01-.858.063-1.64.157-2.147.037-.207.12-.563.167-.678.104-.25.291-.45.523-.575a1.15 1.15 0 01.58-.14zm.14 1.467l-.027.126-.034.198c-.07.483-.112 1.233-.111 2.036l.001.279c.009.737.053 1.414.123 1.841l.048.235.192-.07c.883-.372 2.636-1.56 3.23-2.2l.08-.087-.212-.218c-.711-.682-2.38-1.79-3.167-2.095l-.124-.045z"
                            />
                          </svg>
                          Learning
                        </Link>
                        <span className="_left_inner_area_explore_link_txt">New</span>
                      </li>
                      <li className="_left_inner_area_explore_item">
                        <Link href="#0" className="_left_inner_area_explore_link">
                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="24" fill="none" viewBox="0 0 22 24">
                            <path
                              fill="#666"
                              d="M14.96 2c3.101 0 5.159 2.417 5.159 5.893v8.214c0 3.476-2.058 5.893-5.16 5.893H6.989c-3.101 0-5.159-2.417-5.159-5.893V7.893C1.83 4.42 3.892 2 6.988 2h7.972zm0 1.395H6.988c-2.37 0-3.883 1.774-3.883 4.498v8.214c0 2.727 1.507 4.498 3.883 4.498h7.972c2.375 0 3.883-1.77 3.883-4.498V7.893c0-2.727-1.508-4.498-3.883-4.498zM7.036 9.63c.323 0 .59.263.633.604l.005.094v6.382c0 .385-.285.697-.638.697-.323 0-.59-.262-.632-.603l-.006-.094v-6.382c0-.385.286-.697.638-.697zm3.97-3.053c.323 0 .59.262.632.603l.006.095v9.435c0 .385-.285.697-.638.697-.323 0-.59-.262-.632-.603l-.006-.094V7.274c0-.386.286-.698.638-.698zm3.905 6.426c.323 0 .59.262.632.603l.006.094v3.01c0 .385-.285.697-.638.697-.323 0-.59-.262-.632-.603l-.006-.094v-3.01c0-.385.286-.697.638-.697z"
                            />
                          </svg>
                          Insights
                        </Link>
                      </li>
                      <li className="_left_inner_area_explore_item">
                        <Link href="/friend-request.html" className="_left_inner_area_explore_link">
                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="24" fill="none" viewBox="0 0 22 24">
                            <path
                              fill="#666"
                              d="M9.032 14.456l.297.002c4.404.041 6.907 1.03 6.907 3.678 0 2.586-2.383 3.573-6.615 3.654l-.589.005c-4.588 0-7.203-.972-7.203-3.68 0-2.704 2.604-3.659 7.203-3.659zm0 1.5l-.308.002c-3.645.038-5.523.764-5.523 2.157 0 1.44 1.99 2.18 5.831 2.18 3.847 0 5.832-.728 5.832-2.159 0-1.44-1.99-2.18-5.832-2.18zm8.53-8.037c.347 0 .634.282.679.648l.006.102v1.255h1.185c.38 0 .686.336.686.75 0 .38-.258.694-.593.743l-.093.007h-1.185v1.255c0 .414-.307.75-.686.75-.347 0-.634-.282-.68-.648l-.005-.102-.001-1.255h-1.183c-.379 0-.686-.336-.686-.75 0-.38.258-.694.593-.743l.093-.007h1.183V8.669c0-.414.308-.75.686-.75zM9.031 2c2.698 0 4.864 2.369 4.864 5.319 0 2.95-2.166 5.318-4.864 5.318-2.697 0-4.863-2.369-4.863-5.318C4.17 4.368 6.335 2 9.032 2zm0 1.5c-1.94 0-3.491 1.697-3.491 3.819 0 2.12 1.552 3.818 3.491 3.818 1.94 0 3.492-1.697 3.492-3.818 0-2.122-1.551-3.818-3.492-3.818z"
                            />
                          </svg>
                          Find friends
                        </Link>
                      </li>
                      <li className="_left_inner_area_explore_item">
                        <Link href="#0" className="_left_inner_area_explore_link">
                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="24" fill="none" viewBox="0 0 22 24">
                            <path
                              fill="#666"
                              d="M13.704 2c2.8 0 4.585 1.435 4.585 4.258V20.33c0 .443-.157.867-.436 1.18-.279.313-.658.489-1.063.489a1.456 1.456 0 01-.708-.203l-5.132-3.134-5.112 3.14c-.615.36-1.361.194-1.829-.405l-.09-.126-.085-.155a1.913 1.913 0 01-.176-.786V6.434C3.658 3.5 5.404 2 8.243 2h5.46zm0 1.448h-5.46c-2.191 0-3.295.948-3.295 2.986V20.32c0 .044.01.088 0 .07l.034.063c.059.09.17.12.247.074l5.11-3.138c.38-.23.84-.23 1.222.001l5.124 3.128a.252.252 0 00.114.035.188.188 0 00.14-.064.236.236 0 00.058-.157V6.258c0-1.9-1.132-2.81-3.294-2.81zm.386 4.869c.357 0 .646.324.646.723 0 .367-.243.67-.559.718l-.087.006H7.81c-.357 0-.646-.324-.646-.723 0-.367.243-.67.558-.718l.088-.006h6.28z"
                            />
                          </svg>
                          Bookmarks
                        </Link>
                      </li>
                      <li className="_left_inner_area_explore_item">
                        <Link href="/group.html" className="_left_inner_area_explore_link">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#666"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="feather feather-users"
                          >
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                          </svg>
                          Group
                        </Link>
                      </li>
                      <li className="_left_inner_area_explore_item _explore_item">
                        <Link href="#0" className="_left_inner_area_explore_link">
                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="24" fill="none" viewBox="0 0 22 24">
                            <path
                              fill="#666"
                              d="M7.625 2c.315-.015.642.306.645.69.003.309.234.558.515.558h.928c1.317 0 2.402 1.169 2.419 2.616v.24h2.604c2.911-.026 5.255 2.337 5.377 5.414.005.12.006.245.004.368v4.31c.062 3.108-2.21 5.704-5.064 5.773-.117.003-.228 0-.34-.005a199.325 199.325 0 01-7.516 0c-2.816.132-5.238-2.292-5.363-5.411a6.262 6.262 0 01-.004-.371V11.87c-.03-1.497.48-2.931 1.438-4.024.956-1.094 2.245-1.714 3.629-1.746a3.28 3.28 0 01.342.005l3.617-.001v-.231c-.008-.676-.522-1.23-1.147-1.23h-.93c-.973 0-1.774-.866-1.785-1.937-.003-.386.28-.701.631-.705zm-.614 5.494h-.084C5.88 7.52 4.91 7.987 4.19 8.812c-.723.823-1.107 1.904-1.084 3.045v4.34c-.002.108 0 .202.003.294.094 2.353 1.903 4.193 4.07 4.08 2.487.046 5.013.046 7.55-.001.124.006.212.007.3.004 2.147-.05 3.86-2.007 3.812-4.361V11.87a5.027 5.027 0 00-.002-.291c-.093-2.338-1.82-4.082-4.029-4.082l-.07.002H7.209a4.032 4.032 0 00-.281-.004l.084-.001zm1.292 4.091c.341 0 .623.273.667.626l.007.098-.001 1.016h.946c.372 0 .673.325.673.725 0 .366-.253.669-.582.717l-.091.006h-.946v1.017c0 .4-.3.724-.673.724-.34 0-.622-.273-.667-.626l-.006-.098v-1.017h-.945c-.372 0-.674-.324-.674-.723 0-.367.254-.67.582-.718l.092-.006h.945v-1.017c0-.4.301-.724.673-.724zm7.058 3.428c.372 0 .674.324.674.724 0 .366-.254.67-.582.717l-.091.007h-.09c-.373 0-.674-.324-.674-.724 0-.367.253-.67.582-.717l.091-.007h.09zm-1.536-3.322c.372 0 .673.324.673.724 0 .367-.253.67-.582.718l-.091.006h-.09c-.372 0-.674-.324-.674-.724 0-.366.254-.67.582-.717l.092-.007h.09z"
                            />
                          </svg>
                          Gaming
                        </Link>
                        <span className="_left_inner_area_explore_link_txt">New</span>
                      </li>
                      <li className="_left_inner_area_explore_item">
                        <Link href="#0" className="_left_inner_area_explore_link">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path
                              fill="#666"
                              d="M12.616 2c.71 0 1.388.28 1.882.779.495.498.762 1.17.74 1.799l.009.147c.017.146.065.286.144.416.152.255.402.44.695.514.292.074.602.032.896-.137l.164-.082c1.23-.567 2.705-.117 3.387 1.043l.613 1.043c.017.027.03.056.043.085l.057.111a2.537 2.537 0 01-.884 3.204l-.257.159a1.102 1.102 0 00-.33.356 1.093 1.093 0 00-.117.847c.078.287.27.53.56.695l.166.105c.505.346.869.855 1.028 1.439.18.659.083 1.36-.272 1.957l-.66 1.077-.1.152c-.774 1.092-2.279 1.425-3.427.776l-.136-.069a1.19 1.19 0 00-.435-.1 1.128 1.128 0 00-1.143 1.154l-.008.171C15.12 20.971 13.985 22 12.616 22h-1.235c-1.449 0-2.623-1.15-2.622-2.525l-.008-.147a1.045 1.045 0 00-.148-.422 1.125 1.125 0 00-.688-.519c-.29-.076-.6-.035-.9.134l-.177.087a2.674 2.674 0 01-1.794.129 2.606 2.606 0 01-1.57-1.215l-.637-1.078-.085-.16a2.527 2.527 0 011.03-3.296l.104-.065c.309-.21.494-.554.494-.923 0-.401-.219-.772-.6-.989l-.156-.097a2.542 2.542 0 01-.764-3.407l.65-1.045a2.646 2.646 0 013.552-.96l.134.07c.135.06.283.093.425.094.626 0 1.137-.492 1.146-1.124l.009-.194a2.54 2.54 0 01.752-1.593A2.642 2.642 0 0111.381 2h1.235zm0 1.448h-1.235c-.302 0-.592.118-.806.328a1.091 1.091 0 00-.325.66l-.013.306C10.133 6.07 9 7.114 7.613 7.114a2.619 2.619 0 01-1.069-.244l-.192-.1a1.163 1.163 0 00-1.571.43l-.65 1.045a1.103 1.103 0 00.312 1.464l.261.162A2.556 2.556 0 015.858 12c0 .845-.424 1.634-1.156 2.13l-.156.096c-.512.29-.71.918-.472 1.412l.056.107.63 1.063c.147.262.395.454.688.536.26.072.538.052.754-.042l.109-.052a2.652 2.652 0 011.986-.261 2.591 2.591 0 011.925 2.21l.02.353c.062.563.548 1 1.14 1h1.234c.598 0 1.094-.45 1.14-1l.006-.11a2.536 2.536 0 01.766-1.823 2.65 2.65 0 011.877-.75c.35.009.695.086 1.048.241l.316.158c.496.213 1.084.058 1.382-.361l.073-.111.644-1.052a1.1 1.1 0 00-.303-1.455l-.273-.17a2.563 2.563 0 01-1.062-1.462 2.513 2.513 0 01.265-1.944c.19-.326.451-.606.792-.838l.161-.099c.512-.293.71-.921.473-1.417l-.07-.134-.013-.028-.585-.995a1.157 1.157 0 00-1.34-.513l-.111.044-.104.051a2.661 2.661 0 01-1.984.272 2.607 2.607 0 01-1.596-1.18 2.488 2.488 0 01-.342-1.021l-.014-.253a1.11 1.11 0 00-.323-.814 1.158 1.158 0 00-.823-.34zm-.613 5.284c1.842 0 3.336 1.463 3.336 3.268 0 1.805-1.494 3.268-3.336 3.268-1.842 0-3.336-1.463-3.336-3.268 0-1.805 1.494-3.268 3.336-3.268zm0 1.448c-1.026 0-1.858.815-1.858 1.82 0 1.005.832 1.82 1.858 1.82 1.026 0 1.858-.815 1.858-1.82 0-1.005-.832-1.82-1.858-1.82z"
                            />
                          </svg>
                          Settings
                        </Link>
                      </li>
                      <li className="_left_inner_area_explore_item">
                        <Link href="#0" className="_left_inner_area_explore_link">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="22"
                            height="22"
                            viewBox="0 0 22 24"
                            fill="none"
                            stroke="#666"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="feather feather-save"
                          >
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                            <polyline points="7 3 7 8 15 8"></polyline>
                          </svg>
                          Save post
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="_layout_left_sidebar_inner">
                  <div className="_left_inner_area_suggest _padd_t24 _padd_b6 _padd_r24 _padd_l24 _b_radious6 _feed_inner_area">
                    <div className="_left_inner_area_suggest_content _mar_b24">
                      <h4 className="_left_inner_area_suggest_content_title _title5">Suggested People</h4>
                      <span className="_left_inner_area_suggest_content_txt">
                        <Link className="_left_inner_area_suggest_content_txt_link" href="#0">
                          See All
                        </Link>
                      </span>
                    </div>
                    <div className="_left_inner_area_suggest_info">
                      <div className="_left_inner_area_suggest_info_box">
                        <div className="_left_inner_area_suggest_info_image">
                          <Link href="/profile">
                            <img src="/assets/images/people1.png" alt="Image" className="_info_img" />
                          </Link>
                        </div>
                        <div className="_left_inner_area_suggest_info_txt">
                          <Link href="/profile">
                            <h4 className="_left_inner_area_suggest_info_title">Steve Jobs</h4>
                          </Link>
                          <p className="_left_inner_area_suggest_info_para">CEO of Apple</p>
                        </div>
                      </div>
                      <div className="_left_inner_area_suggest_info_link">
                        <Link href="#0" className="_info_link">
                          Connect
                        </Link>
                      </div>
                    </div>
                    <div className="_left_inner_area_suggest_info">
                      <div className="_left_inner_area_suggest_info_box">
                        <div className="_left_inner_area_suggest_info_image">
                          <Link href="/profile">
                            <img src="/assets/images/people2.png" alt="Image" className="_info_img1" />
                          </Link>
                        </div>
                        <div className="_left_inner_area_suggest_info_txt">
                          <Link href="/profile">
                            <h4 className="_left_inner_area_suggest_info_title">Ryan Roslansky</h4>
                          </Link>
                          <p className="_left_inner_area_suggest_info_para">CEO of Linkedin</p>
                        </div>
                      </div>
                      <div className="_left_inner_area_suggest_info_link">
                        <Link href="#0" className="_info_link">
                          Connect
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Left Sidebar End */}

            {/* Middle Main Column */}
            <div className="col-xl-6 col-lg-6 col-md-12 col-sm-12">
              <div className="_layout_middle_wrap">
                <div className="_layout_middle_inner">
                  {/* Stories for Desktop */}
                  <div className="_feed_inner_ppl_card _mar_b16">
                    <div className="_feed_inner_story_arrow">
                      <button type="button" className="_feed_inner_story_arrow_btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="9" height="8" fill="none" viewBox="0 0 9 8">
                          <path fill="#fff" d="M8 4l.366-.341.318.341-.318.341L8 4zm-7 .5a.5.5 0 010-1v1zM5.566.659l2.8 3-.732.682-2.8-3L5.566.66zm2.8 3.682l-2.8 3-.732-.682 2.8-3 .732.682zM8 4.5H1v-1h7v1z" />
                        </svg>
                      </button>
                    </div>
                    <div className="row">
                      <div className="col-xl-3 col-lg-3 col-md-4 col-sm-4 col">
                        <div className="_feed_inner_profile_story _b_radious6">
                          <div className="_feed_inner_profile_story_image">
                            <img src="/assets/images/card_ppl1.png" alt="Image" className="_profile_story_img" />
                            <div className="_feed_inner_story_txt">
                              <div className="_feed_inner_story_btn">
                                <button className="_feed_inner_story_btn_link">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" viewBox="0 0 10 10">
                                    <path stroke="#fff" strokeLinecap="round" d="M.5 4.884h9M4.884 9.5v-9" />
                                  </svg>
                                </button>
                              </div>
                              <p className="_feed_inner_story_para">Your Story</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-xl-3 col-lg-3 col-md-4 col-sm-4 col">
                        <div className="_feed_inner_public_story _b_radious6">
                          <div className="_feed_inner_public_story_image">
                            <img src="/assets/images/card_ppl2.png" alt="Image" className="_public_story_img" />
                            <div className="_feed_inner_pulic_story_txt">
                              <p className="_feed_inner_pulic_story_para">Ryan Roslansky</p>
                            </div>
                            <div className="_feed_inner_public_mini">
                              <img src="/assets/images/mini_pic.png" alt="Image" className="_public_mini_img" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-xl-3 col-lg-3 col-md-4 col-sm-4 _custom_mobile_none">
                        <div className="_feed_inner_public_story _b_radious6">
                          <div className="_feed_inner_public_story_image">
                            <img src="/assets/images/card_ppl3.png" alt="Image" className="_public_story_img" />
                            <div className="_feed_inner_pulic_story_txt">
                              <p className="_feed_inner_pulic_story_para">Ryan Roslansky</p>
                            </div>
                            <div className="_feed_inner_public_mini">
                              <img src="/assets/images/mini_pic.png" alt="Image" className="_public_mini_img" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-xl-3 col-lg-3 col-md-4 col-sm-4 _custom_none">
                        <div className="_feed_inner_public_story _b_radious6">
                          <div className="_feed_inner_public_story_image">
                            <img src="/assets/images/card_ppl4.png" alt="Image" className="_public_story_img" />
                            <div className="_feed_inner_pulic_story_txt">
                              <p className="_feed_inner_pulic_story_para">Ryan Roslansky</p>
                            </div>
                            <div className="_feed_inner_public_mini">
                              <img src="/assets/images/mini_pic.png" alt="Image" className="_public_mini_img" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Stories for Desktop End */}

                  {/* Stories for Mobile */}
                  <div className="_feed_inner_ppl_card_mobile _mar_b16">
                    <div className="_feed_inner_ppl_card_area">
                      <ul className="_feed_inner_ppl_card_area_list">
                        <li className="_feed_inner_ppl_card_area_item">
                          <Link href="#0" className="_feed_inner_ppl_card_area_link">
                            <div className="_feed_inner_ppl_card_area_story">
                              <img src="/assets/images/mobile_story_img.png" alt="Image" className="_card_story_img" />
                              <div className="_feed_inner_ppl_btn">
                                <button className="_feed_inner_ppl_btn_link" type="button">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 12 12">
                                    <path stroke="#fff" strokeWidth="1.5" strokeLinecap="round" d="M1 5.884h10M6 10.884V.884" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </Link>
                        </li>
                        <li className="_feed_inner_ppl_card_area_item">
                          <Link href="#0" className="_feed_inner_ppl_card_area_link">
                            <div className="_feed_inner_ppl_card_area_story">
                              <img src="/assets/images/card_ppl2.png" alt="Image" className="_card_story_img" />
                            </div>
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                  {/* Stories for Mobile End */}

                  {/* Create Post Area */}
                  <div className="_feed_inner_text_area _b_radious6 _padd_b24 _padd_t24 _padd_r24 _padd_l24 _mar_b16">
                    <form onSubmit={handleCreatePost}>
                      <div className="_feed_inner_text_area_box">
                        <div className="_feed_inner_text_area_box_image">
                          <img src="/assets/images/txt_img.png" alt="Image" className="_txt_img" />
                        </div>
                        <div className="form-floating _feed_inner_text_area_box_form">
                          <textarea
                            className="form-control _textarea"
                            placeholder="Leave a comment here"
                            id="floatingTextarea"
                            value={newPostText}
                            onChange={(e) => setNewPostText(e.target.value)}
                            style={{ resize: "none" }}
                          ></textarea>
                          <label className="_feed_textarea_label" htmlFor="floatingTextarea">
                            Write something ...
                            <svg xmlns="http://www.w3.org/2000/svg" width="23" height="24" fill="none" viewBox="0 0 23 24">
                              <path fill="#666" d="M19.504 19.209c.332 0 .601.289.601.646 0 .326-.226.596-.52.64l-.081.005h-6.276c-.332 0-.602-.289-.602-.645 0-.327.227-.597.52-.64l.082-.006h6.276zM13.4 4.417c1.139-1.223 2.986-1.223 4.125 0l1.182 1.268c1.14 1.223 1.14 3.205 0 4.427L9.82 19.649a2.619 2.619 0 01-1.916.85h-3.64c-.337 0-.61-.298-.6-.66l.09-3.941a3.019 3.019 0 01.794-1.982l8.852-9.5zm-.688 2.562l-7.313 7.85a1.68 1.68 0 00-.441 1.101l-.077 3.278h3.023c.356 0 .698-.133.968-.376l.098-.096 7.35-7.887-3.608-3.87zm3.962-1.65a1.633 1.633 0 00-2.423 0l-.688.737 3.606 3.87.688-.737c.631-.678.666-1.755.105-2.477l-.105-.124-1.183-1.268z" />
                            </svg>
                          </label>
                        </div>
                      </div>

                      {/* Image selector hidden input and preview */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        accept="image/*"
                        style={{ display: "none" }}
                      />

                      {imagePreview && (
                        <div className="position-relative mb-2 mt-2" style={{ maxWidth: "200px" }}>
                          <img src={imagePreview} alt="Preview" className="img-thumbnail" style={{ maxHeight: "150px" }} />
                          <button
                            type="button"
                            onClick={removeSelectedImage}
                            className="btn-close position-absolute top-0 end-0 bg-white p-1 rounded-circle"
                            style={{ transform: "translate(50%, -50%)", fontSize: "10px" }}
                          />
                        </div>
                      )}

                      <div className="_feed_inner_text_area_bottom">
                        <div className="_feed_inner_text_area_item">
                          <div className="_feed_inner_text_area_bottom_photo _feed_common">
                            <button
                              type="button"
                              onClick={triggerFileInput}
                              className="_feed_inner_text_area_bottom_photo_link"
                            >
                              <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 20 20">
                                  <path fill="#666" d="M13.916 0c3.109 0 5.18 2.429 5.18 5.914v8.17c0 3.486-2.072 5.916-5.18 5.916H5.999C2.89 20 .827 17.572.827 14.085v-8.17C.827 2.43 2.897 0 6 0h7.917zm0 1.504H5.999c-2.321 0-3.799 1.735-3.799 4.41v8.17c0 2.68 1.472 4.412 3.799 4.412h7.917c2.328 0 3.807-1.734 3.807-4.411v-8.17c0-2.678-1.478-4.411-3.807-4.411zm.65 8.68l.12.125 1.9 2.147a.803.803 0 01-.016 1.063.642.642 0 01-.894.058l-.076-.074-1.9-2.148a.806.806 0 00-1.205-.028l-.074.087-2.04 2.717c-.722.963-2.02 1.066-2.86.26l-.111-.116-.814-.91a.562.562 0 00-.793-.07l-.075.073-1.4 1.617a.645.645 0 01-.97.029.805.805 0 01-.09-.977l.064-.086 1.4-1.617c.736-.852 1.95-.897 2.734-.137l.114.12.81.905a.587.587 0 00.861.033l.07-.078 2.04-2.718c.81-1.08 2.27-1.19 3.205-.275zM6.831 4.64c1.265 0 2.292 1.125 2.292 2.51 0 1.386-1.027 2.511-2.292 2.511S4.54 8.537 4.54 7.152c0-1.386 1.026-2.51 2.291-2.51zm0 1.504c-.507 0-.918.451-.918 1.007 0 .555.411 1.006.918 1.006.507 0 .919-.451.919-1.006 0-.556-.412-1.007-.919-1.007z" />
                                </svg>
                              </span>
                              Photo
                            </button>
                          </div>
                          <div className="_feed_inner_text_area_bottom_video _feed_common">
                            <button
                              type="button"
                              onClick={triggerFileInput}
                              className="_feed_inner_text_area_bottom_photo_link"
                            >
                              <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="24" fill="none" viewBox="0 0 22 24">
                                  <path fill="#666" d="M11.485 4.5c2.213 0 3.753 1.534 3.917 3.784l2.418-1.082c1.047-.468 2.188.327 2.271 1.533l.005.141v6.64c0 1.237-1.103 2.093-2.155 1.72l-.121-.047-2.418-1.083c-.164 2.25-1.708 3.785-3.917 3.785H5.76c-2.343 0-3.932-1.72-3.932-4.188V8.688c0-2.47 1.589-4.188 3.932-4.188h5.726zm0 1.5H5.76C4.169 6 3.197 7.05 3.197 8.688v7.015c0 1.636.972 2.688 2.562 2.688h5.726c1.586 0 2.562-1.054 2.562-2.688v-.686-6.329c0-1.636-.973-2.688-2.562-2.688zM18.4 8.57l-.062.02-2.921 1.306v4.596l2.921 1.307c.165.073.343-.036.38-.215l.008-.07V8.876c0-.195-.16-.334-.326-.305z" />
                                </svg>
                              </span>
                              Video
                            </button>
                          </div>
                          <div className="_feed_inner_text_area_bottom_event _feed_common">
                            <button
                              type="button"
                              className="_feed_inner_text_area_bottom_photo_link"
                            >
                              <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="24" fill="none" viewBox="0 0 22 24">
                                  <path fill="#666" d="M14.371 2c.32 0 .585.262.627.603l.005.095v.788c2.598.195 4.188 2.033 4.18 5v8.488c0 3.145-1.786 5.026-4.656 5.026H7.395C4.53 22 2.74 20.087 2.74 16.904V8.486c0-2.966 1.596-4.804 4.187-5v-.788c0-.386.283-.698.633-.698.32 0 .584.262.626.603l.006.095v.771h5.546v-.771c0-.386.284-.698.633-.698zm3.546 8.283H4.004l.001 6.621c0 2.325 1.137 3.616 3.183 3.697l.207.004h7.132c2.184 0 3.39-1.271 3.39-3.63v-6.692zm-3.202 5.853c.349 0 .632.312.632.698 0 .353-.238.645-.546.691l-.086.006c-.357 0-.64-.312-.64-.697 0-.354.237-.645.546-.692l.094-.006zm-3.742 0c.35 0 .632.312.632.698 0 .353-.238.645-.546.691l-.086.006c-.357 0-.64-.312-.64-.697 0-.354.238-.645.546-.692l.094-.006zm-3.75 0c.35 0 .633.312.633.698 0 .353-.238.645-.547.691l-.093.006c-.35 0-.633-.312-.633-.697 0-.354.238-.645.547-.692l.094-.006zm7.492-3.615c.349 0 .632.312.632.697 0 .354-.238.645-.546.692l-.086.006c-.357 0-.64-.312-.64-.698 0-.353.237-.645.546-.691l.094-.006zm-3.742 0c.35 0 .632.312.632.697 0 .354-.238.645-.546.692l-.086.006c-.357 0-.64-.312-.64-.698 0-.353.238-.645.546-.691l.094-.006zm-3.75 0c.35 0 .633.312.633.697 0 .354-.238.645-.547.692l-.093.006c-.35 0-.633-.312-.633-.698 0-.353.238-.645.547-.691l.094-.006zm6.515-7.657H8.192v.895c0 .385-.283.698-.633.698-.32 0-.584-.263-.626-.603l-.006-.095v-.874c-1.886.173-2.922 1.422-2.922 3.6v.402h13.912v-.403c.007-2.181-1.024-3.427-2.914-3.599v.874c0 .385-.283.698-.632.698-.32 0-.585-.263-.627-.603l-.005-.095v-.895z" />
                                </svg>
                              </span>
                              Event
                            </button>
                          </div>
                          <div className="_feed_inner_text_area_bottom_article _feed_common">
                            <button
                              type="button"
                              className="_feed_inner_text_area_bottom_photo_link"
                            >
                              <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="20" fill="none" viewBox="0 0 18 20">
                                  <path fill="#666" d="M12.49 0c2.92 0 4.665 1.92 4.693 5.132v9.659c0 3.257-1.75 5.209-4.693 5.209H5.434c-.377 0-.734-.032-1.07-.095l-.2-.041C2 19.371.74 17.555.74 14.791V5.209c0-.334.019-.654.055-.96C1.114 1.564 2.799 0 5.434 0h7.056zm-.008 1.457H5.434c-2.244 0-3.381 1.263-3.381 3.752v9.582c0 2.489 1.137 3.752 3.38 3.752h7.049c2.242 0 3.372-1.263 3.372-3.752V5.209c0-2.489-1.13-3.752-3.372-3.752zm-.239 12.053c.36 0 .652.324.652.724 0 .4-.292.724-.652.724H5.656c-.36 0-.652-.324-.652-.724 0-.4.293-.724.652-.724h6.587zm0-4.239a.643.643 0 01.632.339.806.806 0 010 .78.643.643 0 01-.632.339H5.656c-.334-.042-.587-.355-.587-.729s.253-.688.587-.729h6.587zM8.17 5.042c.335.041.588.355.588.729 0 .373-.253.687-.588.728H5.665c-.336-.041-.589-.355-.589-.728 0-.374.253-.688.589-.729H8.17z" />
                                </svg>
                              </span>
                              Article
                            </button>
                          </div>
                        </div>
                        <div className="d-flex align-items-center gap-3">
                          <select
                            value={newPostVisibility}
                            onChange={(e) => setNewPostVisibility(e.target.value as "PUBLIC" | "PRIVATE")}
                            className="form-select border-0 bg-transparent py-1 px-2 fs-7 text-secondary fw-semibold cursor-pointer w-auto"
                            style={{ height: "38px", outline: "none", boxShadow: "none" }}
                          >
                            <option value="PUBLIC" className="text-dark bg-white">🌎 Public</option>
                            <option value="PRIVATE" className="text-dark bg-white">🔒 Private</option>
                          </select>
                          <div className="_feed_inner_text_area_btn">
                            <button type="submit" className="_feed_inner_text_area_btn_link border-0">
                              <svg className="_mar_img" xmlns="http://www.w3.org/2000/svg" width="14" height="13" fill="none" viewBox="0 0 14 13">
                                <path fill="#fff" fillRule="evenodd" d="M6.37 7.879l2.438 3.955a.335.335 0 00.34.162c.068-.01.23-.05.289-.247l3.049-10.297a.348.348 0 00-.09-.35.341.341 0 00-.34-.088L1.75 4.03a.34.34 0 00-.247.289.343.343 0 00.16.347L5.666 7.17 9.2 3.597a.5.5 0 01.712.703L6.37 7.88zM9.097 13c-.464 0-.89-.236-1.14-.641L5.372 8.165l-4.237-2.65a1.336 1.336 0 01-.622-1.331c.074-.536.441-.96.957-1.112L11.774.054a1.347 1.347 0 011.67 1.682l-3.05 10.296A1.332 1.332 0 019.098 13z" clipRule="evenodd" />
                              </svg>
                              <span>Post</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </form>
                  </div>
                  {/* Create Post Area End */}

                  {/* Post Timeline Feed */}
                  {filteredPosts.length === 0 ? (
                    <div className="_feed_inner_timeline_post_area _b_radious6 _padd_b24 _padd_t24 _mar_b16 text-center text-muted">
                      No posts to display.
                    </div>
                  ) : (
                    filteredPosts.map((post) => {
                      const isPostLiked = post.isLiked || post.postLikes?.some((like) => like.userId === user.id);
                      const postLikesCount = post.likesCount ?? post.postLikes?.length ?? 0;
                      const postCommentsCount = post.comments?.length || 0;

                      return (
                        <div key={post.id} className="_feed_inner_timeline_post_area _b_radious6 _padd_b24 _padd_t24 _mar_b16">
                          <div className="_feed_inner_timeline_content _padd_r24 _padd_l24">
                            <div className="_feed_inner_timeline_post_top">
                              <div className="_feed_inner_timeline_post_box">
                                <div className="_feed_inner_timeline_post_box_image">
                                  <img src="/assets/images/post_img.png" alt="Author" className="_post_img" />
                                </div>
                                <div className="_feed_inner_timeline_post_box_txt">
                                  <h4 className="_feed_inner_timeline_post_box_title">
                                    {post.author.firstName} {post.author.lastName}
                                  </h4>
                                  <p className="_feed_inner_timeline_post_box_para">
                                    {formatRelativeTime(post.createdAt)} .{" "}
                                    <span className="text-capitalize">{post.visibility.toLowerCase()}</span>
                                  </p>
                                </div>
                              </div>
                              <div className="_feed_inner_timeline_post_box_dropdown" onClick={(e) => e.stopPropagation()}>
                                <div className="_feed_timeline_post_dropdown">
                                  <button
                                    onClick={() => setOpenPostDropdownId(openPostDropdownId === post.id ? null : post.id)}
                                    className="_feed_timeline_post_dropdown_link border-0 bg-transparent"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="4" height="17" fill="none" viewBox="0 0 4 17">
                                      <circle cx="2" cy="2" r="2" fill="#C4C4C4" />
                                      <circle cx="2" cy="8" r="2" fill="#C4C4C4" />
                                      <circle cx="2" cy="15" r="2" fill="#C4C4C4" />
                                    </svg>
                                  </button>
                                </div>
                                {/* Dropdown menu */}
                                <div className={`_feed_timeline_dropdown _timeline_dropdown ${openPostDropdownId === post.id ? "show" : ""}`}>
                                  <ul className="_feed_timeline_dropdown_list">
                                    <li className="_feed_timeline_dropdown_item">
                                      <a href="#0" className="_feed_timeline_dropdown_link">
                                        <span>
                                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 18 18">
                                            <path stroke="#1890FF" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M14.25 15.75L9 12l-5.25 3.75v-12a1.5 1.5 0 011.5-1.5h7.5a1.5 1.5 0 011.5 1.5v12z" />
                                          </svg>
                                        </span>
                                        Save Post
                                      </a>
                                    </li>
                                    <li className="_feed_timeline_dropdown_item">
                                      <a href="#0" className="_feed_timeline_dropdown_link">
                                        <span>
                                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="22" fill="none" viewBox="0 0 20 22">
                                            <path fill="#377DFF" fillRule="evenodd" d="M7.547 19.55c.533.59 1.218.915 1.93.915.714 0 1.403-.324 1.938-.916a.777.777 0 011.09-.056c.318.284.344.77.058 1.084-.832.917-1.927 1.423-3.086 1.423h-.002c-1.155-.001-2.248-.506-3.077-1.424a.762.762 0 01.057-1.083.774.774 0 011.092.057zM9.527 0c4.58 0 7.657 3.543 7.657 6.85 0 1.702.436 2.424.899 3.19.457.754.976 1.612.976 3.233-.36 4.14-4.713 4.478-9.531 4.478-4.818 0-9.172-.337-9.528-4.413-.003-1.686.515-2.544.973-3.299l.161-.27c.398-.679.737-1.417.737-2.918C1.871 3.543 4.948 0 9.528 0zm0 1.535c-3.6 0-6.11 2.802-6.11 5.316 0 2.127-.595 3.11-1.12 3.978-.422.697-.755 1.247-.755 2.444.173 1.93 1.455 2.944 7.986 2.944 6.494 0 7.817-1.06 7.988-3.01-.003-1.13-.336-1.681-.757-2.378-.526-.868-1.12-1.851-1.12-3.978 0-2.514-2.51-5.316-6.111-5.316z" clipRule="evenodd" />
                                          </svg>
                                        </span>
                                        Turn On Notification
                                      </a>
                                    </li>
                                    {post.authorId === user.id && (
                                      <>
                                        <li className="_feed_timeline_dropdown_item">
                                          <a
                                            href="#0"
                                            onClick={() => {
                                              setEditingPostId(post.id);
                                              setEditText(post.text);
                                              setEditVisibility(post.visibility);
                                              setOpenPostDropdownId(null);
                                            }}
                                            className="_feed_timeline_dropdown_link"
                                          >
                                            <span>
                                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 18 18">
                                                <path stroke="#1890FF" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M8.25 3H3a1.5 1.5 0 00-1.5 1.5V15A1.5 1.5 0 003 16.5h10.5A1.5 1.5 0 0015 15V9.75" />
                                                <path stroke="#1890FF" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M13.875 1.875a1.591 1.591 0 112.25 2.25L9 11.25 6 12l.75-3 7.125-7.125z" />
                                              </svg>
                                            </span>
                                            Edit Post
                                          </a>
                                        </li>
                                        <li className="_feed_timeline_dropdown_item">
                                          <a
                                            href="#0"
                                            onClick={() => {
                                              handleDeletePost(post.id);
                                              setOpenPostDropdownId(null);
                                            }}
                                            className="_feed_timeline_dropdown_link"
                                          >
                                            <span>
                                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 18 18">
                                                <path stroke="#1890FF" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M2.25 4.5h13.5M6 4.5V3a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0112 3v1.5m2.25 0V15a1.5 1.5 0 01-1.5 1.5h-7.5a1.5 1.5 0 01-1.5-1.5V4.5h10.5zM7.5 8.25v4.5M10.5 8.25v4.5" />
                                              </svg>
                                            </span>
                                            Delete Post
                                          </a>
                                        </li>
                                      </>
                                    )}
                                  </ul>
                                </div>
                              </div>
                            </div>

                            {/* Edit Post Form or Post Content */}
                            {editingPostId === post.id ? (
                              <div className="mt-3 p-3 bg-light rounded border">
                                <textarea
                                  className="form-control mb-2"
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  style={{ height: "80px", resize: "none" }}
                                />
                                <div className="d-flex align-items-center justify-content-between">
                                  <select
                                    value={editVisibility}
                                    onChange={(e) => setEditVisibility(e.target.value as "PUBLIC" | "PRIVATE")}
                                    className="form-select border-0 bg-transparent py-1 px-2 fs-7 w-auto"
                                  >
                                    <option value="PUBLIC">Public</option>
                                    <option value="PRIVATE">Private</option>
                                  </select>
                                  <div className="d-flex gap-2">
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => setEditingPostId(null)}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-sm"
                                      onClick={() => handleUpdatePost(post.id)}
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
                                <h4 className="_feed_inner_timeline_post_title mt-3">{post.text}</h4>
                                {post.imageUrl && (
                                  <div className="_feed_inner_timeline_image">
                                    <img src={getFullImageUrl(post.imageUrl)} alt="" className="_time_img img-fluid rounded" />
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {/* Post likes count and shares */}
                          <div className="_feed_inner_timeline_total_reacts _padd_r24 _padd_l24 _mar_b26 d-flex align-items-center justify-content-between mt-3">
                            <div
                              className="position-relative _feed_inner_timeline_total_reacts_image d-flex align-items-center gap-1"
                              onMouseEnter={() => setHoveredLikesKey(`post_${post.id}`)}
                              onMouseLeave={() => setHoveredLikesKey(null)}
                              onClick={() => handleToggleLikePost(post.id)}
                              style={{ cursor: "pointer" }}
                            >
                              <img src="/assets/images/react_img1.png" alt="react" className="_react_img1" />
                              <img src="/assets/images/react_img2.png" alt="react" className="_react_img" />
                              <p className="_feed_inner_timeline_total_reacts_para ms-1 mb-0">{postLikesCount}</p>

                              {/* Hover tooltip for Liked users */}
                              {hoveredLikesKey === `post_${post.id}` && post.likedBy && post.likedBy.length > 0 && (
                                <div
                                  className="position-absolute bg-dark text-white p-2 rounded shadow fs-7"
                                  style={{ bottom: "25px", left: "0", zIndex: 100, minWidth: "150px" }}
                                >
                                  <div className="fw-bold mb-1 border-bottom pb-1">Liked by:</div>
                                  {post.likedBy.map((like) => (
                                    <div key={like.id}>{like.name}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="_feed_inner_timeline_total_reacts_txt d-flex gap-3">
                              <p className="_feed_inner_timeline_total_reacts_para1 mb-0">
                                <span>{postCommentsCount}</span> Comments
                              </p>
                              <p className="_feed_inner_timeline_total_reacts_para2 mb-0">
                                <span>0</span> Shares
                              </p>
                            </div>
                          </div>

                          {/* Action Reaction Buttons */}
                          <div className="_feed_inner_timeline_reaction d-flex py-2 border-top border-bottom justify-content-around">
                            <button
                              onClick={() => handleToggleLikePost(post.id)}
                              className={`_feed_inner_timeline_reaction_emoji _feed_reaction border-0 bg-transparent ${
                                isPostLiked ? "_feed_reaction_active" : ""
                              }`}
                            >
                              <span className="_feed_inner_timeline_reaction_link">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="19"
                                  height="19"
                                  fill="none"
                                  viewBox="0 0 19 19"
                                  className="me-1 d-inline-block align-middle"
                                >
                                  <path fill="#FFCC4D" d="M9.5 19a9.5 9.5 0 100-19 9.5 9.5 0 000 19z" />
                                  <path
                                    fill="#664500"
                                    d="M9.5 11.083c-1.912 0-3.181-.222-4.75-.527-.358-.07-1.056 0-1.056 1.055 0 2.111 2.425 4.75 5.806 4.75 3.38 0 5.805-2.639 5.805-4.75 0-1.055-.697-1.125-1.055-1.055-1.57.305-2.838.527-4.75.527z"
                                  />
                                  <path fill="#fff" d="M4.75 11.611s1.583.528 4.75.528 4.75-.528 4.75-.528-1.056 2.111-4.75 2.111-4.75-2.11-4.75-2.11z" />
                                  <path d="M6.333 8.972c.729 0 1.32-.827 1.32-1.847s-.591-1.847-1.32-1.847c-.729 0-1.32.827-1.32 1.847s.591 1.847 1.32 1.847zM12.667 8.972c.729 0 1.32-.827 1.32-1.847s-.591-1.847-1.32-1.847c-.729 0-1.32.827-1.32 1.847s.591 1.847 1.32 1.847z" fill="#664500" />
                                </svg>
                                Like
                              </span>
                            </button>

                            <button
                              onClick={() => {
                                const inputEl = document.getElementById(`commentInput_${post.id}`);
                                if (inputEl) inputEl.focus();
                              }}
                              className="_feed_inner_timeline_reaction_comment _feed_reaction border-0 bg-transparent"
                            >
                              <span className="_feed_inner_timeline_reaction_link">
                                <svg
                                  className="_reaction_svg me-1 d-inline-block align-middle"
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="21"
                                  height="21"
                                  fill="none"
                                  viewBox="0 0 21 21"
                                >
                                  <path
                                    stroke="#000"
                                    d="M1 10.5c0-.464 0-.696.009-.893A9 9 0 019.607 1.01C9.804 1 10.036 1 10.5 1v0c.464 0 .696 0 .893.009a9 9 0 018.598 8.598c.009.197.009.429.009.893v6.046c0 1.36 0 2.041-.317 2.535a2 2 0 01-.602.602c-.494.317-1.174.317-2.535.317H10.5c-.464 0-.696 0-.893-.009a9 9 0 01-8.598-8.598C1 11.196 1 10.964 1 10.5v0z"
                                  />
                                  <path stroke="#000" strokeLinecap="round" strokeLinejoin="round" d="M6.938 9.313h7.125M10.5 14.063h3.563" />
                                </svg>
                                Comment
                              </span>
                            </button>

                            <button
                              onClick={() => alert("Share feature coming soon!")}
                              className="_feed_inner_timeline_reaction_share _feed_reaction border-0 bg-transparent"
                            >
                              <span className="_feed_inner_timeline_reaction_link">
                                <svg
                                  className="_reaction_svg me-1 d-inline-block align-middle"
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="24"
                                  height="21"
                                  fill="none"
                                  viewBox="0 0 24 21"
                                >
                                  <path stroke="#000" strokeLinejoin="round" d="M23 10.5L12.917 1v5.429C3.267 6.429 1 13.258 1 20c2.785-3.52 5.248-5.429 11.917-5.429V20L23 10.5z" />
                                </svg>
                                Share
                              </span>
                            </button>
                          </div>

                          {/* Comments list and input */}
                          <div className="_feed_inner_timeline_cooment_area p-3">
                            {/* Create top-level Comment Input */}
                            <div className="_feed_inner_comment_box mb-3">
                              <form
                                className="_feed_inner_comment_box_form"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  handleAddComment(post.id);
                                }}
                              >
                                <div className="_feed_inner_comment_box_content">
                                  <div className="_feed_inner_comment_box_content_image">
                                    <img src="/assets/images/comment_img.png" alt="comment avatar" className="_comment_img" />
                                  </div>
                                  <div className="_feed_inner_comment_box_content_txt">
                                    <input
                                      type="text"
                                      id={`commentInput_${post.id}`}
                                      className="form-control _comment_inpt"
                                      placeholder="Write a comment..."
                                      value={commentTexts[`post_${post.id}`] || ""}
                                      onChange={(e) =>
                                        setCommentTexts((prev) => ({ ...prev, [`post_${post.id}`]: e.target.value }))
                                      }
                                    />
                                  </div>
                                </div>
                              </form>
                            </div>

                            {/* Render comments tree */}
                            <div className="_timline_comment_main">
                              {(post.comments?.filter((c) => !c.parentId) || []).map((comment) => {
                                const isCommentLiked = comment.isLiked || comment.commentLikes?.some((l) => l.userId === user.id);
                                const commentLikesCount = comment.likesCount ?? comment.commentLikes?.length ?? 0;

                                return (
                                  <div key={comment.id} className="_comment_main d-flex flex-column mb-3">
                                    {/* Top Level Comment Body */}
                                    <div className="d-flex align-items-start">
                                      <div className="_comment_image me-2">
                                        <img src="/assets/images/txt_img.png" alt="avatar" className="_comment_img1" />
                                      </div>
                                      <div className="_comment_area flex-grow-1 position-relative">
                                        <div className="_comment_details">
                                          <div className="_comment_details_top">
                                            <div className="_comment_name">
                                              <Link href="#0">
                                                <h4 className="_comment_name_title">
                                                  {comment.author.firstName} {comment.author.lastName}
                                                </h4>
                                              </Link>
                                            </div>
                                          </div>
                                          <div className="_comment_status">
                                            <p className="_comment_status_text">
                                              <span>{comment.text}</span>
                                            </p>
                                          </div>

                                          {/* Reactions Display on comment */}
                                          <div
                                            className="_total_reactions position-relative"
                                            onMouseEnter={() => setHoveredLikesKey(`comment_${comment.id}`)}
                                            onMouseLeave={() => setHoveredLikesKey(null)}
                                            onClick={() => handleToggleLikeComment(comment.id)}
                                            style={{ cursor: "pointer" }}
                                          >
                                            <div className="_total_react">
                                              <span className="_reaction_like">
                                                <svg
                                                  xmlns="http://www.w3.org/2000/svg"
                                                  width="12"
                                                  height="12"
                                                  viewBox="0 0 24 24"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  strokeWidth="2"
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  className="feather feather-thumbs-up"
                                                >
                                                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                                                </svg>
                                              </span>
                                              <span className="_reaction_heart">
                                                <svg
                                                  xmlns="http://www.w3.org/2000/svg"
                                                  width="12"
                                                  height="12"
                                                  viewBox="0 0 24 24"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  strokeWidth="2"
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  className="feather feather-heart"
                                                >
                                                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                                </svg>
                                              </span>
                                            </div>
                                            <span className="_total">{commentLikesCount}</span>

                                            {/* Likes List Hover Tooltip */}
                                            {hoveredLikesKey === `comment_${comment.id}` && comment.likedBy && comment.likedBy.length > 0 && (
                                              <div
                                                className="position-absolute bg-dark text-white p-2 rounded shadow fs-7"
                                                style={{ bottom: "25px", right: "0", zIndex: 100, minWidth: "120px" }}
                                              >
                                                {comment.likedBy.map((like) => (
                                                  <div key={like.id}>{like.name}</div>
                                                ))}
                                              </div>
                                            )}
                                          </div>

                                          <div className="_comment_reply">
                                            <div className="_comment_reply_num">
                                              <ul className="_comment_reply_list list-unstyled mb-0 d-flex gap-2">
                                                <li>
                                                  <span
                                                    onClick={() => handleToggleLikeComment(comment.id)}
                                                    style={{ cursor: "pointer", fontWeight: isCommentLiked ? "bold" : "normal" }}
                                                    className={isCommentLiked ? "text-primary" : ""}
                                                  >
                                                    Like
                                                  </span>
                                                  .
                                                </li>
                                                <li>
                                                  <span
                                                    onClick={() => setReplyingToCommentId(replyingToCommentId === comment.id ? null : comment.id)}
                                                    style={{ cursor: "pointer" }}
                                                  >
                                                    Reply
                                                  </span>
                                                  .
                                                </li>
                                                <li>
                                                  <span>Share</span>
                                                </li>
                                                <li>
                                                  <span className="_time_link">
                                                    .{formatRelativeTime(comment.createdAt)}
                                                  </span>
                                                </li>
                                              </ul>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Indented Sub-Comments (Replies) */}
                                    <div className="ps-5 border-start ms-3 mt-2">
                                      {comment.replies?.map((reply) => {
                                        const isReplyLiked = reply.isLiked || reply.commentLikes?.some((l) => l.userId === user.id);
                                        const replyLikesCount = reply.likesCount ?? reply.commentLikes?.length ?? 0;

                                        return (
                                          <div key={reply.id} className="d-flex align-items-start mb-2 mt-2">
                                            <div className="me-2">
                                              <img
                                                src="/assets/images/comment_img.png"
                                                alt="reply avatar"
                                                className="_comment_img"
                                                style={{ width: "24px", height: "24px" }}
                                              />
                                            </div>
                                            <div className="_comment_area flex-grow-1 position-relative">
                                              <div className="_comment_details py-2 px-3 bg-light rounded shadow-sm">
                                                <h6 className="_comment_name_title fw-bold fs-7 mb-1" style={{ fontSize: "12px" }}>
                                                  {reply.author?.firstName} {reply.author?.lastName}
                                                </h6>
                                                <p className="mb-1" style={{ fontSize: "13px", color: "#333" }}>
                                                  {reply.text}
                                                </p>

                                                {/* Likes on Reply */}
                                                <div
                                                  className="_total_reactions position-relative"
                                                  onMouseEnter={() => setHoveredLikesKey(`reply_${reply.id}`)}
                                                  onMouseLeave={() => setHoveredLikesKey(null)}
                                                  onClick={() => handleToggleLikeComment(reply.id)}
                                                  style={{ cursor: "pointer", right: "10px", bottom: "-5px" }}
                                                >
                                                  <div className="_total_react">
                                                    <span className="_reaction_like">
                                                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                                                      </svg>
                                                    </span>
                                                  </div>
                                                  <span className="_total" style={{ fontSize: "10px" }}>{replyLikesCount}</span>

                                                  {hoveredLikesKey === `reply_${reply.id}` && reply.likedBy && reply.likedBy.length > 0 && (
                                                    <div
                                                      className="position-absolute bg-dark text-white p-2 rounded shadow fs-7"
                                                      style={{ bottom: "20px", right: "0", zIndex: 100, minWidth: "120px" }}
                                                    >
                                                      {reply.likedBy.map((like) => (
                                                        <div key={like.id}>{like.name}</div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>

                                                <div className="d-flex gap-2 list-unstyled mb-0 mt-1" style={{ fontSize: "11px", color: "#6c757d" }}>
                                                  <span
                                                    onClick={() => handleToggleLikeComment(reply.id)}
                                                    style={{ cursor: "pointer", fontWeight: isReplyLiked ? "bold" : "normal" }}
                                                    className={isReplyLiked ? "text-primary" : ""}
                                                  >
                                                    Like
                                                  </span>
                                                  <span>.</span>
                                                  <span>Reply</span>
                                                  <span>.</span>
                                                  <span>{formatRelativeTime(reply.createdAt)}</span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}

                                      {/* Sub-Comment (Reply) Input Box Form */}
                                      {replyingToCommentId === comment.id && (
                                        <div className="_feed_inner_comment_box mt-2">
                                          <form
                                            className="_feed_inner_comment_box_form"
                                            onSubmit={(e) => {
                                              e.preventDefault();
                                              handleAddComment(post.id, comment.id);
                                            }}
                                          >
                                            <div className="_feed_inner_comment_box_content">
                                              <div className="_feed_inner_comment_box_content_image">
                                                <img src="/assets/images/comment_img.png" alt="reply input avatar" className="_comment_img" style={{ width: "24px", height: "24px" }} />
                                              </div>
                                              <div className="_feed_inner_comment_box_content_txt">
                                                <input
                                                  type="text"
                                                  placeholder="Write a reply..."
                                                  className="form-control _comment_inpt"
                                                  value={commentTexts[`comment_${comment.id}`] || ""}
                                                  onChange={(e) =>
                                                    setCommentTexts((prev) => ({ ...prev, [`comment_${comment.id}`]: e.target.value }))
                                                  }
                                                />
                                              </div>
                                            </div>
                                          </form>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {/* Post Timeline Feed End */}
                </div>
              </div>
            </div>
            {/* Middle Main Column End */}

            {/* Right Sidebar */}
            <div className="col-xl-3 col-lg-3 col-md-12 col-sm-12">
              <div className="_layout_right_sidebar_wrap">
                <div className="_layout_right_sidebar_inner">
                  {/* You Might Like Widget */}
                  <div className="_right_inner_area_info _padd_t24 _padd_b24 _padd_r24 _padd_l24 _b_radious6 _feed_inner_area">
                    <div className="_right_inner_area_info_content _mar_b24 d-flex justify-content-between align-items-center">
                      <h4 className="_right_inner_area_info_content_title _title5 m-0">You Might Like</h4>
                      <span className="_right_inner_area_info_content_txt">
                        <Link className="_right_inner_area_info_content_txt_link" href="#0">
                          See All
                        </Link>
                      </span>
                    </div>
                    <hr className="_underline" />
                    <div className="_right_inner_area_info_ppl mt-3">
                      <div className="_right_inner_area_info_box d-flex align-items-center mb-3">
                        <div className="_right_inner_area_info_box_image me-2">
                          <img src="/assets/images/Avatar.png" alt="Avatar" className="_ppl_img" />
                        </div>
                        <div className="_right_inner_area_info_box_txt">
                          <h4 className="_right_inner_area_info_box_title fw-bold fs-7 mb-0">Radovan SkillArena</h4>
                          <p className="_right_inner_area_info_box_para text-muted mb-0 fs-8">Founder & CEO at Trophy</p>
                        </div>
                      </div>
                      <div className="_right_info_btn_grp d-flex gap-2">
                        <button type="button" className="_right_info_btn_link btn btn-light btn-sm flex-grow-1 py-1">
                          Ignore
                        </button>
                        <button type="button" className="_right_info_btn_link _right_info_btn_link_active btn btn-primary btn-sm flex-grow-1 py-1">
                          Follow
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* You Might Like Widget End */}

                  {/* Friends Status Widget */}
                  <div className="_feed_right_inner_area_card _padd_t24 _padd_b6 _padd_r24 _padd_l24 _b_radious6 _feed_inner_area mt-4">
                    <div className="_feed_top_fixed">
                      <div className="_feed_right_inner_area_card_content _mar_b24 d-flex justify-content-between align-items-center">
                        <h4 className="_feed_right_inner_area_card_content_title _title5 m-0">Your Friends</h4>
                        <span className="_feed_right_inner_area_card_content_txt">
                          <Link className="_feed_right_inner_area_card_content_txt_link" href="#0">
                            See All
                          </Link>
                        </span>
                      </div>
                      <form className="_feed_right_inner_area_card_form mb-3" onSubmit={(e) => e.preventDefault()}>
                        <svg
                          className="_feed_right_inner_area_card_form_svg"
                          xmlns="http://www.w3.org/2000/svg"
                          width="17"
                          height="17"
                          fill="none"
                          viewBox="0 0 17 17"
                        >
                          <circle cx="7" cy="7" r="6" stroke="#666"></circle>
                          <path stroke="#666" strokeLinecap="round" d="M16 16l-3-3"></path>
                        </svg>
                        <input className="form-control _feed_right_inner_area_card_form_inpt" type="search" placeholder="Search friends..." />
                      </form>
                    </div>
                    <div className="_feed_bottom_fixed" style={{ maxHeight: "400px", overflowY: "auto" }}>
                      <div className="_feed_right_inner_area_card_ppl d-flex justify-content-between align-items-center mb-3">
                        <div className="_feed_right_inner_area_card_ppl_box d-flex align-items-center">
                          <div className="_feed_right_inner_area_card_ppl_image me-2">
                            <img src="/assets/images/people1.png" alt="Steve" className="_box_ppl_img" />
                          </div>
                          <div className="_feed_right_inner_area_card_ppl_txt">
                            <h4 className="_feed_right_inner_area_card_ppl_title fw-bold fs-7 mb-0">Steve Jobs</h4>
                            <p className="_feed_right_inner_area_card_ppl_para text-muted mb-0 fs-8">CEO of Apple</p>
                          </div>
                        </div>
                        <div className="_feed_right_inner_area_card_ppl_side fs-9 text-muted">5 min ago</div>
                      </div>
                      <div className="_feed_right_inner_area_card_ppl d-flex justify-content-between align-items-center mb-3">
                        <div className="_feed_right_inner_area_card_ppl_box d-flex align-items-center">
                          <div className="_feed_right_inner_area_card_ppl_image me-2">
                            <img src="/assets/images/people2.png" alt="Ryan" className="_box_ppl_img" />
                          </div>
                          <div className="_feed_right_inner_area_card_ppl_txt">
                            <h4 className="_feed_right_inner_area_card_ppl_title fw-bold fs-7 mb-0">Ryan Roslansky</h4>
                            <p className="_feed_right_inner_area_card_ppl_para text-muted mb-0 fs-8">CEO of Linkedin</p>
                          </div>
                        </div>
                        <div className="_feed_right_inner_area_card_ppl_side">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 14 14">
                            <rect width="12" height="12" x="1" y="1" fill="#0ACF83" stroke="#fff" strokeWidth="2" rx="6" />
                          </svg>
                        </div>
                      </div>
                      <div className="_feed_right_inner_area_card_ppl d-flex justify-content-between align-items-center mb-3">
                        <div className="_feed_right_inner_area_card_ppl_box d-flex align-items-center">
                          <div className="_feed_right_inner_area_card_ppl_image me-2">
                            <img src="/assets/images/people3.png" alt="Dylan" className="_box_ppl_img" />
                          </div>
                          <div className="_feed_right_inner_area_card_ppl_txt">
                            <h4 className="_feed_right_inner_area_card_ppl_title fw-bold fs-7 mb-0">Dylan Field</h4>
                            <p className="_feed_right_inner_area_card_ppl_para text-muted mb-0 fs-8">CEO of Figma</p>
                          </div>
                        </div>
                        <div className="_feed_right_inner_area_card_ppl_side">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 14 14">
                            <rect width="12" height="12" x="1" y="1" fill="#0ACF83" stroke="#fff" strokeWidth="2" rx="6" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Friends Status Widget End */}

                  {/* Dark Mode Switcher Widget */}
                  <div className="_right_inner_area_info _padd_t24 _padd_b24 _padd_r24 _padd_l24 _b_radious6 _feed_inner_area mt-4">
                    <h4 className="_right_inner_area_info_content_title _title5 mb-3">Settings</h4>
                    <div className="d-flex align-items-center justify-content-between">
                      <span className="fs-7 fw-bold text-secondary">Dark Mode</span>
                      <div className="_layout_mode_swithing_btn">
                        <button type="button" onClick={toggleDarkMode} className="_layout_swithing_btn_link border-0 bg-transparent">
                          <div className={`_layout_swithing_btn ${isDarkMode ? "active" : ""}`}>
                            <div className="_layout_swithing_btn_round"></div>
                          </div>
                          <div className="_layout_change_btn_ic1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 20 20">
                              <path fill="#fff" d="M12.923 1.25a.625.625 0 01.109.704 7.5 7.5 0 0010.598 10.599.625.625 0 01.814.814 8.75 8.75 0 11-12.225-12.225.625.625 0 01.704.108zm-1.637 2.052A7.502 7.502 0 0018.04 18.04a7.503 7.503 0 00-6.753-14.738z" />
                            </svg>
                          </div>
                          <div className="_layout_change_btn_ic2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 20 20">
                              <path fill="#377DFF" d="M10 13.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5zm0-1.25a2.5 2.5 0 110-5 2.5 2.5 0 010 5zm0-8.75a.625.625 0 01.625.625v1.25a.625.625 0 11-1.25 0v-1.25A.625.625 0 0110 3.75zm0 11.25a.625.625 0 01.625.625v1.25a.625.625 0 11-1.25 0v-1.25a.625.625 0 01.625-.625zm6.25-6.25a.625.625 0 01.625-.625h1.25a.625.625 0 110 1.25h-1.25a.625.625 0 01-.625-.625zM2.5 8.75h1.25a.625.625 0 110 1.25H2.5a.625.625 0 110-1.25zm11.92-3.08a.625.625 0 01.884 0l.883.884a.625.625 0 11-.883.883l-.884-.883a.625.625 0 010-.884zM5.58 13.536a.625.625 0 01.884 0l.884.884a.625.625 0 11-.884.883l-.884-.883a.625.625 0 010-.884zm8.84 0a.625.625 0 010 .884l-.884.883a.625.625 0 11-.883-.883l.883-.884a.625.625 0 01.884 0zM5.58 5.67a.625.625 0 010-.884l.884-.883a.625.625 0 11.883.883l-.883.884a.625.625 0 01-.884 0z" />
                            </svg>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Dark Mode Switcher Widget End */}
                </div>
              </div>
            </div>
            {/* Right Sidebar End */}
          </div>
        </div>
      </div>
      {/* Main Body Section End */}

      {/* Mobile Bottom Navigation */}
      <div className="_mobile_navigation_bottom_wrapper">
        <div className="_mobile_navigation_bottom_wrap">
          <div className="container">
            <div className="row">
              <div className="col-xl-12 col-lg-12 col-md-12">
                <ul className="_mobile_navigation_bottom_list">
                  <li className="_mobile_navigation_bottom_item">
                    <Link href="/" className="_mobile_navigation_bottom_link _mobile_navigation_bottom_link_active">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="27" fill="none" viewBox="0 0 24 27">
                        <path
                          className="_mobile_svg"
                          fill="#000"
                          fillOpacity=".6"
                          stroke="#666666"
                          strokeWidth="1.5"
                          d="M1 13.042c0-2.094 0-3.141.431-4.061.432-.92 1.242-1.602 2.862-2.965l1.571-1.321C8.792 2.232 10.256 1 12 1c1.744 0 3.208 1.232 6.136 3.695l1.572 1.321c1.62 1.363 2.43 2.044 2.86 2.965.432.92.432 1.967.432 4.06v6.54c0 2.908 0 4.362-.92 5.265-.921.904-2.403.904-5.366.904H7.286c-2.963 0-4.445 0-5.365-.904C1 23.944 1 22.49 1 19.581v-6.54z"
                        />
                        <path fill="#fff" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.07 18.497h5.857v7.253H9.07v-7.253z" />
                      </svg>
                    </Link>
                  </li>
                  <li className="_mobile_navigation_bottom_item">
                    <Link href="/friend-request.html" className="_mobile_navigation_bottom_link">
                      <svg xmlns="http://www.w3.org/2000/svg" width="27" height="20" fill="none" viewBox="0 0 27 20">
                        <path
                          className="_dark_svg"
                          fill="#000"
                          fillOpacity=".6"
                          fillRule="evenodd"
                          d="M13.334 12.405h.138l.31.001c2.364.015 7.768.247 7.768 3.81 0 3.538-5.215 3.769-7.732 3.784h-.932c-2.364-.015-7.77-.247-7.77-3.805 0-3.543 5.405-3.774 7.77-3.789l.31-.001h.138zm0 1.787c-2.91 0-6.38.348-6.38 2.003 0 1.619 3.263 1.997 6.114 2.018l.266.001c2.91 0 6.379-.346 6.379-1.998 0-1.673-3.469-2.024-6.38-2.024zm9.742-2.27c2.967.432 3.59 1.787 3.59 2.849 0 .648-.261 1.83-2.013 2.48a.953.953 0 01-.327.058.919.919 0 01-.858-.575.886.886 0 01.531-1.153c.83-.307.83-.647.83-.81 0-.522-.682-.886-2.027-1.082a.9.9 0 01-.772-1.017c.074-.488.54-.814 1.046-.75zm-18.439.75a.9.9 0 01-.773 1.017c-1.345.196-2.027.56-2.027 1.082 0 .16 0 .491.832.81a.886.886 0 01.531 1.153.92.92 0 01-.858.575.953.953 0 01-.327-.058C.262 16.6 0 15.418 0 14.77c0-1.06.623-2.417 3.592-2.85.506-.061.97.263 1.045.751zM13.334 0c3.086 0 5.596 2.442 5.596 5.442 0 3.001-2.51 5.443-5.596 5.443H13.3a5.616 5.616 0 01-3.943-1.603A5.308 5.308 0 017.74 5.439C7.739 2.442 10.249 0 13.334 0zm0 1.787c-2.072 0-3.758 1.64-3.758 3.655-.003.977.381 1.89 1.085 2.58a3.772 3.772 0 002.642 1.076l.03.894v-.894c2.073 0 3.76-1.639 3.76-3.656 0-2.015-1.687-3.655-3.76-3.655zm7.58-.62c2.153.344 3.717 2.136 3.717 4.26-.004 2.138-1.647 3.972-3.82 4.269a.911.911 0 01-1.036-.761.897.897 0 01.782-1.01c1.273-.173 2.235-1.248 2.237-2.501 0-1.242-.916-2.293-2.179-2.494a.897.897 0 01-.756-1.027.917.917 0 011.055-.736zM6.81 1.903a.897.897 0 01-.757 1.027C4.79 3.13 3.874 4.182 3.874 5.426c.002 1.251.963 2.327 2.236 2.5.503.067.853.519.783 1.008a.912.912 0 01-1.036.762c-2.175-.297-3.816-2.131-3.82-4.267 0-2.126 1.563-3.918 3.717-4.262.515-.079.972.251 1.055.736z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </Link>
                  </li>
                  <li className="_mobile_navigation_bottom_item">
                    <Link href="#0" className="_mobile_navigation_bottom_link">
                      <svg xmlns="http://www.w3.org/2000/svg" width="25" height="27" fill="none" viewBox="0 0 25 27">
                        <path
                          className="_dark_svg"
                          fill="#000"
                          fillOpacity=".6"
                          fillRule="evenodd"
                          d="M10.17 23.46c.671.709 1.534 1.098 2.43 1.098.9 0 1.767-.39 2.44-1.099.36-.377.976-.407 1.374-.067.4.34.432.923.073 1.3-1.049 1.101-2.428 1.708-3.886 1.708h-.003c-1.454-.001-2.831-.608-3.875-1.71a.885.885 0 01.072-1.298 1.01 1.01 0 011.374.068zM12.663 0c5.768 0 9.642 4.251 9.642 8.22 0 2.043.549 2.909 1.131 3.827.576.906 1.229 1.935 1.229 3.88-.453 4.97-5.935 5.375-12.002 5.375-6.067 0-11.55-.405-11.998-5.296-.004-2.024.649-3.053 1.225-3.959l.203-.324c.501-.814.928-1.7.928-3.502C3.022 4.25 6.897 0 12.664 0zm0 1.842C8.13 1.842 4.97 5.204 4.97 8.22c0 2.553-.75 3.733-1.41 4.774-.531.836-.95 1.497-.95 2.932.216 2.316 1.831 3.533 10.055 3.533 8.178 0 9.844-1.271 10.06-3.613-.004-1.355-.423-2.016-.954-2.852-.662-1.041-1.41-2.221-1.41-4.774 0-3.017-3.161-6.38-7.696-6.38z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="_counting">6</span>
                    </Link>
                  </li>
                  <li className="_mobile_navigation_bottom_item">
                    <Link href="/chat" className="_mobile_navigation_bottom_link">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path
                          className="_dark_svg"
                          fill="#000"
                          fillOpacity=".6"
                          fillRule="evenodd"
                          d="M12.002 0c3.208 0 6.223 1.239 8.487 3.489 4.681 4.648 4.681 12.211 0 16.86-2.294 2.28-5.384 3.486-8.514 3.486-1.706 0-3.423-.358-5.03-1.097-.474-.188-.917-.366-1.235-.366-.366.003-.859.171-1.335.334-.976.333-2.19.748-3.09-.142-.895-.89-.482-2.093-.149-3.061.164-.477.333-.97.333-1.342 0-.306-.149-.697-.376-1.259C-1 12.417-.032 7.011 3.516 3.49A11.96 11.96 0 0112.002 0zm.001 1.663a10.293 10.293 0 00-7.304 3.003A10.253 10.253 0 002.63 16.244c.261.642.514 1.267.514 1.917 0 .649-.225 1.302-.422 1.878-.163.475-.41 1.191-.252 1.349.156.16.881-.092 1.36-.255.576-.195 1.228-.42 1.874-.424.648 0 1.259.244 1.905.503 3.96 1.818 8.645.99 11.697-2.039 4.026-4 4.026-10.509 0-14.508a10.294 10.294 0 00-7.303-3.002zm4.407 9.607c.617 0 1.117.495 1.117 1.109 0 .613-.5 1.109-1.117 1.109a1.116 1.116 0 01-1.12-1.11c0-.613.494-1.108 1.11-1.108h.01zm-4.476 0c.616 0 1.117.495 1.117 1.109 0 .613-.5 1.109-1.117 1.109a1.116 1.116 0 01-1.121-1.11c0-.613.493-1.108 1.11-1.108h.01zm-4.477 0c.617 0 1.117.495 1.117 1.109 0 .613-.5 1.109-1.117 1.109a1.116 1.116 0 01-1.12-1.11c0-.613.494-1.108 1.11-1.108h.01z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="_counting">2</span>
                    </Link>
                  </li>
                  <div className="_header_mobile_toggle">
                    <button
                      type="button"
                      onClick={() => alert("Menu toggled")}
                      className="_header_mobile_btn_link border-0 bg-transparent"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="14" fill="none" viewBox="0 0 18 14">
                        <path stroke="#666" strokeLinecap="round" strokeWidth="1.5" d="M1 1h16M1 7h16M1 13h16" />
                      </svg>
                    </button>
                  </div>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Mobile Bottom Navigation End */}
    </div>
  );
}
