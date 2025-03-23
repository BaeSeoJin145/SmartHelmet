// 🔹 Firebase SDK 가져오기
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getDatabase, ref, set, get, child ,update, onValue} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";


// 🔹 라이딩 관련 변수
let rideStartTime = null; // 라이딩 시작 시간
let rideTimer = null; // 타이머
let rideDistance = 0; // 주행 거리 (km)
let rideCalories = 0; // 소모 칼로리
let ridePace = 0; // 평균 페이스 (km/h)
let recordIndex = 1;  // 🔥 기록 번호
let prevCoords = null; // 이전 GPS 좌표 저장



// 🔹 Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyDFjfJrHpRcAaIi4cvJ2wAL2SdqUYbN270",
    authDomain: "smartdb-9fe91.firebaseapp.com",
    projectId: "smartdb-9fe91",
    storageBucket: "smartdb-9fe91.appspot.com",
    messagingSenderId: "270580747139",
    appId: "1:270580747139:web:a7e28a63e20ea410b284b6",
    databaseURL: "https://smartdb-9fe91-default-rtdb.asia-southeast1.firebasedatabase.app"  // 🔹 데이터베이스 URL 추가
};

// 🔹 Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app); 


// ─────────────────────────────────────────────────────
// 🔹 로그인 상태 확인 및 사용자 정보 표시
// - 로그인한 사용자의 이름을 Realtime Database에서 가져와 표시
// - 로그인하지 않은 경우 index.html로 이동
// ─────────────────────────────────────────────────────
const userInfo = document.getElementById("user-info");
if (userInfo) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userRef = ref(db, "users/" + user.uid);
            get(userRef).then((snapshot) => {
                if (snapshot.exists()) {
                    userInfo.textContent = `환영합니다, ${snapshot.val().name}님!`;
                } else {
                    userInfo.textContent = `환영합니다, ${user.email}!`;
                }
            }).catch((error) => {
                console.error("사용자 정보 가져오기 실패:", error);
            });
        } else {
            window.location.href = "index.html";
        }
    });
}
// ─────────────────────────────────────────────────────
// 🔹 로그인 상태 확인 및 사용자 UID 전달
// ─────────────────────────────────────────────────────
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./script/service-worker.js", { scope: "./script/" })
        .then(async (registration) => {
            console.log("✅ Service Worker 등록 완료");

            // 🔹 주기적인 푸시 알림 대체 방식 (setTimeout 사용)
            setInterval(async () => {
                console.log("🔔 30분마다 푸시 알림 요청 중...");
                await registration.showNotification("🚴 Ride Smart Update", {
                    body: "Time for your next ride update!",
                    icon: "/icons/icon-192x192.png",
                    badge: "/icons/icon-96x96.png",
                    vibrate: [200, 100, 200]
                });
            }, 30 * 60 * 1000); // 30분 간격

            // 🔹 사용자 UID 전달
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    navigator.serviceWorker.ready.then((registration) => {
                        registration.active.postMessage({
                            type: "userData",
                            uid: user.uid
                        });
                    });
                }
            });
        })
        .catch((error) => {
            console.error("❌ Service Worker 등록 실패:", error);
            alert("Service Worker 등록에 실패했습니다. 페이지를 새로고침해 주세요.");
        });
}

// ─────────────────────────────────────────────────────
// 🔹 알림 권한 요청 (필수)
// ─────────────────────────────────────────────────────
async function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.warn("🚨 이 브라우저는 알림을 지원하지 않음");
        return;
    }

    const permission = await Notification.requestPermission();
    
    if (permission === "granted") {
        console.log("✅ 알림 권한 승인됨");
    } else {
        console.warn("🚨 알림 권한 거부됨:", permission);
        showNotificationPermissionButton();
    }
}

function showNotificationPermissionButton() {
    const button = document.createElement("button");
    button.textContent = "알림 권한 허용";
    button.addEventListener("click", requestNotificationPermission);
    document.body.appendChild(button);
}

// 페이지 로드 시 알림 권한 요청 실행
requestNotificationPermission();

// ─────────────────────────────────────────────────────
// 🔹 정보
// ─────────────────────────────────────────────────────

// HTML 요소 선택
const nameElement = document.querySelector(".text-wrapper-2-name");
const ageElement = document.querySelector(".text-wrapper-3-age");
const genderElement = document.querySelector(".text-wrapper-7-gender");

