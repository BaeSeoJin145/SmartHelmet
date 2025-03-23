// 📌 Service Worker 설치 이벤트
self.addEventListener("install", (event) => {
    console.log("✅ Service Worker 설치 완료");
    self.skipWaiting(); // 즉시 활성화
});

// 📌 Service Worker 활성화 이벤트
self.addEventListener("activate", (event) => {
    console.log("✅ Service Worker 활성화 완료");
    event.waitUntil(self.clients.claim()); // 모든 클라이언트 제어
});

self.addEventListener("push", async (event) => {
    console.log("📌 푸시 알림 수신:", event);
    
    let notificationData = {};

    if (event.data) {
        // 먼저 텍스트 형태로 데이터를 읽는다.
        let textData = "";
        try {
            textData = await event.data.text();
            console.log("푸시 데이터 (텍스트):", textData);
        } catch (readError) {
            console.error("🚨 푸시 데이터 텍스트 읽기 실패:", readError);
        }
        
        // 읽은 텍스트를 JSON 파싱 시도
        try {
            notificationData = JSON.parse(textData);
            console.log("푸시 데이터 (JSON):", notificationData);
        } catch (parseError) {
            console.warn("🚨 JSON 파싱 실패, 일반 텍스트 처리:", parseError);
            notificationData = { title: "📢 New Message", body: textData };
        }
    }

    const title = notificationData.title || "🚴 Ride Smart, Stay Safe";
    const options = {
        body: notificationData.body || "Your Ultimate Companion for a Smooth Journey.",
        icon: notificationData.icon || "/icons/icon-192x192.png",
        badge: notificationData.badge || "/icons/icon-96x96.png",
        vibrate: [200, 100, 200],
        actions: [
            { action: "open", title: "열기" },
            { action: "dismiss", title: "닫기" }
        ]
    };

    event.waitUntil(self.registration.showNotification(title, options));
});


// 📌 알림 클릭 시 앱 열기
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    if (event.action === "open") {
        event.waitUntil(clients.openWindow("/"));
    }
});
