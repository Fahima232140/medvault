const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors"); // <-- ИМПОРТ CORS
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Инициализация переменных окружения
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const DB_URI = process.env.DB_URI;
const JWT_SECRET = process.env.JWT_SECRET || "your-very-secret-key";

// --- КОНФИГУРАЦИЯ CORS ---
const corsOptions = {
    // Разрешаем запросы с порта, на котором обычно запущен фронтенд (8080)
    origin: 'http://127.0.0.1:8080', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions)); // <-- ИСПОЛЬЗОВАНИЕ CORS

// --- Middlewares ---
app.use(express.json());

// --- Database Connection ---

mongoose.connect(DB_URI)
    .then(() => console.log("MongoDB connected successfully."))
    .catch(err => console.error("MongoDB connection error:", err));
    
// --- FIREBASE/CRYPTO STUBS (Заглушки) ---
// Эти заглушки имитируют работу внешних сервисов
const { uploadEncryptedRecord, downloadEncryptedRecord } = require("./firebase");
const { 
    encryptAES256, 
    decryptAES256, 
    sha256Hex, 
    verifySchnorrProof 
} = require("./cryptoService");
const { storeRecordHashOnChain, verifyRecordHashOnChain } = require("./blockchain");

// --- Models ---
// --- Models ---
const User = require('./models/User');
const Record = require('./models/Record'); // <-- ИСПРАВЛЕНО

// --- Middleware для аутентификации ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- ROUTES ---

// 1. Регистрация пользователя
app.post('/api/auth/register', async (req, res) => {
    const { email, password, name, role, zkpPublicKey } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists." });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = new User({
            email,
            passwordHash,
            name,
            role: role || 'patient', // По умолчанию "patient"
            zkpPublicKey,
        });

        await newUser.save();
        
        // Создание токена после успешной регистрации
        const token = jwt.sign({ email: newUser.email, role: newUser.role }, JWT_SECRET, { expiresIn: '1h' });

        res.status(201).json({ 
            message: "User registered successfully.", 
            user: { email: newUser.email, name: newUser.name, role: newUser.role },
            token
        });

    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ message: "Server error during registration." });
    }
});

// 2. Логин пользователя
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "Invalid credentials." });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials." });
        }

        const token = jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        
        res.json({ 
            message: "Login successful.", 
            user: { email: user.email, name: user.name, role: user.role, zkpPublicKey: user.zkpPublicKey },
            token
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Server error during login." });
    }
});

// 3. Загрузка записи (Требует аутентификации)
app.post('/api/records', authenticateToken, async (req, res) => {
    const { email, data } = req.body;
    
    if (req.user.email !== email) {
        return res.status(403).json({ message: "Forbidden: Cannot upload record for another user." });
    }

    try {
        // 1. Шифрование и хеширование
        const encrypted = encryptAES256(data);
        const hashHex = sha256Hex(encrypted);
        const recordId = mongoose.Types.ObjectId().toString(); // Генерация ID

        // 2. Имитация загрузки в Firebase
        const storageUrl = await uploadEncryptedRecord(recordId, encrypted);

        // 3. Имитация регистрации хеша в Блокчейне (для проверки целостности)
        const blockchainTx = await storeRecordHashOnChain(hashHex);

        // 4. Сохранение метаданных в MongoDB
        const newRecord = new Record({
            recordId,
            ownerEmail: email,
            hashHex,
            storageUrl,
            status: "Verified on Chain (Pending ZKP)",
            blockchainTx,
        });
        await newRecord.save();

        res.status(201).json({ 
            message: "Record uploaded and hash stored on chain.", 
            recordId, 
            blockchainTx 
        });

    } catch (error) {
        console.error("Record upload error:", error);
        res.status(500).json({ message: "Server error during record upload." });
    }
});


// 4. Запрос доступа (ZKP Verification)
app.post('/api/records/:recordId/access-request', authenticateToken, async (req, res) => {
    const { recordId } = req.params;
    const { publicKeyHex, proof } = req.body; // Получаем публичный ключ и доказательство
    
    // NOTE: В реальной системе нужно убедиться, что пользователь req.user.role === 'doctor'

    try {
        const record = await Record.findOne({ recordId });
        if (!record) {
            return res.status(404).json({ message: "Record not found." });
        }

        // 1. ПРОВЕРКА ZKP: Доказательство знания секретного ключа
        const message = record.hashHex; // Сообщение для доказательства - хеш записи
        const isProofValid = verifySchnorrProof(publicKeyHex, proof, message);

        if (!isProofValid) {
            return res.status(403).json({ message: "Access denied. Invalid Zero-Knowledge Proof." });
        }

        // 2. ПРОВЕРКА ЦЕЛОСТНОСТИ (опционально, но важно)
        // Проверяем, что хеш записи в БД соответствует хешу, зарегистрированному в "блокчейне"
        const isHashVerified = await verifyRecordHashOnChain(record.hashHex);

        if (!isHashVerified) {
            // Если хеш не совпадает, это означает, что запись была изменена!
             return res.status(500).json({ message: "Integrity check failed. Record has been tampered." });
        }
        
        // 3. Расшифровка записи (только после успешного ZKP и проверки целостности)
        const encryptedData = await downloadEncryptedRecord(recordId); // Имитация загрузки из Firebase
        const recordPlaintext = decryptAES256(encryptedData);
        
        // Обновляем статус записи в MongoDB
        record.status = "Accessed via ZKP";
        await record.save();

        res.json({
            message: "Access granted via ZKP and record is verified.",
            recordPlaintext,
            status: record.status
        });

    } catch (error) {
        console.error("Access request error:", error);
        res.status(500).json({ message: "Server error during access request." });
    }
});


// 5. Запуск сервера
app.listen(PORT, () => {
    console.log(`MedVault backend listening on http://localhost:${PORT}`);
    console.log("--- ⚠️ ИСПОЛЬЗУЕТСЯ ЗАГЛУШКА FIREBASE. Данные не сохраняются персистентно. ---");
});