// 요소가 모두 존재하는 경우에만 실행
if (nameElement || ageElement || genderElement) {
    // 🔹 현재 로그인된 사용자 정보 가져오기
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log(`✅ 로그인된 사용자 UID: ${user.uid}`);
            loadUserProfile(user.uid);
        } else {
            console.log("❌ 로그인되지 않음");
            nameElement.textContent = "로그인 필요";
            ageElement.textContent = "";
            genderElement.textContent = "";
        }
    });

    // 🔹 사용자 프로필 정보 불러오기
    function loadUserProfile(uid) {
        const nameRef = ref(db, `users/${uid}/name`);
        const ageRef = ref(db, `users/${uid}/emergencyInfo/age`);
        const genderRef = ref(db, `users/${uid}/emergencyInfo/gender`);

        // 이름 불러오기
        get(nameRef).then((snapshot) => {
            nameElement.textContent = snapshot.exists() ? snapshot.val() : "이름 없음";
        }).catch((error) => {
            console.error("❌ 이름 불러오기 실패:", error);
            nameElement.textContent = "오류 발생";
        });

        // 나이 불러오기
        get(ageRef).then((snapshot) => {
            ageElement.textContent = snapshot.exists() ? `Age : ${snapshot.val()}` : "나이 없음";
        }).catch((error) => {
            console.error("❌ 나이 불러오기 실패:", error);
            ageElement.textContent = "오류 발생";
        });

        // 성별 불러오기
        get(genderRef).then((snapshot) => {
            genderElement.textContent = snapshot.exists() ? `Gender : ${snapshot.val()}` : "성별 없음";
        }).catch((error) => {
            console.error("❌ 성별 불러오기 실패:", error);
            genderElement.textContent = "오류 발생";
        });
    }
} else {
    console.warn("⚠ 필요한 요소가 존재하지 않음. 스크립트 실행을 중단합니다.");
}

// ─────────────────────────────────────────────────────
// 🔹 충격 감지 센서
// ─────────────────────────────────────────────────────

// 사용자의 로그인 여부 확인
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log(`✅ 로그인된 사용자: ${user.uid}`);

        const userUID = user.uid; // 현재 로그인한 사용자의 UID
        const shockSensorRef = ref(db, `users/${userUID}/shockSensor/status`);

        // 🔹 1초마다 상태 확인
        setInterval(() => {
            get(shockSensorRef).then((snapshot) => {
                const status = snapshot.val();
                console.log(`🔍 현재 충격 감지 상태: ${status}`);

                if (status === 1) {
                    console.log("🚨 충격 감지됨! 긴급 전화 실행");
                    callEmergencyNumber(userUID);
                }
            }).catch((error) => {
                console.error("❌ 데이터 가져오기 오류:", error);
            });
        }, 1000); // 1초마다 실행

    } else {
        console.log("❌ 로그인되지 않음 - 충격 감지 기능 비활성화");
    }
});

// 🔹 긴급 전화 실행 (로그인한 사용자의 UID 기반)
function callEmergencyNumber(userUID) {
    const emergencyRef = ref(db, `users/${userUID}/emergencyInfo/phone`);
    const shockSensorRef = ref(db, `users/${userUID}/shockSensor/status`);

    get(emergencyRef).then((snapshot) => {
        const phoneNumber = snapshot.val();
        if (phoneNumber) {
            console.log(`📞 ${phoneNumber}로 전화 걸기`);

            window.location.href = `tel:${phoneNumber}`; // 자동 전화 걸기

            // 🔹 5초 후 shockSensor 값을 0으로 초기화
            setTimeout(() => {
                set(shockSensorRef, 0)
                    .then(() => console.log("✅ 3초 후 충격 감지 상태 초기화 완료 (0)"))
                    .catch(error => console.error("❌ 상태 초기화 오류:", error));
            }, 3000); // 5초 (5000ms) 딜레이
        }
    }).catch((error) => {
        console.error("❌ 전화번호 가져오기 오류:", error);
    });
}




// ─────────────────────────────────────────────────────
// 🔹 칼로리 페이스 탑승 시간
// ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    const getRecord = document.getElementById("get-record");

    // 🔹 기록을 표시할 요소들
    const rideTime = document.getElementById("ride-time");
    const rideDistance = document.getElementById("ride-distance");
    const rideSpeed = document.getElementById("ride-speed");
    const rideCalories = document.getElementById("ride-calories");
    const rideDate = document.getElementById("ride-date");

    if (!getRecord) {
        console.error("❌ 'get-record' 버튼을 찾을 수 없습니다.");
        return;
    }

    function loadRideRecord(userUId) {
        console.log("loadRideRecord 실행됨!");

        const recordRef = ref(db, `users/${userUId}/records/1`);

        get(recordRef)
            .then((snapshot) => {
                if (!snapshot.exists()) {
                    console.log("🚫 기록 없음");
                    rideTime.textContent = "기록 없음";
                    rideDistance.textContent = "-";
                    rideSpeed.textContent = "-";
                    rideCalories.textContent = "-";
                    rideDate.textContent = "-";
                    return;
                }

                const record = snapshot.val();
                console.log("✅ 불러온 데이터:", record);

                // ✅ 기존 디자인에 맞춰서 데이터 삽입
                rideTime.textContent = formatTime(record.duration);
                rideDistance.textContent = `${record.Distance} km`;
                rideSpeed.textContent = `${record.pace.toFixed(2)} km/h`;
                rideCalories.textContent = `${record.calories} Cal`;
                rideDate.textContent = new Date(record.timestamp).toLocaleDateString();
            })
            .catch((error) => {
                console.error("❌ 데이터 불러오기 오류:", error);
                rideTime.textContent = "오류 발생";
                rideDistance.textContent = "-";
                rideSpeed.textContent = "-";
                rideCalories.textContent = "-";
                rideDate.textContent = "-";
            });
    }

    function formatTime(seconds) {
        let minutes = Math.floor(seconds / 60);
        let secs = seconds % 60;
        return `${minutes}m ${secs}s`;
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log(`✅ 로그인된 사용자: ${user.uid}`);
            getRecord.addEventListener("click", () => {
                console.log("🔘 기록 불러오기 버튼 클릭됨!");
                loadRideRecord(user.uid);
            });
        } else {
            console.log("❌ 로그인되지 않음");
            rideTime.textContent = "로그인 필요";
            rideDistance.textContent = "-";
            rideSpeed.textContent = "-";
            rideCalories.textContent = "-";
            rideDate.textContent = "-";
        }
    });
});


