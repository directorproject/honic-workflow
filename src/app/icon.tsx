import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Browser tab favicon — Nexis N mark. */
export default function Icon() {
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
          borderRadius: 14,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -10,
            right: -10,
            width: 42,
            height: 42,
            borderRadius: 999,
            background: "#12324a",
          }}
        />
        <div
          style={{
            fontSize: 38,
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
            top: 10,
            right: 10,
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "#7dd3fc",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 10,
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "#7dd3fc",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
