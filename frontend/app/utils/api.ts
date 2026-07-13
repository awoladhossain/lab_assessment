const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050/api";


function getHeaders(isMultipart = false): HeadersInit {
  const headers: HeadersInit = {};
  
  if (!isMultipart) {
    headers["Content-Type"] = "application/json";
  }
  
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("auth_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  
  return headers;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
  isMultipart = false
): Promise<T> {
  const url = `${API_BASE_URL}/${path.replace(/^\//, "")}`;
  
  const headers = {
    ...getHeaders(isMultipart),
    ...options.headers,
  };
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    let errorMessage = "An error occurred";
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch (_) {
      // ignore
    }
    throw new Error(errorMessage);
  }
  
  // For endpoints like logout which might not return JSON or return empty
  if (response.status === 204) {
    return {} as T;
  }
  
  try {
    return await response.json();
  } catch (_) {
    return {} as T;
  }
}

// User interfaces
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface PostLike {
  postId: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface CommentLike {
  commentId: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface Comment {
  id: string;
  text: string;
  postId: string;
  parentId: string | null;
  authorId: string;
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  commentLikes?: CommentLike[];
  isLiked?: boolean;
  likesCount?: number;
  likedBy?: { id: string; name: string }[];
  replies?: Comment[];
}

export interface Post {
  id: string;
  text: string;
  imageUrl: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  authorId: string;
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  postLikes?: PostLike[];
  isLiked?: boolean;
  likesCount?: number;
  likedBy?: { id: string; name: string }[];
  comments: Comment[];
}