// ─────────────────────────────────────────────────────
// 🔹 회원가입 기능 (Realtime Database 사용)
// - 사용자가 입력한 이메일, 비밀번호로 회원가입
// - Realtime Database에 사용자 정보 저장 후 로그인 페이지로 이동
// ─────────────────────────────────────────────────────
const signupBtn = document.getElementById("signup-btn");
if (signupBtn) {
    signupBtn.addEventListener("click", async (event) => {
        event.preventDefault();

        const nameInput = document.getElementById("name");
        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");
        const passwordConfirmInput = document.getElementById("password-confirm");


        if (!nameInput || !emailInput || !passwordInput || !passwordConfirmInput) return;

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const passwordConfirm = passwordConfirmInput.value;

        if (password !== passwordConfirm) {
            alert("비밀번호가 일치하지 않습니다. 다시 확인해주세요.");
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            console.log("회원가입 성공, UID:", user.uid);

            // 🔹 Realtime Database에 사용자 정보 저장
            await set(ref(db, "users/" + user.uid), {
                name: name,
                email: email
            }).then(() => {
                console.log("용자 정보 Realtime Database 저장 완료!");
                alert("회원가입 성공!");
                window.location.href = "login.html"; 
            }).catch((error) => {
                console.error("데이터 저장 실패:", error);
                alert("데이터 저장 오류: " + error.message);
            });

        } catch (error) {
            console.error("회원가입 오류:", error);
            alert("회원가입 오류: " + error.message);
        }
    });
}

// ─────────────────────────────────────────────────────
// 🔹 로그인 기능
// - Firebase Authentication으로 로그인 처리
// - 로그인 성공 시 Realtime Database에서 사용자 이름을 가져와 표시
// ─────────────────────────────────────────────────────
const loginBtn = document.getElementById("login-btn");
if (loginBtn) {
    loginBtn.addEventListener("click", async (event) => {
        event.preventDefault();

        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");

        if (!emailInput || !passwordInput) return;

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            console.log("로그인 성공, UID:", user.uid);

            // 🔹 Realtime Database에서 사용자 정보 가져오기
            const userRef = ref(db, "users/" + user.uid);
            get(userRef).then((snapshot) => {
                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    alert(`로그인 성공! 환영합니다, ${userData.name}!`);
                    window.location.href = "main.html";
                } else {
                    alert("사용자 정보가 없습니다.");
                }
            }).catch((error) => {
                console.error("사용자 정보 가져오기 실패:", error);
                alert("사용자 정보 오류: " + error.message);
            });

        } catch (error) {
            console.error("로그인 오류:", error);
            alert("로그인 오류: " + error.message);
        }
    });
}

// ─────────────────────────────────────────────────────
// 🔹 로그아웃 기능
// - 로그아웃 시 index.html로 이동
// ─────────────────────────────────────────────────────
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await signOut(auth);
        alert("로그아웃 완료!");
        window.location.href = "index.html";
    });
}

// ─────────────────────────────────────────────────────
// 🔹 긴급 신고 서비스 설정
// - 전화번호, 성별, 나이, 혈액형
// - 취소, 저장
// ─────────────────────────────────────────────────────
const saveEmerInfoBtn = document.getElementById("emer-save-btn");
const cancelEmerInfoBtn = document.getElementById("emer-cancel-btn");

if(cancelEmerInfoBtn){
    cancelEmerInfoBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        const phoneInput = document.getElementById("phone-num");
        const genderInput = document.getElementById("gender");
        const ageInput = document.getElementById("age");
        const bloodTypeInput = document.getElementById("blood-type");
        const weightInput = document.getElementById("weight-btn");

        if (phoneInput) phoneInput.value = "";
        if (genderInput) genderInput.value = "";
        if (ageInput) ageInput.value = "";
        if (bloodTypeInput) bloodTypeInput.value = "";
        if (weightInput) weightInput.value="";
    })
}

