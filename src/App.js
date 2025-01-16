// ## frontend/src/App.js
import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

function App() {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // Поле для RTSP-URL
  const [rtspUrl, setRtspUrl] = useState("");

  useEffect(() => {
    // Инициализируем Hls один раз
    if (Hls.isSupported()) {
      hlsRef.current = new Hls({ debug: true });

      // Загружаем "стандартный" поток при старте
      hlsRef.current.loadSource("http://localhost:8000/stream/index.m3u8");
      hlsRef.current.attachMedia(videoRef.current);

      hlsRef.current.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log("HLS манифест загружен, пробуем play()");
        videoRef.current.play().catch((err) => {
          console.error("Autoplay error:", err);
        });
      });
    } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      // Для Safari
      videoRef.current.src = "http://localhost:8000/stream/index.m3u8";
      videoRef.current.addEventListener("loadedmetadata", () => {
        videoRef.current.play().catch((err) => {
          console.error("Autoplay error (Safari):", err);
        });
      });
    }
  }, []);

  // Функция отправки нового RTSP
  const handleConnect = async () => {
    try {
      // 1) Отправляем на бекенд новый RTSP
      const resp = await fetch("http://localhost:8000/api/set-rtsp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rtspUrl }),
      });
      if (!resp.ok) {
        console.error("Ошибка при установке RTSP:", resp.statusText);
      } else {
        console.log("RTSP-URL успешно установлен:", rtspUrl);

        // 2) Заново подгружаем тот же /stream/index.m3u8
        if (hlsRef.current) {
          // Остановка предыдущего буферизации (не обязательно, но иногда помогает)
          hlsRef.current.stopLoad();

          // Загружаем заново
          hlsRef.current.loadSource("http://localhost:8000/stream/index.m3u8");
          // Запуск буферизации
          hlsRef.current.startLoad(-1);
        }

        // 3) Перезапускаем video (тоже не всегда обязательно)
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.load();
          videoRef.current
            .play()
            .catch((err) => console.error("Play error:", err));
        }
      }
    } catch (err) {
      console.error("Ошибка при handleConnect:", err);
    }
  };

  return (
    <div style={{ textAlign: "center" }}>
      <h1 className="text-xl my-2">IP-camera</h1>

      <div style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="Введите RTSP-URL"
          value={rtspUrl}
          onChange={(e) => setRtspUrl(e.target.value)}
          style={{ width: "60%", padding: "8px" }}
        />
        <button
          onClick={handleConnect}
          style={{ marginLeft: "0.5rem", padding: "8px 16px" }}
        >
          Подключиться
        </button>
      </div>

      <div className="w-full flex justify-center my-4">
        <video
          ref={videoRef}
          controls
          muted
          style={{ width: "90%", background: "#000" }}
        />
      </div>
    </div>
  );
}

export default App;
