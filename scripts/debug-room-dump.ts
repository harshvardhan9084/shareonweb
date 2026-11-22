// Debug: join a room and dump the snapshot's file transfer state.
import { io } from "socket.io-client";

const code = process.argv[2] ?? "5RZW8Q";
const socket = io("http://localhost:3003", { transports: ["websocket"], path: "/" });

socket.on("connect", () => {
  socket.emit("join", { code, name: "DebugDumper", device: "desktop", clientId: "debug-dumper" }, (res) => {
    if (!res?.ok) {
      console.log("join failed:", JSON.stringify(res));
      process.exit(1);
    }
    const s = res.state;
    console.log("participants:", s.participants.length);
    for (const p of s.participants) {
      console.log(`  p: id=${p.id} name=${p.name} device=${p.device} joinedAt=${(p as Record<string, unknown>).joinedAt}`);
    }
    console.log("appEvents:", s.appEvents.length);
    console.log("strokes:", (s.strokes ?? []).length);
    for (const st of (s.strokes ?? []) as Array<{ strokeId: string; ownerId: string; mode: string; points: number[][] }>) {
      console.log(
        `  stroke ${st.strokeId} owner=${st.ownerId} mode=${st.mode} points=${st.points.length}`,
      );
    }
    for (const ev of s.appEvents) {
      if (ev.type === "present:slide" || ev.type === "present:slide:remove" || ev.type === "present:index") {
        console.log("  event:", ev.type, JSON.stringify(ev.payload).slice(0, 120));
      }
    }
    console.log("files:", s.files.length);
    for (const f of s.files) {
      const nonNull = (f.chunks ?? []).filter((c) => c != null).length;
      const totalChars = (f.chunks ?? []).reduce((a, c) => a + (c?.length ?? 0), 0);
      console.log(
        `  file ${f.fileId} name=${f.name} size=${f.size} type=${f.type} chunkCount=${f.chunkCount} chunksNonNull=${nonNull} complete=${f.complete} slot=${f.slot} b64chars=${totalChars}`,
      );
      (f.chunks ?? []).forEach((c, i) => {
        if (c == null) { console.log(`    chunk ${i}: NULL`); return; }
        const valid = /^[A-Za-z0-9+/=\r\n]+$/.test(c);
        let decodable = false;
        let decodedLen = 0;
        try { decodedLen = Buffer.from(c, "base64").length; decodable = true; } catch { /* noop */ }
        const badChars = c.replace(/[A-Za-z0-9+/=]/g, "").slice(0, 40);
        console.log(
          `    chunk ${i}: len=${c.length} charsetOK=${valid} decodable=${decodable} decodedLen=${decodedLen} badChars=${JSON.stringify(badChars)}`,
        );
      });
    }
    process.exit(0);
  });
});
socket.on("connect_error", (e) => {
  console.log("connect_error:", String(e));
  process.exit(1);
});
setTimeout(() => { console.log("timeout"); process.exit(1); }, 10000);