if (saveEmerInfoBtn) {
    
    saveEmerInfoBtn.addEventListener("click", async (event) => {
        event.preventDefault();

        const phoneInput = document.getElementById("phone-num");
        const genderInput = document.getElementById("gender");
        const ageInput = document.getElementById("age");
        const bloodTypeInput = document.getElementById("blood-type");
        const weightInput = document.getElementById("weight-btn");

        if (!phoneInput || !genderInput || !ageInput || !bloodTypeInput || !weightInput) return;

        const phone = phoneInput.value.trim();
        const gender = genderInput.value.trim();
        const age = ageInput.value.trim();
        const bloodType = bloodTypeInput.value.trim();
        const weight = weightInput.value.trim();


        if (!phone || !gender || !age || !bloodType || !weight) {
            alert("모든 필드를 입력해주세요.");
            return;
        }

        try {
            const user = auth.currentUser; 
            if (!user) {
                alert("로그인이 필요합니다.");
                return;
            }

            const userUID = user.uid;

            await set(ref(db, "users/" + userUID + "/emergencyInfo"), {
                phone: phone,
                gender: gender,
                age: age,
                bloodType: bloodType,
                weight: weight
            }).then(() => {
                console.log("응급 정보 저장 완료!");
                alert("응급 정보가 저장되었습니다.");
                if (phoneInput) phoneInput.value = "";
                if (genderInput) genderInput.value = "";
                if (ageInput) ageInput.value = "";
                if (bloodTypeInput) bloodTypeInput.value = "";
                if (weightInput) weightInput.value = "";
            }).catch((error) => {
                console.error("응급 정보 저장 실패:", error);
                alert("데이터 저장 오류: " + error.message);
            });

        } catch (error) {
            console.error("응급 정보 저장 오류:", error);
            alert("저장 중 오류 발생: " + error.message);
        }
    });
}

// ─────────────────────────────────────────────────────
// 🔹 근처 ESP32 센서 검색 & 연결 기능
// ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    console.log("[로드 완료] 이벤트 리스너 등록 시작");

    const scanDevicesBtn = document.getElementById("scan-devices-btn");
    const deviceList = document.getElementById("device-list");
    const connectDeviceBtn = document.getElementById("connect-device-btn");
    const goBackBtn = document.getElementById("go-back-btn");

    let selectedDeviceIP = null; // 선택한 ESP32 IP 저장

    // 🔹 Firebase에서 현재 로그인한 사용자 UID 가져오기
    let currentUserUID = null;
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUserUID = user.uid;
            console.log(`[UID 확인] 현재 사용자: ${currentUserUID}`);
        } else {
            console.warn("[경고] 로그인된 사용자가 없습니다.");
        }
    });

    // 🔹 ESP32 검색 함수 (Wi-Fi 네트워크에서 검색)
    async function scanForESP32Devices() {
        console.log("[검색 시작] 네트워크에서 ESP32 검색 중...");

        // 🔥 ESP32의 실제 IP 주소 (192.168.43.XXX로 설정)
        const esp32IP = "http://192.168.43.66";

        try {
            const response = await fetch(`${esp32IP}/scan`);
            if (!response.ok) throw new Error("ESP32 응답 오류");

            const deviceInfo = await response.json();
            console.log(`[기기 발견] ${deviceInfo.name} (${deviceInfo.ip})`);

            // 🔹 기존 목록 초기화 후 새 기기 추가
            deviceList.innerHTML = "";
            const option = document.createElement("option");
            option.value = deviceInfo.ip;
            option.textContent = deviceInfo.name;
            deviceList.appendChild(option);

            selectedDeviceIP = deviceInfo.ip;
            connectDeviceBtn.disabled = false; // 연결 버튼 활성화
        } catch (error) {
            console.error("[검색 오류]", error);
            alert("ESP32 검색 실패! 네트워크 상태를 확인하세요.");
        }
    }

    // 🔹 기기 검색 버튼 클릭 시 Wi-Fi 검색 실행
    if (scanDevicesBtn) {
        scanDevicesBtn.addEventListener("click", scanForESP32Devices);
    }

    // 🔹 선택한 기기와 연결 + UID 전송
    if (connectDeviceBtn) {
        connectDeviceBtn.addEventListener("click", async () => {
            if (!selectedDeviceIP) {
                alert("먼저 기기를 선택하세요.");
                return;
            }
            if (!currentUserUID) {
                alert("로그인이 필요합니다!");
                return;
            }

            try {
                // 🔥 ESP32로 UID 전송
                const response = await fetch(`http://${selectedDeviceIP}/receiveUID`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ uid: currentUserUID })
                });

                if (!response.ok) throw new Error("ESP32 응답 오류");

                alert(`ESP32 (${selectedDeviceIP})에 UID 전송 성공!`);
                console.log(`[기기 연결] ${selectedDeviceIP} | UID: ${currentUserUID}`);
            } catch (error) {
                console.error("[전송 오류]", error);
                alert("ESP32로 UID 전송 실패!");
            }
        });
    }




