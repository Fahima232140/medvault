const BACKEND_URL = "http://127.0.0.1:4000"; // Используем 127.0.0.1 для лучшей совместимости CORS
let userToken = localStorage.getItem('medvault_token');
let user = JSON.parse(localStorage.getItem('medvault_user')) || null;

// --- Helper Functions ---

/**
 * Переключает активный экран приложения.
 * @param {string} screenId - ID экрана, который нужно показать (e.g., 'login', 'home').
 */
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('screen--active');
    });
    const targetScreen = document.getElementById(`screen-${screenId}`);
    if (targetScreen) {
        targetScreen.classList.add('screen--active');
        if (screenId === 'home') {
            updateHomeDisplay();
        }
    } else {
        console.error("Screen not found:", screenId);
    }
}

/**
 * Показывает временное уведомление (Toast).
 * @param {string} message - Сообщение.
 * @param {boolean} isError - Флаг, указывающий, является ли это ошибкой.
 */
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show';
    if (isError) {
        toast.classList.add('error');
    } else {
        toast.classList.remove('error');
    }
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

/**
 * Обновляет отображение на главном экране (роли и имя).
 */
function updateHomeDisplay() {
    if (!user) return;
    document.querySelector('.home-title-small').textContent = `Welcome, ${user.name || user.email}!`;
    document.querySelector('.home-subtitle').textContent = `Role: ${user.role.toUpperCase()}`;
    
    // Скрываем/показываем карточки в зависимости от роли
    const isDoctor = user.role === 'doctor';
    document.getElementById('cardPatientList').style.display = isDoctor ? 'flex' : 'none';
    document.getElementById('cardShareAccess').style.display = isDoctor ? 'flex' : 'none';
    document.getElementById('cardMyRecords').style.display = isDoctor ? 'none' : 'flex';
    document.getElementById('cardUploadRecords').style.display = isDoctor ? 'none' : 'flex';
}

/**
 * Проверяет наличие токена и перенаправляет.
 */
function checkAuth() {
    if (userToken && user) {
        showScreen('home');
    } else {
        showScreen('splash');
    }
}

// --- Crypto/ZKP STUBS (Имитация) ---

/**
 * Имитация генерации ZKP ключей.
 * NOTE: В реальной жизни это должно происходить на стороне бэкенда или в защищенном модуле.
 */
async function generateZkpKeys() {
    // В реальной жизни это была бы сложная криптографическая операция
    const privateKey = 'zkp-secret-key-' + Date.now();
    const publicKey = 'zkp-public-key-' + Math.random().toString(36).substring(7);
    
    // Имитируем сохранение приватного ключа локально (ОЧЕНЬ небезопасно для реального приложения!)
    localStorage.setItem('zkp_private_key', privateKey);
    
    return { 
        privateHex: privateKey, 
        publicHex: publicKey 
    };
}

/**
 * Получение публичных ключей для доктора (для регистрации).
 */
async function getDoctorKeys() {
    // Для регистрации доктора генерируем новые ключи.
    // Если пользователь - пациент, ключи будут генерироваться позже, когда он захочет скрыть данные.
    return generateZkpKeys(); 
}

/**
 * Имитация создания ZKP (Proof of Knowledge).
 * @param {string} message - Сообщение, для которого создается доказательство (например, хеш записи).
 * @returns {object} - Доказательство и публичный ключ.
 */
async function createZkpProof(message) {
    const privateKey = localStorage.getItem('zkp_private_key');
    const publicKey = user.zkpPublicKey;

    if (!privateKey || !publicKey) {
        throw new Error("Missing ZKP keys for proof generation.");
    }

    // Имитация доказательства:
    const proof = "proof-of-knowledge-for-" + message.substring(0, 10);
    
    return {
        publicKeyHex: publicKey,
        proof
    };
}


// --- Event Listeners and Logic ---

