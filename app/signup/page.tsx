"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert("회원가입 실패: " + error.message);
      return;
    }

    alert("회원가입 완료! 이메일 인증이 필요할 수 있습니다.");
  }

  return (
    <main style={{ maxWidth: 420, margin: "80px auto", padding: 20 }}>
      <h1>회원가입</h1>

      <form onSubmit={handleSignup}>
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 12, marginBottom: 10 }}
          required
        />

        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 12, marginBottom: 10 }}
          required
        />

        <button type="submit" style={{ width: "100%", padding: 12 }}>
          회원가입
        </button>
      </form>
    </main>
  );
}