// ─────────────────────────────────────────────────────
// 🔹 뒤로 가기 버튼
// ─────────────────────────────────────────────────────
    if (goBackBtn) {
        goBackBtn.addEventListener("click", () => {
            console.log("[뒤로 가기] 메인 화면으로 이동");
            window.history.back();
        });
    }

    console.log("[이벤트 등록 완료] 버튼 이벤트 리스너 정상 작동");
});

// ─────────────────────────────────────────────────────
// 🔹 좌측, 우측, 후미등 버튼
// ─────────────────────────────────────────────────────
const leftWayEl = document.getElementById("left-btn");
const backWayEl = document.getElementById("back-way-btn");
const rightWayEl = document.getElementById("right-btn");

function updateDirection(user, direction) {
    if (!user) {
        console.error("User not logged in");
        return;
    }
    
    const userRef = ref(db, `users/${user.uid}/direction`);
    get(userRef).then((snapshot) => {
        const currentData = snapshot.val() || { left: 0, right: 0, back: 0 };

        const newData = {
            left: direction === "left" ? (currentData.left === 1 ? 0 : 1) : 0,
            right: direction === "right" ? (currentData.right === 1 ? 0 : 1) : 0,
            back: direction === "back" ? (currentData.back === 1 ? 0 : 1) : 0,
        };

        update(userRef, newData);
    });
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        if (leftWayEl) {
            leftWayEl.addEventListener("click", (event) => {
                event.preventDefault();
                updateDirection(user, "left");
            });
        }

        if (backWayEl) {
            backWayEl.addEventListener("click", (event) => {
                event.preventDefault();
                updateDirection(user, "back");
            });
        }

        if (rightWayEl) {
            rightWayEl.addEventListener("click", (event) => {
                event.preventDefault();
                updateDirection(user, "right");
            });
        }
    } else {
        console.log("No user signed in");
    }
});

// ─────────────────────────────────────────────────────
// 🔹 페이지 이동 버튼 이벤트 처리
// - 로그인, 회원가입, 뒤로 가기 버튼 클릭 시 해당 페이지로 이동
// ─────────────────────────────────────────────────────
const goLogin = document.getElementById("go-login-btn");
const goSignup = document.getElementById("go-signup-btn");
const emergencySys = document.getElementById("emergency-system");
const goRiding = document.getElementById("start-riding");
const connectDevice = document.getElementById("connect-device");
const goFreeRiding = document.getElementById("free-riding-btn");
const withNavigation = document.getElementById("with-navigation-btn");
const finishRidingEl = document.getElementById("finish-ride");
const goBackToHome = document.getElementById("go-back-to-home");

if (finishRidingEl) finishRidingEl.addEventListener("click", ()=> window.location.href = "finishRiding.html");
if (goLogin) goLogin.addEventListener("click", () => window.location.href = "login.html");
if (goFreeRiding) goFreeRiding.addEventListener("click", () => window.location.href = "freeRiding.html");
if (withNavigation) withNavigation.addEventListener("click", () => window.location.href = "withNavigation.html");
if (emergencySys) emergencySys.addEventListener("click", () => window.location.href = "emergency.html");
if (goRiding) goRiding.addEventListener("click", () => window.location.href = "goriding.html");
if (goSignup) goSignup.addEventListener("click", () => window.location.href = "register.html");
if (connectDevice) connectDevice.addEventListener("click", () => window.location.href = "connectDevice.html");
if (goBackToHome) goBackToHome.addEventListener("click", () => window.location.href = "main.html");


// ─────────────────────────────────────────────────────
// 🔹 네비게이션 및 자유라이딩 부문
// ─────────────────────────────────────────────────────



// 📍 지도 초기화 (호치민 기본 위치)
let map = L.map('map').setView([10.7769, 106.7009], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);

// 📍 마커 및 경로 변수
let userMarker, destMarker, routeLine;
let userCoords = null, destCoords = null;

// 📍 OpenRouteService API 키
const apiKey = "5b3ce3597851110001cf62489d303a6e4c664da99f58fd22a5f4f877";

// 🔹 Firebase에서 사용자 위치 데이터 가져오기
function fetchUserLocation() {

    const user = auth.currentUser;
    if (user) {
        const userRef = ref(db, `users/${user.uid}/sensor`);
        get(userRef).then(snapshot => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                userCoords = [parseFloat(data.latitude.toFixed(7)), parseFloat(data.longitude.toFixed(7))];


                // 🚀 **첫 위치 설정**
                if (!prevCoords) prevCoords = userCoords;

                updateUserMarker();
            } else {
                console.log("No location data available");
            }
        }).catch(error => console.error("Error fetching location:", error));
    }
}
let firstUpdate = true; // 🔹 첫 번째 업데이트 여부

let followUser = true;  // 🔹 사용자가 수동으로 변경 가능


