"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("로그인 실패: " + error.message);
      return;
    }

    alert("로그인 성공");
    router.push("/dashboard");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050505",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#111",
          border: "1px solid #2a2a2a",
          borderRadius: "18px",
          padding: "34px 28px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <div
            style={{
              fontSize: "14px",
              color: "#ff4fa0",
              letterSpacing: "3px",
              marginBottom: "10px",
            }}
          >
            PRIVATE ZONE
          </div>

          <h1
            style={{
              fontSize: "28px",
              margin: 0,
              fontWeight: 800,
            }}
          >
            PINK ZONE
          </h1>

          <p
            style={{
              marginTop: "12px",
              color: "#999",
              fontSize: "14px",
              lineHeight: 1.6,
            }}
          >
            회원만 입장 가능한 비공개 공간입니다.
            <br />
            로그인 후 이용해주세요.
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <label
            style={{
              display: "block",
              fontSize: "13px",
              color: "#aaa",
              marginBottom: "8px",
            }}
          >
            이메일
          </label>

          <input
            type="email"
            placeholder="이메일을 입력하세요"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "14px",
              marginBottom: "16px",
              borderRadius: "10px",
              border: "1px solid #333",
              background: "#1b1b1b",
              color: "#fff",
              outline: "none",
            }}
          />

          <label
            style={{
              display: "block",
              fontSize: "13px",
              color: "#aaa",
              marginBottom: "8px",
            }}
          >
            비밀번호
          </label>

          <input
            type="password"
            placeholder="비밀번호를 입력하세요"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "14px",
              marginBottom: "22px",
              borderRadius: "10px",
              border: "1px solid #333",
              background: "#1b1b1b",
              color: "#fff",
              outline: "none",
            }}
          />

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "15px",
              borderRadius: "10px",
              border: "none",
              background: "#ff4fa0",
              color: "#fff",
              fontSize: "16px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            로그인
          </button>
        </form>

        <div
          style={{
            textAlign: "center",
            marginTop: "20px",
            fontSize: "14px",
            color: "#888",
          }}
        >
          아직 계정이 없다면{" "}
          <a
            href="/signup"
            style={{
              color: "#ff4fa0",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            회원가입
          </a>
        </div>
      </div>
    </main>
  );
}