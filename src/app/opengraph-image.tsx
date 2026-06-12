import { ImageResponse } from "next/og";
import { DEFAULT_DESCRIPTION, SITE_NAME } from "@/lib/seo";

export const alt = `${SITE_NAME} — Job Support & Tech Consulting for Software Engineers`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #020617 0%, #0f172a 45%, #1e1b4b 100%)",
          padding: "64px 72px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #3b82f6, #7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "28px",
              fontWeight: 800,
            }}
          >
            D
          </div>
          <span
            style={{
              fontSize: "36px",
              fontWeight: 800,
              background: "linear-gradient(90deg, #60a5fa, #a78bfa)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {SITE_NAME}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "900px" }}>
          <div
            style={{
              fontSize: "56px",
              fontWeight: 800,
              color: "#f8fafc",
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            Job Support & Tech Consulting for Software Engineers
          </div>
          <div
            style={{
              fontSize: "26px",
              color: "#94a3b8",
              lineHeight: 1.45,
            }}
          >
            {DEFAULT_DESCRIPTION}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          {["Resume Support", "Interview Prep", "Debugging", "Code Review"].map((tag) => (
            <div
              key={tag}
              style={{
                padding: "10px 18px",
                borderRadius: "999px",
                background: "rgba(59, 130, 246, 0.15)",
                border: "1px solid rgba(96, 165, 250, 0.35)",
                color: "#bfdbfe",
                fontSize: "18px",
                fontWeight: 600,
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