// 🔹 사용자 마커 업데이트 (경로 업데이트 X)
function updateUserMarker() {
    if (userCoords) {
        if (!userMarker) {
            userMarker = L.marker(userCoords).addTo(map).bindPopup("현재 위치").openPopup();
        } else {
            userMarker.setLatLng(userCoords);
        }

        // 🔹 첫 업데이트이거나 followUser가 true일 때만 지도 중심 이동
        if (firstUpdate || followUser) {
            map.setView(userCoords, 17);
            firstUpdate = false; // 이후부터는 자동 이동 X
        }

    }
}


// 🔄 실시간 위치 업데이트
onAuthStateChanged(auth, user => {
    if (user) {
        setInterval(fetchUserLocation, 1000); // 1초마다 위치 갱신 
    }
});

// 🛠 사용자 조작으로 자동 이동 비활성화
map.on('dragstart', () => {
    followUser = false; // 사용자가 지도를 움직이면 자동 이동 비활성화
});

// 📌 목적지 검색 (장소 이름 → 위도,경도 변환)
let selectedDestCoords = null, searchTimeout = null, lastQuery = "";

window.searchSuggestions = function () {
    const query = document.getElementById("destination").value.trim();
    const suggestionsList = document.getElementById("suggestions");

    if (query === lastQuery) return;
    lastQuery = query;

    if (!query) {
        suggestionsList.innerHTML = "";
        suggestionsList.style.display = "none";
        return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=5&countrycodes=VN`)
            .then(response => response.json())
            .then(data => {
                suggestionsList.innerHTML = "";
                if (data.length === 0) return (suggestionsList.style.display = "none");

                suggestionsList.style.display = "block";
                data.forEach(place => {
                    let li = document.createElement("li");
                    li.textContent = place.display_name;
                    li.onclick = () => {
                        document.getElementById("destination").value = place.display_name;
                        selectedDestCoords = [parseFloat(place.lat), parseFloat(place.lon)];
                        suggestionsList.innerHTML = "";
                        suggestionsList.style.display = "none";
                    };
                    suggestionsList.appendChild(li);
                });
            })
            .catch(error => console.error("🔴 검색 추천 오류:", error));
    }, 500);
}

// 📌 목적지 선택 후 지도에 마커 추가
window.searchDestination = function () {
    console.log("✅ searchDestination 함수 실행됨");

    // ✅ `selectedDestCoords`가 null이면 경고 후 종료
    if (!selectedDestCoords) {
        console.error("❌ 장소가 선택되지 않음");
        alert("장소를 선택하세요.");
        return;
    }
    selectedDestCoords = [parseFloat(selectedDestCoords[0].toFixed(7)), parseFloat(selectedDestCoords[1].toFixed(7))];


    console.log("📍 선택된 목적지 좌표:", selectedDestCoords);

    // ✅ `selectedDestCoords` 값을 `destCoords`에 저장
    destCoords = [...selectedDestCoords];

    if (!destMarker) {
        destMarker = L.marker(destCoords, { color: 'red' }).addTo(map).bindPopup("목적지");
    } else {
        destMarker.setLatLng(destCoords).bindPopup("목적지");
    }

    map.setView(destCoords, 17);

};

let isDestinationSet = false; // 목적지가 설정되었는지 여부

function updateRoute() {
    if (!userCoords || !destCoords) return;

    // 목적지가 이미 설정된 경우 API 요청을 보내지 않음
    if (isDestinationSet) {
        console.log("목적지가 이미 설정되었습니다. API 요청을 보내지 않습니다.");
        return;
    }

    const apiUrl = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${userCoords[1]},${userCoords[0]}&end=${destCoords[1]},${destCoords[0]}`;
    
    console.log("🔹 API 요청 URL:", apiUrl);

    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            console.log("🛠 API 응답 데이터:", data); // 🔍 응답 데이터 확인
            if (data.error) return alert("API 오류 발생: " + data.error.message);

            if (!data.features || data.features.length === 0) {
                document.getElementById("distance-info").innerText = "이동 거리: 경로 없음";
                return console.warn("🚧 경로 데이터를 찾을 수 없음.");
            }

            // ✅ 이동 거리 계산
            let distance = data.features[0].properties.segments[0].distance / 1000;
            document.getElementById("distance-info").innerText = `이동 거리: ${distance.toFixed(2)} km`;

            // ✅ 경로 좌표 변환 및 지도에 표시
            let routeCoords = data.features[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
            if (routeLine) map.removeLayer(routeLine);
            routeLine = L.polyline(routeCoords, { color: 'blue' }).addTo(map);
            map.fitBounds(routeLine.getBounds());

            // ✅ Firebase에 Distance 저장
            const user = auth.currentUser; // ✅ auth 객체 사용
            if (user) {
                const userId = user.uid;
                const recordRef = ref(db, `users/${userId}/records/1`); // ✅ ref(db, 경로) 사용
                
                update(recordRef, { // ✅ update 함수 사용
                    Distance: distance.toFixed(2) // 소수점 2자리까지 저장
                }).then(() => {
                    console.log("✅ Firebase에 Distance 저장 완료:", distance.toFixed(2), "km");
                }).catch(error => {
                    console.error("❌ Firebase 저장 오류:", error);
                });
            } else {
                console.warn("❌ 사용자가 로그인되지 않음.");
            }

            // 목적지 설정 완료
            isDestinationSet = true;
        })
        .catch(error => {
            console.error("API 요청 실패:", error);
            console.error("에러 상세 정보:", error.message, error.stack);
            alert("경로를 가져오는 중 오류가 발생했습니다.");
        });
}


