// frontend/src/App.js
import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

function App() {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // Текущий RTSP (установленный)
  const [currentRtspUrl, setCurrentRtspUrl] = useState("");
  // Новый RTSP (пользовательский ввод)
  const [newRtspUrl, setNewRtspUrl] = useState("");

  // Флаг — ждать ли перезагрузку страницы при получении SSE
  const [shouldReloadOnPlaylistUpdate, setShouldReloadOnPlaylistUpdate] =
    useState(false);

  // Подключение к SSE (одноразово)
  useEffect(() => {
    const eventSource = new EventSource(
      "http://localhost:8000/api/hls-updates"
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "playlist-updated") {
          console.log("Получили SSE: playlist-updated");
          // Перезагружаемся только если выставлен флаг
          if (shouldReloadOnPlaylistUpdate) {
            window.location.reload();
          }
        }
      } catch (err) {
        console.error("Ошибка обработки SSE:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE ошибка:", err);
    };

    return () => {
      eventSource.close();
    };
  }, [shouldReloadOnPlaylistUpdate]);

  // Инициализация Hls и проигрывание
  useEffect(() => {
    if (Hls.isSupported()) {
      hlsRef.current = new Hls({ debug: true });
      hlsRef.current.loadSource("http://localhost:8000/stream/index.m3u8");
      hlsRef.current.attachMedia(videoRef.current);

      hlsRef.current.on(Hls.Events.MANIFEST_PARSED, () => {
        videoRef.current
          .play()
          .catch((err) => console.error("Autoplay error:", err));
      });
    } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      // Для Safari
      videoRef.current.src = "http://localhost:8000/stream/index.m3u8";
      videoRef.current.addEventListener("loadedmetadata", () => {
        videoRef.current
          .play()
          .catch((err) => console.error("Autoplay error (Safari):", err));
      });
    }
  }, []);

  // Когда нажимаем "Подключиться"
  const handleConnect = async () => {
    // Проверяем, действительно ли новый URL отличается от текущего
    if (!newRtspUrl || newRtspUrl === currentRtspUrl) {
      console.log("URL не изменился — не пересоздаём поток");
      return;
    }

    try {
      const resp = await fetch("http://localhost:8000/api/set-rtsp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rtspUrl: newRtspUrl }),
      });
      if (!resp.ok) {
        console.error("Ошибка при установке RTSP:", resp.statusText);
      } else {
        console.log("RTSP-URL успешно установлен:", newRtspUrl);

        // Запоминаем, что у нас теперь текущий URL изменился
        setCurrentRtspUrl(newRtspUrl);

        // Устанавливаем флаг — теперь, когда index.m3u8 обновится, мы хотим перезагрузку
        setShouldReloadOnPlaylistUpdate(true);

        // Перезапускаем Hls (не обязательно, если всё равно собираемся делать reload,
        // но иногда полезно, если до reload нужно успеть что-то показать)
        if (hlsRef.current) {
          hlsRef.current.stopLoad();
          hlsRef.current.loadSource("http://localhost:8000/stream/index.m3u8");
          hlsRef.current.startLoad(-1);
        }
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
          value={newRtspUrl}
          onChange={(e) => setNewRtspUrl(e.target.value)}
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
