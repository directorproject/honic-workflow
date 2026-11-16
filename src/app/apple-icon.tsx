import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home-screen / Safari pin icon. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1c2c",
          borderRadius: 40,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -24,
            right: -24,
            width: 120,
            height: 120,
            borderRadius: 999,
            background: "#12324a",
          }}
        />
        <div
          style={{
            fontSize: 110,
            fontWeight: 800,
            color: "#ffffff",
            fontFamily: "Segoe UI, Helvetica, Arial, sans-serif",
            lineHeight: 1,
          }}
        >
          N
        </div>
        <div
          style={{
            position: "absolute",
            top: 28,
            right: 28,
            width: 22,
            height: 22,
            borderRadius: 999,
            background: "#7dd3fc",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 28,
            left: 28,
            width: 22,
            height: 22,
            borderRadius: 999,
            background: "#7dd3fc",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