// 🚀 초기 실행
fetchUserLocation(); // 🚀 사용자 위치 가져오기

// 📌 Firebase 사용자 로그인 상태 확인 후 최근 위치 불러오기
onAuthStateChanged(auth, user => {
    if (user) {
        console.log("✅ 로그인된 사용자 ID:", user.uid);
        loadRecentLocations(user.uid);
    } else {
        console.log("❌ 로그인되지 않음");
        document.getElementById("recent-locations").innerHTML = "<li>로그인 후 사용 가능합니다.</li>";
    }
});

// 📌 최근 목적지 불러와서 UI에 표시
function loadRecentLocations(userId) {
    console.log("✅ loadRecentLocations 호출됨");

    const userRef = ref(db, `users/${userId}/recentLocations`);
    const recentList = document.getElementById("recent-locations");

    get(userRef).then((snapshot) => {
        recentList.innerHTML = ""; // 목록 초기화

        if (!snapshot.exists()) {
            console.log("📌 저장된 위치 없음");
            recentList.innerHTML = "<li>저장된 위치 없음</li>";
            return;
        }

        let locations = snapshot.val();
        let sortedKeys = Object.keys(locations).sort((a, b) => locations[b].timestamp - locations[a].timestamp); // 최신순 정렬

        sortedKeys.forEach((key) => {
            let loc = locations[key];
            let li = document.createElement("li");
            li.textContent = loc.name;
            li.onclick = () => {
                document.getElementById("destination").value = loc.name;
                selectedDestCoords = [loc.lat, loc.lon];
            };
            recentList.appendChild(li);
        });
    }).catch((error) => console.error("❌ 최근 위치 불러오기 실패:", error));
}



// 📌 목적지 선택 시 데이터 저장 (최대 5개까지 저장)
function saveDestination(name, lat, lon) {
    console.log("✅ saveDestination 호출됨");

    const user = auth.currentUser;
    if (!user) {
        console.warn("❌ 사용자 없음 (로그인 필요)");
        return;
    }

    const userRef = ref(db, `users/${user.uid}/recentLocations`);

    get(userRef).then((snapshot) => {
        let locations = snapshot.val() || {};
        let keys = Object.keys(locations);

        // 🔹 중복 체크: 같은 lat, lon이 이미 저장된 경우 추가 X
        let isDuplicate = keys.some(key => locations[key].lat === lat && locations[key].lon === lon);
        if (isDuplicate) {
            console.warn("⚠️ 이미 저장된 위치입니다. 저장하지 않습니다.");
            return;
        }

        // 🔹 최대 5개 유지: 가장 오래된 데이터 삭제
        if (keys.length >= 5) {
            let oldestKey = keys.reduce((a, b) => locations[a].timestamp < locations[b].timestamp ? a : b);
            console.log(`🗑 오래된 위치 삭제: ${locations[oldestKey].name}`);
            set(ref(db, `users/${user.uid}/recentLocations/${oldestKey}`), null);
        }

        // 🔹 새 위치 저장
        let newKey = Date.now().toString();
        console.log(`📍 Firebase 저장 중: ${name} (${lat}, ${lon})`);

        set(ref(db, `users/${user.uid}/recentLocations/${newKey}`), {
            name: name,
            lat: parseFloat(lat.toFixed(7)),
            lon: parseFloat(lon.toFixed(7)),
            timestamp: Date.now()
        
        }).then(() => {
            console.log("✅ 위치 저장 완료!");
            loadRecentLocations(user.uid); // ✅ 저장 후 최근 위치 불러오기 실행
        }).catch((error) => console.error("❌ 위치 저장 실패:", error));
    }).catch((error) => console.error("❌ 데이터베이스 읽기 실패:", error));
}
const clickSearchDesEl = document.getElementById("click-search-des");

if (clickSearchDesEl) {
    clickSearchDesEl.addEventListener("click", () => {
        console.log("🔍 검색 버튼 클릭됨");
        searchDestination();
    });
} else {
    console.error("❌ 요소를 찾을 수 없음: #click-search-des");
}

