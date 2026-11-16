"use client";
import Image from "next/image";
import { useState } from "react";

export default function AdminReviewAvatar({ userId, name, hasPhoto, professional = false }: { userId: number; name: string; hasPhoto: boolean; professional?: boolean }) {
  const [failed, setFailed] = useState(false);
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? "").join("") || "?";
  return <span className={`ar-avatar${professional ? " ar-avatar-pro" : ""}`} aria-hidden="true">
    {hasPhoto && !failed ? <Image src={`/api/admin/users/${userId}/avatar`} alt="" width={36} height={36} unoptimized onError={() => setFailed(true)}/> : initials}
  </span>;
}