window.onload = () => {
    checkAuth();

    // 1. SPLASH
    document.getElementById("btnStart").addEventListener("click", () => {
        showScreen('login');
    });
    
    // 2. Navigation
    document.getElementById("goToSignupFromLogin").addEventListener("click", () => {
        showScreen('signup');
    });
    document.getElementById("btnBackToLogin").addEventListener("click", () => {
        showScreen('login');
    });
    document.getElementById("goToLoginFromSignup").addEventListener("click", () => {
        showScreen('login');
    });

    // 3. SIGNUP Logic
    document.getElementById("signupForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        console.log("Attempting Signup... Collecting form data."); 

        // Сбор данных формы
        const name = document.getElementById("signupName").value.trim();
        const email = document.getElementById("signupEmail").value.trim();
        // В HTML добавлено IIN, мы должны его собрать
        const iin = document.getElementById("signupIIN").value.trim(); 
        const phone = document.getElementById("signupPhone").value.trim();
        const password = document.getElementById("signupPassword").value;
        const passwordConfirm = document.getElementById("signupPasswordConfirm").value; // ИСПРАВЛЕН ID

        if (!name || !email || !password || !passwordConfirm) {
            return showToast("Please fill all required fields", true);
        }
        if (password !== passwordConfirm) {
            return showToast("Passwords do not match", true);
        }
        
        try {
            // Для простоты, все регистрируемые пользователи считаются "doctor" 
            const { publicHex: zkpPublicKey } = await getDoctorKeys();
            
            console.log("ZKP Keys generated. Sending request to backend.");

            const res = await fetch(`${BACKEND_URL}/api/auth/register`, { 
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    name, 
                    email, 
                    phone, 
                    password, 
                    role: "doctor", 
                    zkpPublicKey,
                    // IIN НЕ ОТПРАВЛЯЕМ, так как он не требуется в схеме бэкенда, но мы его собрали
                }),
            });

            const data = await res.json();
            
            if (!res.ok) {
                console.error("Signup failed:", data);
                return showToast(data.message || "Signup failed (Server Error)", true);
            }
            
            showToast("Registration successful! Please login.");
            showScreen("login");

        } catch (error) {
            console.error("Fetch or ZKP error:", error);
            // Если вы видите Network error, это может быть проблема с CORS или недоступностью 4000 порта
            showToast("Network error or Server issue. Check the backend status.", true); 
        }
    });

    // 4. LOGIN Logic
    document.getElementById("loginForm").addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;

        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                console.error("Login failed:", data);
                return showToast(data.message || "Login failed (Invalid credentials)", true);
            }

            // Успешный вход
            userToken = data.token;
            user = data.user;
            localStorage.setItem('medvault_token', userToken);
            localStorage.setItem('medvault_user', JSON.stringify(user));
            
            showToast("Login successful!");
            showScreen("home");

        } catch (error) {
            console.error("Login fetch error:", error);
            showToast("Login failed due to a network or server issue.", true);
        }
    });

    // 5. UPLOAD Logic (Simplified Stub)
    document.getElementById("btnEncryptUpload").addEventListener("click", async () => {
        const recordData = document.getElementById("recordInput").value.trim();
        if (!recordData) {
            return showToast("Please enter some record data to upload.", true);
        }
        
        if (!userToken || !user) {
            return showToast("Authentication required.", true);
        }

        try {
            const statusText = document.getElementById('uploadStatusText');
            statusText.textContent = "Status: Encrypting and generating hash...";
            
            // 1. Имитация ZKP: Мы должны использовать приватный ключ, связанный с этим пользователем.
            // При регистрации мы сохранили zkpPublicKey в БД. 
            // Здесь мы используем этот же ключ (в реальной системе это сложнее).

            const res = await fetch(`${BACKEND_URL}/api/records`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${userToken}` 
                },
                body: JSON.stringify({ 
                    email: user.email, 
                    data: recordData // Отправляем чистые данные для имитации шифрования на бэкенде
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                console.error("Upload failed:", data);
                statusText.textContent = `Status: Failed. ${data.message}`;
                return showToast(data.message || "Upload failed.", true);
            }
            
            statusText.textContent = `Status: Uploaded! Tx: ${data.blockchainTx}`;
            showToast("Record uploaded and verified on Chain!");
            
        } catch (error) {
            console.error("Upload process failed:", error);
            showToast("Upload failed due to an error.", true);
        }
    });


    // 6. ACCESS Logic (ZKP Proof Generation)
    // В реальном приложении это будет вызываться при нажатии кнопки "Request Access"
    window.requestAccess = async (recordId, ownerEmail) => {
        if (!userToken || !user || user.role !== 'doctor') {
            return showToast("Only doctors can request access.", true);
        }

        try {
            showToast(`Generating ZKP for record ${recordId}...`);
            
            // 1. Имитация получения хеша записи (для доказательства)
            // В боевой системе, doctor получит хеш от пациента или из метаданных. 
            // Здесь мы просто генерируем доказательство.
            const dummyHash = "dummy-record-hash-" + recordId; 

            // 2. Генерация ZKP
            const { publicKeyHex, proof } = await createZkpProof(dummyHash);
            
            // 3. Запрос доступа с доказательством
            const res = await fetch(`${BACKEND_URL}/api/records/${recordId}/access-request`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${userToken}` 
                },
                body: JSON.stringify({ 
                    publicKeyHex, 
                    proof 
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                console.error("Access request failed:", data);
                return showToast(data.message || "Access denied.", true);
            }

            showToast("Access granted! Record decrypted and verified.");
            console.log("Decrypted Record Data:", data.recordPlaintext);
            
        } catch (error) {
            console.error("Access process failed:", error);
            showToast(error.message || "Access request failed.", true);
        }
    };
    
    // 7. Navigation Tabs
    document.querySelectorAll('.bottom-nav-btn').forEach(button => {
        button.addEventListener('click', () => {
            const tab = button.getAttribute('data-tab');
            if (tab === 'home') showScreen('home');
            if (tab === 'records') showScreen('verification'); // Пример
            if (tab === 'notifications') showScreen('notifications');
            if (tab === 'profile') showScreen('profile');
        });
    });

    // Инициализация отображения
    showScreen('splash');
};