function searchDestination() {
    console.log("✅ searchDestination 호출됨");
    console.log("rideStartTime 상태:", rideStartTime); // 🛠 디버깅 로그 추가

    if (!selectedDestCoords) {
        alert("장소를 선택하세요.");
        return;
    }
    selectedDestCoords = [parseFloat(selectedDestCoords[0].toFixed(7)), parseFloat(selectedDestCoords[1].toFixed(7))];


    destCoords = selectedDestCoords;

    if (!destMarker) {
        destMarker = L.marker(destCoords, { color: 'red' }).addTo(map).bindPopup("목적지");
    } else {
        destMarker.setLatLng(destCoords).bindPopup("목적지");
    }

    map.setView(destCoords, 14);

    let destinationName = document.getElementById("destination").value;
    console.log(`📍 저장할 장소: ${destinationName} (${destCoords[0]}, ${destCoords[1]})`);

    saveDestination(destinationName, destCoords[0], destCoords[1]); // 목적지 저장

    if (!rideStartTime) {
        console.log("🟢 라이딩 시작!");
        startRide(); // 🚴 라이딩 시작 함수 호출
    } else {
        console.log("⚠ 이미 라이딩이 진행 중입니다.");
    }
    updateRoute(); // 🔄 경로 업데이트
}


// ─────────────────────────────────────────────────────
// 🔹 칼로리, 페이스, 탑승 시간
// ─────────────────────────────────────────────────────
// 🔹 Haversine 공식을 사용하여 두 GPS 좌표 간 거리 계산 (단위: km)
function calculateDistance(coords1, coords2) {
    if (!coords1 || !coords2) return 0;

    const R = 6371; // 지구 반지름 (km)
    const toRad = (degree) => degree * (Math.PI / 180);

    const [lat1, lon1] = [parseFloat(coords1[0].toFixed(7)), parseFloat(coords1[1].toFixed(7))];
    const [lat2, lon2] = [parseFloat(coords2[0].toFixed(7)), parseFloat(coords2[1].toFixed(7))];
    

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) ** 2;
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // 결과값 (km)
}



document.addEventListener("DOMContentLoaded", function () {
    const startRideBtn = document.getElementById("start-ride-btn");
    const finishRideBtn = document.getElementById("finish-ride");
    const startFreeRiding = document.getElementById("start-free-riding");



    if (startFreeRiding) startFreeRiding.addEventListener("click", startRide);
    if (startRideBtn) startRideBtn.addEventListener("click", startRide);
    if (finishRideBtn) {
        finishRideBtn.addEventListener("click", finishRide);
        finishRideBtn.disabled = true;
    }
});

// 🔹 라이딩 시작
function startRide() {
    if (rideStartTime) {
        console.log("⚠ 라이딩이 이미 진행 중입니다.");
        return;
    }

    rideStartTime = Date.now();
    rideTimer = setInterval(updateRideData, 1000);

    console.log(`🚴 라이딩 시작! 기록: records/${recordIndex}`);

    saveRideRecord(recordIndex, 0, 0, 0, false);
    document.getElementById("finish-ride").disabled = false;
}

// 🔹 GPS 위치 기반 라이딩 데이터 업데이트
function updateRideData() {
    if (!rideStartTime || !prevCoords || !userCoords) return;

    const elapsedTime = (Date.now() - rideStartTime) / 1000;

    // 🚀 **실제 이동 거리 계산**
    const distanceDelta = calculateDistance(prevCoords, userCoords);
    rideDistance += distanceDelta; 
    prevCoords = userCoords; // 이전 좌표 업데이트

    // 🚴‍♂️ 속도 & 칼로리 계산
    ridePace = (rideDistance / elapsedTime) * 3600;
    rideCalories = Math.floor(rideDistance * 50);

    // 🔥 Firebase 업데이트
    saveRideRecord(recordIndex, rideCalories, Math.floor(elapsedTime), ridePace, false);
}
// 🔹 Firebase에 라이딩 기록 저장
function saveRideRecord(index, calories, duration, pace, isFinished) {
    const user = auth.currentUser;
    if (!user) return;

    const rideRecordRef = ref(db, `users/${user.uid}/records/${index}`);

    update(rideRecordRef, {
        calories,
        duration,
        pace,
        timestamp: Date.now(),
        isFinished
    }).then(() => {
        console.log(`✅ 기록 업데이트: records/${index} (isFinished: ${isFinished})`);
    }).catch(error => {
        console.error("❌ 기록 저장 실패:", error);
    });
}

// 🔹 라이딩 종료
function finishRide() {
    if (!rideStartTime) {
        alert("🚫 라이딩이 시작되지 않았습니다.");
        return;
    }

    clearInterval(rideTimer);
    rideStartTime = null;

    const user = auth.currentUser;
    if (!user) return;

    update(ref(db, `users/${user.uid}/records/${recordIndex}`), { isFinished: true })
        .then(() => {
            console.log("✅ 라이딩 종료 완료!");
            document.getElementById("finish-ride").disabled = true;
        })
        .catch(error => console.error("❌ 종료 실패:", error));
}